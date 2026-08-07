import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { installAreaPoison } from "../../../ecs/poison-effects";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MINOTAUR,
  TYPE_SCORPION_MAN,
} from "../../unit-type-ids";
import { definition } from "./scorpion-man";

function attackWorld() {
  const world = createWorld(382);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const scorpion = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SCORPION_MAN);
  const target = spawnUnit(world, 20.5, 20, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [scorpion],
    targetId: target,
  });
  return { world, scorpion, target };
}

function tickThroughSpecialImpact(world: ReturnType<typeof createWorld>) {
  for (let tick = 0; tick < 12; tick += 1) tickWorld(world);
}

describe("Egyptian Scorpion Man unit pack", () => {
  test("matches the integration-owned Classic reference", () => {
    const reference = GATE_C_MYTH_UNIT_REFERENCES.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance and both variable ordinary attack clips", () => {
    expect(definition).toMatchObject({
      maxHp: 500,
      lineOfSight: 16,
      movementSpeed: 5,
      armor: [0.5, 0.4, 0.8],
      costWood: 150,
      costFavor: 25,
      buildTicks: 400,
      populationCost: 4,
      attack: {
        damage: [25, 0, 0],
        cycleVariants: [
          { actionTicks: 22, impactDelayTicks: 17 },
          { actionTicks: 26, impactDelayTicks: 20 },
        ],
      },
      specialAttack: {
        damage: [1.2, 0, 0],
        radius: 3,
        rechargeTicks: 240,
        actionTicks: 22,
        impactDelayTicks: 11,
        poisonDurationTicks: 300,
      },
    });
  });

  test("installs poison at the authored impact tag only on enemy humans", () => {
    const { world, target } = attackWorld();
    const secondHuman = spawnUnit(world, 22, 20, 0, 0, 1, TYPE_HOPLITE);
    const enemyMyth = spawnUnit(world, 21, 20, 0, 0, 1, TYPE_MINOTAUR);
    const enemyBuilding = spawnUnit(world, 21, 21, 0, 0, 1, TYPE_GREEK_HOUSE);
    const ally = spawnUnit(world, 19, 20, 0, 0, 0, TYPE_HOPLITE);
    const enemyVillager = spawnUnit(world, 20, 21, 0, 0, 1, TYPE_GREEK_VILLAGER);

    for (let tick = 0; tick < 11; tick += 1) tickWorld(world);
    expect(world.poisonEffects.count).toBe(0);
    tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(11);
    expect(world.specialRecharge[0]).toBe(240);
    expect(world.poisonEffects.count).toBe(2);
    expect(
      Array.from(world.poisonEffects.targetIds.subarray(0, world.poisonEffects.count)),
    ).toEqual([target, secondHuman]);
    expect(enemyMyth).not.toBe(0);
    expect(enemyBuilding).not.toBe(0);
    expect(ally).not.toBe(0);
    expect(enemyVillager).not.toBe(0);
  });

  test("deals exactly 18 raw damage over fifteen seconds and survives source death", () => {
    const { world } = attackWorld();
    tickThroughSpecialImpact(world);
    const targetStartHp = world.hp[1]!;
    const multiplier = world.poisonEffects.damageMultipliers[0]!;
    const armorMultiplier = 1 - UNIT_TYPES[TYPE_HOPLITE]!.armor[0];
    const expectedDamage = 18 * multiplier * armorMultiplier;
    const snapshot = createSnapshot(4);

    writeSnapshot(world, snapshot, 0);
    expect(snapshot.poisoned[1]).toBe(1);
    expect(snapshot.poisonElapsedTicks[1]).toBe(0);

    killUnit(world, 0);
    for (let tick = 0; tick < 300; tick += 1) tickWorld(world);

    expect(world.poisonEffects.count).toBe(0);
    expect(world.hp[0]).toBeCloseTo(targetStartHp - expectedDamage, 10);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.poisoned[0]).toBe(0);
  });

  test("stacks independent poison instances from multiple Scorpion Men", () => {
    const { world } = attackWorld();
    const second = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SCORPION_MAN);
    const special = definition.specialAttack;
    world.poisonEffects.count = 0;
    const startHp = world.hp[1]!;

    expect(installAreaPoison(world, world.poisonEffects, 0, special, UNIT_TYPES, 255)).toBe(1);
    expect(installAreaPoison(world, world.poisonEffects, 2, special, UNIT_TYPES, 255)).toBe(1);
    expect(second).not.toBe(0);
    tickWorld(world);

    const oneTickOneStack =
      (1.2 * world.poisonEffects.damageMultipliers[0]! * (1 - UNIT_TYPES[TYPE_HOPLITE]!.armor[0])) /
      20;
    expect(world.hp[1]).toBeCloseTo(startHp - oneTickOneStack * 2, 10);
    expect(world.poisonEffects.count).toBe(2);
  });

  test("keeps charged action, poison stacks, and damage deterministic", () => {
    const a = attackWorld().world;
    const b = attackWorld().world;
    for (let tick = 0; tick < 360; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
