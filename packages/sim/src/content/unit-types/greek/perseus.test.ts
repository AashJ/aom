import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  UNIT_CLASS_AIR,
  UNIT_CLASS_SET_ANIMAL,
  UNIT_CONDITION_FROZEN,
  UNIT_CONDITION_STONE,
} from "../../unit-type-schema";
import { TYPE_HOPLITE, TYPE_MINOTAUR, TYPE_PERSEUS } from "../../unit-type-ids";
import { definition } from "./perseus";

function duel(targetType = TYPE_MINOTAUR, distance = 6) {
  const world = createWorld(107);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const perseus = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PERSEUS);
  const target = spawnUnit(world, 20 + distance, 20, 0, 0, 1, targetType);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [perseus],
    targetId: target,
  });
  return { world, perseus, target };
}

describe("Greek Perseus unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic balance, attack timing, and terminal petrification", () => {
    expect(definition).toMatchObject({
      maxHp: 360,
      movementSpeed: 4.3,
      armor: [0.2, 0.4, 0.99],
      costGold: 400,
      costFavor: 6,
      populationCost: 4,
      attack: {
        damage: [7, 0, 0],
        cycleVariants: [{ actionTicks: 30, impactDelayTicks: 16 }],
      },
      specialAttack: {
        kind: "charged-terminal",
        effect: "petrify-kill",
        range: 5,
        rechargeTicks: 480,
        actionTicks: 60,
        impactDelayTicks: 24,
      },
    });
  });

  test("accepts ground myth units and Set animals but not humans, air, frozen, or stone", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(false);
    expect(
      isValidSpecialTarget(special, {
        ...UNIT_TYPES[TYPE_HOPLITE]!,
        classes: UNIT_CLASS_SET_ANIMAL,
      }),
    ).toBe(true);
    expect(
      isValidSpecialTarget(special, {
        ...UNIT_TYPES[TYPE_MINOTAUR]!,
        classes: UNIT_TYPES[TYPE_MINOTAUR]!.classes | UNIT_CLASS_AIR,
      }),
    ).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!, UNIT_CONDITION_FROZEN)).toBe(
      false,
    );
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!, UNIT_CONDITION_STONE)).toBe(
      false,
    );
  });

  test("casts from its five-meter edge range and petrifies exactly on the source tag", () => {
    const { world, target } = duel();
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(60);
    expect(world.moving[0]).toBe(0);

    for (let tick = 0; tick < 23; tick += 1) tickWorld(world);
    expect(resolveId(world, target)).toBe(1);
    tickWorld(world);

    expect(resolveId(world, target)).toBe(-1);
    expect(world.specialRecharge[0]).toBe(480);
    expect(world.deathEventCount).toBe(1);
    expect(world.deathEventConditions[0]! & UNIT_CONDITION_STONE).toBe(UNIT_CONDITION_STONE);
    const snapshot = createSnapshot(4);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.deathConditions[0]! & UNIT_CONDITION_STONE).toBe(UNIT_CONDITION_STONE);
  });

  test("falls back to the source ordinary cycle against an invalid special target", () => {
    const { world } = duel(TYPE_HOPLITE, 1.25);
    const startingHp = world.hp[1]!;
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(0);
    const cycle = definition.attack.cycleVariants[0];
    for (let tick = 1; tick < cycle.impactDelayTicks; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);
    tickWorld(world);
    expect(world.hp[1]).toBeCloseTo(
      startingHp - resolveMeleeCycleDamage(definition.attack, cycle, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );
  });

  test("keeps terminal casting deterministic", () => {
    const a = duel().world;
    const b = duel().world;
    for (let tick = 0; tick < 180; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
