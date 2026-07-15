import { describe, expect, test } from "bun:test";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeProjectileSnapshot } from "../../../snapshot";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import {
  NO_PROJECTILE_TICK,
  beginProjectileAttack,
  createProjectileStore,
  tickProjectileStore,
} from "../../../ecs/projectiles";
import { rebuildUnitSpatialGrid } from "../../../ecs/spatial-grid";
import { maximumProjectileBodyRadius } from "../../../ecs/unit-catalog-bounds";
import { createWorld, spawnUnit } from "../../../ecs/world";
import { UNIT_TYPES } from "../../generated/unit-types";
import {
  TYPE_GREEK_ARCHERY_RANGE,
  TYPE_HIPPIKON,
  TYPE_HOPLITE,
  TYPE_PELTAST,
  TYPE_SPEARMAN,
} from "../../unit-type-ids";
import { UNIT_CLASS_ARCHER, type UnitTypeStats } from "../../unit-type-schema";
import { definition } from "./peltast";

function createPeltastDuel() {
  const world = createWorld(82);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  world.walkable.fill(1);
  spawnUnit(world, 100, 100, 0, 0, 0, TYPE_HOPLITE);
  spawnUnit(world, 108, 100, 0, 0, 1, TYPE_SPEARMAN);
  world.unitType[0] = TYPE_PELTAST;
  world.hp[0] = definition.maxHp;
  world.projectiles = createProjectileStore(8);

  const unitTypes: (UnitTypeStats | undefined)[] = [...UNIT_TYPES];
  unitTypes[TYPE_PELTAST] = definition;
  return {
    world,
    unitTypes,
    maxProjectileBodyRadius: maximumProjectileBodyRadius(unitTypes),
  };
}

function applyDamage(
  world: ReturnType<typeof createWorld>,
  targetIndex: number,
  damage: number,
): void {
  world.hp[targetIndex] = Math.max(0, world.hp[targetIndex]! - damage);
}

function tickProjectileDuel(state: ReturnType<typeof createPeltastDuel>): void {
  state.world.tick += 1;
  rebuildUnitSpatialGrid(state.world);
  tickProjectileStore(
    state.world,
    state.world.projectiles,
    state.unitTypes,
    state.maxProjectileBodyRadius,
    applyDamage,
  );
}

describe("Greek Peltast unit pack", () => {
  test("pins the complete Classic projectile contract and producer slot", () => {
    expect(definition).toMatchObject({
      id: TYPE_PELTAST,
      key: "greek-peltast",
      classes: 1042,
      maxHp: 70,
      lineOfSight: 20,
      movementSpeed: 4,
      armor: [0.15, 0.2, 0.99],
      costWood: 60,
      costGold: 20,
      buildTicks: 9 * 20,
      populationCost: 2,
      prerequisiteBuildings: [TYPE_GREEK_ARCHERY_RANGE],
      trainedAt: [{ type: TYPE_GREEK_ARCHERY_RANGE, commandSlot: 1 }],
      attack: {
        kind: "projectile",
        damage: [0, 3, 0],
        range: 16,
        aggroRange: 20,
        cooldownTicks: 30,
        launchDelayTicks: 12,
        accuracy: 0.8,
        projectile: { type: 1, speed: 30, lifespanTicks: 40, collisionRadius: 0.1 },
      },
    });
  });

  test("stacks the Classic anti-archer and exact Throwing Axeman modifiers", () => {
    const ordinaryArcher = {
      ...UNIT_TYPES[TYPE_HIPPIKON]!,
      key: "test-ordinary-archer",
      classes: UNIT_CLASS_ARCHER,
      armor: [0, 0, 0] as const,
    };
    const throwingAxeman = { ...ordinaryArcher, key: "norse-throwing-axeman" };

    expect(resolveAttackDamage(definition.attack, ordinaryArcher)).toBe(12);
    expect(resolveAttackDamage(definition.attack, throwingAxeman)).toBe(24);
  });

  test("releases its spear on the authored tag and resolves deterministic flight and impact", () => {
    const first = createPeltastDuel();
    const second = createPeltastDuel();
    beginProjectileAttack(first.world, 0, 1, first.unitTypes);
    beginProjectileAttack(second.world, 0, 1, second.unitTypes);

    expect(first.world.projectiles.launchTicks[0]).toBe(12);
    expect(first.world.attackCooldown[0]).toBe(30);
    expect(hashWorld(first.world)).toBe(hashWorld(second.world));

    const snapshot = createSnapshot(2, 2);
    while (first.world.tick < first.world.projectiles.launchTicks[0]!) {
      tickProjectileDuel(first);
      tickProjectileDuel(second);
      expect(hashWorld(first.world)).toBe(hashWorld(second.world));
    }
    writeProjectileSnapshot(first.world, snapshot, 0, first.unitTypes);
    expect(first.world.projectiles.impactTicks[0]).not.toBe(NO_PROJECTILE_TICK);
    expect(snapshot.projectileCount).toBe(1);
    expect(snapshot.projectileTypes[0]).toBe(definition.attack.projectile.type);

    const targetHpBeforeImpact = first.world.hp[1]!;
    const expectedDamage = resolveAttackDamage(definition.attack, first.unitTypes[TYPE_SPEARMAN]!);
    let flightTicks = 0;
    while (first.world.projectiles.count > 0) {
      expect(first.world.hp[1]).toBe(targetHpBeforeImpact);
      tickProjectileDuel(first);
      tickProjectileDuel(second);
      expect(hashWorld(first.world)).toBe(hashWorld(second.world));
      flightTicks += 1;
      expect(flightTicks).toBeLessThanOrEqual(definition.attack.projectile.lifespanTicks);
    }

    expect(flightTicks).toBeGreaterThan(1);
    expect(first.world.hp[1]).toBeCloseTo(targetHpBeforeImpact - expectedDamage, 8);
    writeProjectileSnapshot(first.world, snapshot, 0, first.unitTypes);
    expect(snapshot.projectileCount).toBe(0);
  });
});
