import { describe, expect, test } from "bun:test";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { AGE_MYTHIC, GOD_HADES } from "../../../ecs/progression";
import { beginProjectileAttack, PROJECTILE_ARROW } from "../../../ecs/projectiles";
import { createWorld, spawnUnit } from "../../../ecs/world";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_GASTRAPHETES, TYPE_GREEK_FORTRESS, TYPE_TOXOTES } from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MILITARY,
  type UnitTypeStats,
} from "../../unit-type-schema";
import { definition } from "./gastraphetes";

describe("Greek Gastraphetes unit pack", () => {
  test("pins the complete Classic projectile and Hades Fortress contract", () => {
    expect(definition).toEqual({
      id: TYPE_GASTRAPHETES,
      key: "greek-gastraphetes",
      label: "Gastraphetes",
      culture: CULTURE_GREEK,
      classes: UNIT_CLASS_HUMAN | UNIT_CLASS_MILITARY | UNIT_CLASS_ARCHER,
      maxHp: 60,
      lineOfSight: 28,
      movementSpeed: 3.8,
      armor: [0.15, 0.15, 0.99],
      attack: {
        kind: "projectile",
        damage: [0, 8, 6],
        range: 24,
        aggroRange: 28,
        cooldownTicks: 42,
        bonuses: [],
        launchDelayTicks: 7,
        accuracy: 0.6,
        accuracyReductionFactor: 1.5,
        aimBonus: 15,
        spreadFactor: 0.25,
        maxSpread: 5,
        trackRating: 5,
        unintentionalDamageMultiplier: 0.3,
        projectile: {
          type: PROJECTILE_ARROW,
          speed: 30,
          lifespanTicks: 2 * 20,
          collisionRadius: 0.1,
        },
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.49,
      collidesWithProjectiles: true,
      footprint: 0,
      costFood: 0,
      costWood: 120,
      costGold: 80,
      costFavor: 0,
      buildTicks: 14 * 20,
      populationCost: 3,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_MYTHIC,
      requiredGod: GOD_HADES,
      prerequisiteBuildings: [TYPE_GREEK_FORTRESS],
      trainedAt: [{ type: TYPE_GREEK_FORTRESS, commandSlot: 6 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("schedules the Classic crossbow release and full attack cycle", () => {
    const world = createWorld(83);
    registerPlayer(world, 0, GOD_HADES);
    registerPlayer(world, 1);
    world.walkable.fill(1);
    spawnUnit(world, 100, 100, 0, 0, 0, TYPE_TOXOTES);
    spawnUnit(world, 110, 100, 0, 0, 1, TYPE_TOXOTES);
    world.unitType[0] = TYPE_GASTRAPHETES;

    const unitTypes: (UnitTypeStats | undefined)[] = [...UNIT_TYPES];
    unitTypes[TYPE_GASTRAPHETES] = definition;
    beginProjectileAttack(world, 0, 1, unitTypes);

    expect(world.projectiles.launchTicks[0]).toBe(7);
    expect(world.projectiles.sourceTypes[0]).toBe(TYPE_GASTRAPHETES);
    expect(world.attackCooldown[0]).toBe(42);
    expect(resolveAttackDamage(definition.attack, UNIT_TYPES[TYPE_TOXOTES]!)).toBeCloseTo(6.86, 8);
  });
});
