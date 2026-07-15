import { describe, expect, test } from "bun:test";
import { COMMAND_TRAIN, enqueueCommand } from "../../../commands";
import { createSnapshot, writeProjectileSnapshot } from "../../../snapshot";
import { hashWorld } from "../../../hash";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { AGE_CLASSICAL, GOD_ZEUS } from "../../../ecs/progression";
import { beginProjectileAttack, NO_PROJECTILE_TICK } from "../../../ecs/projectiles";
import { createWorld, resolveId, spawnBuilding, spawnUnit, tickWorld } from "../../../ecs/world";
import { TRAIN_OPTIONS_BY_PRODUCER, UNIT_TYPES } from "../../generated/unit-types";
import { GOLD, WOOD } from "../../unit-type-schema";
import {
  TYPE_GREEK_ARCHERY_RANGE,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_HIPPIKON,
  TYPE_TOXOTES,
} from "../../unit-type-ids";
import { definition } from "./toxotes";

function createToxotesDuel() {
  const world = createWorld(81);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  world.walkable.fill(1);
  spawnUnit(world, 100, 100, 0, 0, 0, TYPE_TOXOTES);
  spawnBuilding(world, 107, 98, 1, TYPE_GREEK_TOWN_CENTER, true);
  return world;
}

function tickDeterministicPair(
  first: ReturnType<typeof createWorld>,
  second: ReturnType<typeof createWorld>,
): void {
  tickWorld(first);
  tickWorld(second);
  expect(hashWorld(first)).toBe(hashWorld(second));
}

describe("Greek Toxotes unit pack", () => {
  test("pins the complete Classic projectile contract and producer slot", () => {
    expect(definition).toMatchObject({
      id: TYPE_TOXOTES,
      key: "greek-toxotes",
      classes: 1042,
      maxHp: 60,
      lineOfSight: 19,
      movementSpeed: 4,
      armor: [0.15, 0.15, 0.99],
      costWood: 55,
      costGold: 35,
      buildTicks: 15 * 20,
      populationCost: 2,
      prerequisiteBuildings: [TYPE_GREEK_ARCHERY_RANGE],
      trainedAt: [{ type: TYPE_GREEK_ARCHERY_RANGE, commandSlot: 0 }],
      attack: {
        kind: "projectile",
        damage: [0, 6.5, 0],
        range: 15,
        cooldownTicks: 20,
        launchDelayTicks: 8,
        accuracy: 0.8,
        projectile: { speed: 30, lifespanTicks: 40, collisionRadius: 0.1 },
      },
    });
    expect(TRAIN_OPTIONS_BY_PRODUCER[TYPE_GREEK_ARCHERY_RANGE]).toEqual([
      { type: TYPE_TOXOTES, commandSlot: 0 },
    ]);
  });

  test("keeps the Classic exact-unit Raiding Cavalry modifier", () => {
    const ordinaryCavalry = UNIT_TYPES[TYPE_HIPPIKON]!;
    const raidingCavalry = { ...ordinaryCavalry, key: "norse-raiding-cavalry" };
    const ordinaryDamage = resolveAttackDamage(definition.attack, ordinaryCavalry);
    expect(resolveAttackDamage(definition.attack, raidingCavalry)).toBeCloseTo(
      ordinaryDamage * 0.9,
      8,
    );
  });

  test("trains authoritatively from a completed Greek Archery Range", () => {
    const world = createWorld(81);
    registerPlayer(world, 0, GOD_ZEUS);
    world.walkable.fill(1);
    world.playerAge[0] = AGE_CLASSICAL;
    world.stockpiles[WOOD] = 1_000;
    world.stockpiles[GOLD] = 1_000;
    const rangeId = spawnBuilding(world, 100, 100, 0, TYPE_GREEK_ARCHERY_RANGE, true);
    spawnBuilding(world, 120, 120, 0, TYPE_GREEK_TOWN_CENTER, true);

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: rangeId,
      unitType: TYPE_TOXOTES,
    });
    tickWorld(world);

    const range = resolveId(world, rangeId);
    expect(world.trainQueueLength[range]).toBe(1);
    expect(world.stockpiles[WOOD]).toBe(1_000 - definition.costWood);
    expect(world.stockpiles[GOLD]).toBe(1_000 - definition.costGold);

    for (let tick = 1; tick < definition.buildTicks; tick += 1) tickWorld(world);

    expect(world.count).toBe(3);
    expect(world.unitType[world.count - 1]).toBe(TYPE_TOXOTES);
    expect(world.trainQueueLength[range]).toBe(0);
  });

  test("runs release, flight, impact, and removal through the canonical deterministic tick", () => {
    const first = createToxotesDuel();
    const second = createToxotesDuel();
    beginProjectileAttack(first, 0, 1, UNIT_TYPES);
    beginProjectileAttack(second, 0, 1, UNIT_TYPES);

    expect(first.projectiles.launchTicks[0]).toBe(8);
    expect(first.attackCooldown[0]).toBe(20);
    expect(hashWorld(first)).toBe(hashWorld(second));

    const snapshot = createSnapshot(2, 2);
    while (first.tick < first.projectiles.launchTicks[0]!) {
      tickDeterministicPair(first, second);
      expect(first.projectiles.impactTicks[0]).toBe(NO_PROJECTILE_TICK);
    }
    writeProjectileSnapshot(first, snapshot, 0, UNIT_TYPES);
    expect(snapshot.projectileCount).toBe(0);

    tickDeterministicPair(first, second);
    writeProjectileSnapshot(first, snapshot, 0, UNIT_TYPES);
    expect(snapshot.projectileCount).toBe(1);
    expect(snapshot.projectileTypes[0]).toBe(definition.attack.projectile.type);

    const targetHpBeforeImpact = first.hp[1]!;
    const expectedDamage = resolveAttackDamage(
      definition.attack,
      UNIT_TYPES[TYPE_GREEK_TOWN_CENTER]!,
    );
    let flightTicks = 0;
    while (first.projectiles.count > 0) {
      expect(first.hp[1]).toBe(targetHpBeforeImpact);
      tickDeterministicPair(first, second);
      flightTicks += 1;
      expect(flightTicks).toBeLessThanOrEqual(definition.attack.projectile.lifespanTicks);
    }

    expect(flightTicks).toBeGreaterThan(1);
    expect(first.hp[1]).toBeCloseTo(targetHpBeforeImpact - expectedDamage, 8);
    writeProjectileSnapshot(first, snapshot, 0, UNIT_TYPES);
    expect(snapshot.projectileCount).toBe(0);
    expect(hashWorld(first)).toBe(hashWorld(second));
  });
});
