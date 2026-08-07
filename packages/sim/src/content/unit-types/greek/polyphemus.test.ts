import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage, resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import { TARGET_REACTION_THROWN } from "../../../ecs/target-reactions";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  UNIT_CLASS_HUNTABLE,
  UNIT_CONDITION_FROZEN,
  UNIT_CONDITION_STONE,
} from "../../unit-type-schema";
import { TYPE_HOPLITE, TYPE_MINOTAUR, TYPE_POLYPHEMUS } from "../../unit-type-ids";
import { definition } from "./polyphemus";

function duel(targetType = TYPE_HOPLITE) {
  const world = createWorld(103);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const polyphemus = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_POLYPHEMUS);
  const target = spawnUnit(world, 21.5, 20, 0, 0, 1, targetType);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [polyphemus],
    targetId: target,
  });
  return { world, polyphemus, target };
}

describe("Greek Polyphemus unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic balance, unequal cycles, and Gore", () => {
    expect(definition).toMatchObject({
      maxHp: 540,
      movementSpeed: 3.5,
      armor: [0.4, 0.4, 0.99],
      costGold: 400,
      costFavor: 6,
      buildTicks: 540,
      populationCost: 4,
      attack: {
        damage: [15, 0, 5],
        cycleVariants: [
          { actionTicks: 30, impactDelayTicks: 15 },
          { actionTicks: 40, impactDelayTicks: 25 },
        ],
      },
      specialAttack: {
        damage: [90, 0, 0],
        rechargeTicks: 360,
        actionTicks: 30,
        impactDelayTicks: 16,
        invalidTargetConditions: UNIT_CONDITION_FROZEN | UNIT_CONDITION_STONE,
      },
    });
  });

  test("accepts humans, all myth units, and huntables but rejects source immunities", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(
      isValidSpecialTarget(special, {
        ...UNIT_TYPES[TYPE_HOPLITE]!,
        classes: UNIT_CLASS_HUNTABLE,
      }),
    ).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!, UNIT_CONDITION_FROZEN)).toBe(
      false,
    );
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!, UNIT_CONDITION_STONE)).toBe(
      false,
    );
  });

  test("lands source-timed Gore, applies the myth multiplier, and throws survivors", () => {
    const { world } = duel(TYPE_MINOTAUR);
    const startingHp = world.hp[1]!;
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(30);

    for (let tick = 0; tick < 15; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);
    tickWorld(world);

    expect(world.hp[1]).toBeCloseTo(
      startingHp - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_MINOTAUR]!),
      10,
    );
    expect(world.specialRecharge[0]).toBe(360);
    expect(world.targetReactions.kind[1]).toBe(TARGET_REACTION_THROWN);
  });

  test("revalidates immunity before impact without consuming the charge", () => {
    const { world } = duel();
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(30);
    world.unitConditions[1] = UNIT_CONDITION_FROZEN;
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(0);
    expect(world.specialRecharge[0]).toBe(0);
  });

  test("uses the selected ordinary source cycle after Gore is unavailable", () => {
    const { world } = duel();
    world.specialRecharge[0] = 100;
    const startingHp = world.hp[1]!;
    tickWorld(world);
    const variant = world.meleeActionVariant[0]!;
    const cycle = definition.attack.cycleVariants[variant]!;
    for (let tick = 1; tick < cycle.impactDelayTicks; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);
    tickWorld(world);
    expect(world.hp[1]).toBeCloseTo(
      startingHp - resolveMeleeCycleDamage(definition.attack, cycle, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );
  });

  test("preserves target conditions through dense compaction and deterministic replay", () => {
    const a = duel().world;
    const b = duel().world;
    a.unitConditions[1] = b.unitConditions[1] = UNIT_CONDITION_STONE;
    const extraA = spawnUnit(a, 30, 30, 0, 0, 1, TYPE_HOPLITE);
    const extraB = spawnUnit(b, 30, 30, 0, 0, 1, TYPE_HOPLITE);
    a.unitConditions[2] = b.unitConditions[2] = UNIT_CONDITION_FROZEN;
    killUnit(a, 1);
    killUnit(b, 1);
    tickWorld(a);
    tickWorld(b);
    expect(a.unitConditions[resolveId(a, extraA)]).toBe(UNIT_CONDITION_FROZEN);
    expect(b.unitConditions[resolveId(b, extraB)]).toBe(UNIT_CONDITION_FROZEN);
    for (let tick = 0; tick < 240; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
