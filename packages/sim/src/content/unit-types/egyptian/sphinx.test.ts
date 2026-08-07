import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { MODE_PRAYING, createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_HOPLITE,
  TYPE_JASON,
  TYPE_MINOTAUR,
  TYPE_SPHINX,
  TYPE_TREE,
} from "../../unit-type-ids";
import { definition } from "./sphinx";

function attackWorld() {
  const world = createWorld(145);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const sphinx = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SPHINX);
  const target = spawnUnit(world, 20, 21.5, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [sphinx],
    targetId: target,
  });
  return { world, sphinx, target };
}

describe("Egyptian Sphinx unit pack", () => {
  test("matches the integration-owned Classic reference", () => {
    const reference = GATE_C_MYTH_UNIT_REFERENCES.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic balance, source attack timing, and Whirlwind contract", () => {
    expect(definition).toMatchObject({
      maxHp: 300,
      lineOfSight: 22,
      movementSpeed: 5.3,
      armor: [0.45, 0.6, 0.8],
      costFood: 120,
      costFavor: 20,
      buildTicks: 340,
      populationCost: 4,
      attack: {
        damage: [11.25, 0, 5],
        cycleVariants: [{ actionTicks: 45, impactDelayTicks: 12 }],
      },
      specialAttack: {
        damage: [20, 0, 0],
        radius: 3,
        rechargeTicks: 240,
        actionTicks: 32,
        impactDelayTicks: 11,
      },
    });
  });

  test("lands one enemy-only attacker-centered Whirlwind pulse on implemented valid classes", () => {
    const { world } = attackWorld();
    const myth = spawnUnit(world, 21, 20, 0, 0, 1, TYPE_MINOTAUR);
    const hero = spawnUnit(world, 21, 21, 0, 0, 1, TYPE_JASON);
    const ally = spawnUnit(world, 19, 20, 0, 0, 0, TYPE_HOPLITE);
    const neutral = spawnUnit(world, 20, 18, 0, 0, 255, TYPE_TREE);
    world.mode.fill(MODE_PRAYING, 1, world.count);
    const startingHp = Array.from(world.hp.subarray(0, world.count));

    for (let tick = 0; tick < 11; tick += 1) tickWorld(world);
    for (let index = 1; index < world.count; index += 1) {
      expect(world.hp[index]).toBe(startingHp[index]);
    }
    tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(21);
    expect(world.specialRecharge[0]).toBe(240);
    expect(world.hp[1]).toBeCloseTo(startingHp[1]! - 20 * 0.65 * 0.5, 10);
    expect(world.hp[2]).toBeLessThan(startingHp[2]!);
    expect(world.hp[3]).toBeLessThan(startingHp[3]!);
    expect(world.hp[3]).toBeGreaterThan(startingHp[3]! - 0.2);
    expect(world.hp[4]).toBe(startingHp[4]);
    expect(world.hp[5]).toBe(startingHp[5]);
    expect(myth).not.toBe(0);
    expect(hero).not.toBe(0);
    expect(ally).not.toBe(0);
    expect(neutral).not.toBe(0);
  });

  test("uses the single source melee clip for delayed clip-scaled damage", () => {
    const { world } = attackWorld();
    world.specialRecharge[0] = 1_000;
    const startingHp = world.hp[1]!;

    tickWorld(world);
    expect(world.meleeActionVariant[0]).toBe(0);
    expect(world.attackCooldown[0]).toBe(45);
    expect(world.hp[1]).toBe(startingHp);
    for (let tick = 1; tick < 12; tick += 1) tickWorld(world);
    tickWorld(world);

    expect(world.hp[1]).toBeCloseTo(
      startingHp -
        resolveMeleeCycleDamage(
          definition.attack,
          definition.attack.cycleVariants[0],
          UNIT_TYPES[TYPE_HOPLITE]!,
        ),
      10,
    );
  });

  test("keeps Whirlwind and single-cycle state deterministic", () => {
    const a = attackWorld().world;
    const b = attackWorld().world;
    for (let tick = 0; tick < 300; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
