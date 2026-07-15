import { describe, expect, test } from "bun:test";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import {
  beginProjectileAttack,
  NO_PROJECTILE_TICK,
  PROJECTILE_SLING_STONE,
  tickProjectileStore,
} from "../../../ecs/projectiles";
import { maximumProjectileBodyRadius } from "../../../ecs/unit-catalog-bounds";
import { createWorld, spawnUnit } from "../../../ecs/world";
import { rebuildUnitSpatialGrid } from "../../../ecs/spatial-grid";
import { AGE_CLASSICAL, NO_GOD } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import {
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_HOPLITE,
  TYPE_SLINGER,
  TYPE_SPEARMAN,
} from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
  type UnitTypeStats,
} from "../../unit-type-schema";
import { definition } from "./slinger";

describe("Egyptian Slinger unit pack", () => {
  test("pins the complete Classic projectile contract and producer slot", () => {
    expect(definition).toEqual({
      id: TYPE_SLINGER,
      key: "egyptian-slinger",
      label: "Slinger",
      culture: CULTURE_EGYPTIAN,
      classes:
        UNIT_CLASS_HUMAN | UNIT_CLASS_MILITARY | UNIT_CLASS_ARCHER | UNIT_CLASS_NON_GREEK_UNIT,
      maxHp: 65,
      lineOfSight: 20,
      movementSpeed: 4,
      armor: [0.15, 0.2, 0.99],
      attack: {
        kind: "projectile",
        damage: [0, 3, 0],
        range: 16,
        aggroRange: 20,
        cooldownTicks: 20,
        bonuses: [
          { target: { kind: "classes", classes: UNIT_CLASS_ARCHER }, multiplier: 4 },
          { target: { kind: "unit", key: "norse-throwing-axeman" }, multiplier: 3 },
          { target: { kind: "unit", key: "greek-hypaspist" }, multiplier: 1.25 },
          { target: { kind: "unit", key: "egyptian-axeman" }, multiplier: 1.25 },
        ],
        launchDelayTicks: 8,
        accuracy: 0.8,
        accuracyReductionFactor: 1.5,
        aimBonus: 15,
        spreadFactor: 0.25,
        maxSpread: 5,
        trackRating: 5,
        unintentionalDamageMultiplier: 0.3,
        projectile: {
          type: PROJECTILE_SLING_STONE,
          speed: 30,
          lifespanTicks: 40,
          collisionRadius: 0.1,
        },
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.49,
      collidesWithProjectiles: true,
      footprint: 0,
      costFood: 0,
      costWood: 60,
      costGold: 24,
      costFavor: 0,
      buildTicks: 14 * 20,
      populationCost: 2,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_CLASSICAL,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_EGYPTIAN_BARRACKS],
      trainedAt: [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 2 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("preserves its Classic ranged-soldier and three named counter bonuses", () => {
    const ordinaryTarget = {
      ...UNIT_TYPES[TYPE_HOPLITE]!,
      key: "ordinary-target",
      classes: UNIT_TYPES[TYPE_HOPLITE]!.classes & ~UNIT_CLASS_ARCHER,
    };
    const ordinaryDamage = resolveAttackDamage(definition.attack, ordinaryTarget);
    const targets = [
      { ...ordinaryTarget, classes: ordinaryTarget.classes | UNIT_CLASS_ARCHER },
      { ...ordinaryTarget, key: "norse-throwing-axeman" },
      { ...ordinaryTarget, key: "greek-hypaspist" },
      { ...ordinaryTarget, key: "egyptian-axeman" },
    ];

    expect(resolveAttackDamage(definition.attack, targets[0]!)).toBeCloseTo(ordinaryDamage * 4, 8);
    expect(resolveAttackDamage(definition.attack, targets[1]!)).toBeCloseTo(ordinaryDamage * 3, 8);
    expect(resolveAttackDamage(definition.attack, targets[2]!)).toBeCloseTo(
      ordinaryDamage * 1.25,
      8,
    );
    expect(resolveAttackDamage(definition.attack, targets[3]!)).toBeCloseTo(
      ordinaryDamage * 1.25,
      8,
    );
  });

  test("releases a sling-stone projectile on the authored animation tick", () => {
    const world = createWorld(128);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const sourceId = spawnUnit(world, 100, 100, 0, 0, 0, TYPE_HOPLITE);
    const targetId = spawnUnit(world, 110, 100, 0, 0, 1, TYPE_SPEARMAN);
    const unitTypes: (UnitTypeStats | undefined)[] = [...UNIT_TYPES];
    unitTypes[TYPE_HOPLITE] = { ...UNIT_TYPES[TYPE_HOPLITE]!, attack: definition.attack };
    const maxBodyRadius = maximumProjectileBodyRadius(unitTypes);
    const targetHp = world.hp[1]!;

    beginProjectileAttack(world, 0, 1, unitTypes);
    expect(world.projectiles.sourceIds[0]).toBe(sourceId);
    expect(world.projectiles.targetIds[0]).toBe(targetId);
    expect(world.projectiles.launchTicks[0]).toBe(8);
    expect(world.projectiles.impactTicks[0]).toBe(NO_PROJECTILE_TICK);
    expect(world.attackCooldown[0]).toBe(20);

    while (world.tick < 8) {
      world.tick += 1;
      rebuildUnitSpatialGrid(world);
      tickProjectileStore(
        world,
        world.projectiles,
        unitTypes,
        maxBodyRadius,
        (state, target, damage) => {
          state.hp[target] = Math.max(0, state.hp[target]! - damage);
        },
      );
    }

    expect(world.projectiles.count).toBe(1);
    expect(world.projectiles.impactTicks[0]).not.toBe(NO_PROJECTILE_TICK);
    expect(unitTypes[world.projectiles.sourceTypes[0]!]!.attack).toMatchObject({
      kind: "projectile",
      projectile: { type: PROJECTILE_SLING_STONE },
    });
    expect(world.hp[1]).toBe(targetHp);
  });
});
