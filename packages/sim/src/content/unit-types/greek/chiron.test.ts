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
import { GATE_C_UNIT_REFERENCES } from "../../unit-references/gate-c";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_CHIRON, TYPE_SPEARMAN, TYPE_TOXOTES } from "../../unit-type-ids";
import { UNIT_CLASS_HUMAN, UNIT_CLASS_MYTH, type UnitTypeStats } from "../../unit-type-schema";
import { definition } from "./chiron";

const reference = GATE_C_UNIT_REFERENCES.find((candidate) => candidate.key === definition.key);

function target(classes: number, armor: readonly [number, number, number]): UnitTypeStats {
  return {
    ...definition,
    id: 0,
    key: "test-target",
    label: "Test target",
    classes,
    hero: undefined,
    armor,
    attack: null,
  };
}

function createChironDuel() {
  const world = createWorld(105);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  world.walkable.fill(1);
  spawnUnit(world, 100, 100, 0, 0, 0, TYPE_TOXOTES);
  spawnUnit(world, 108, 100, 0, 0, 1, TYPE_SPEARMAN);
  world.unitType[0] = TYPE_CHIRON;
  world.hp[0] = definition.maxHp;
  world.projectiles = createProjectileStore(8);

  const unitTypes: (UnitTypeStats | undefined)[] = [...UNIT_TYPES];
  unitTypes[TYPE_CHIRON] = definition;
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

function tickProjectileDuel(state: ReturnType<typeof createChironDuel>): void {
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

describe("Chiron unit pack", () => {
  test("matches the integration-owned Classic candidate reference", () => {
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("authors the Greek hero and relic lifecycle instead of inferring it from identity", () => {
    expect(definition.hero).toEqual({
      trainLimit: 1,
      relicCapacity: 1,
      relicPickupRange: 1,
      relicDropOffRange: 1,
    });
  });

  test("applies the seven-times myth counter after target armor", () => {
    expect(
      resolveAttackDamage(definition.attack, target(UNIT_CLASS_HUMAN, [0, 0.2, 0])),
    ).toBeCloseTo(5.6, 8);
    expect(
      resolveAttackDamage(definition.attack, target(UNIT_CLASS_MYTH, [0, 0.2, 0])),
    ).toBeCloseTo(39.2, 8);
  });

  test("releases its arrow on the authored tag and resolves deterministic flight and impact", () => {
    const first = createChironDuel();
    const second = createChironDuel();
    beginProjectileAttack(first.world, 0, 1, first.unitTypes);
    beginProjectileAttack(second.world, 0, 1, second.unitTypes);

    expect(first.world.projectiles.launchTicks[0]).toBe(18);
    expect(first.world.attackCooldown[0]).toBe(30);
    expect(hashWorld(first.world)).toBe(hashWorld(second.world));

    while (first.world.tick < first.world.projectiles.launchTicks[0]!) {
      tickProjectileDuel(first);
      tickProjectileDuel(second);
      expect(hashWorld(first.world)).toBe(hashWorld(second.world));
    }

    expect(first.world.projectiles.impactTicks[0]).not.toBe(NO_PROJECTILE_TICK);
    const snapshot = createSnapshot(2, 2);
    writeProjectileSnapshot(first.world, snapshot, 0, first.unitTypes);
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
