import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, COMMAND_TRAIN, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { AGE_MYTHIC, GOD_RA, GOD_THOTH } from "../../../ecs/progression";
import {
  createWorld,
  killUnit,
  resolveId,
  spawnBuilding,
  spawnUnit,
  tickWorld,
} from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_EGYPTIAN_HOUSE,
  TYPE_GREEK_HOUSE,
  TYPE_HOPLITE,
  TYPE_PEGASUS,
  TYPE_PHOENIX,
  TYPE_PHOENIX_EGG,
  TYPE_TREE,
} from "../../unit-type-ids";
import {
  FAVOR,
  GOLD,
  MOVEMENT_DOMAIN_AIR,
  UNIT_CLASS_AIR,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
} from "../../unit-type-schema";
import { definition as eggDefinition } from "./phoenix-egg";
import { definition } from "./phoenix";

function findType(world: ReturnType<typeof createWorld>, type: number): number {
  return (
    Array.from({ length: world.count }, (_, index) => index).find(
      (index) => world.unitType[index] === type,
    ) ?? -1
  );
}

describe("Egyptian Phoenix and Phoenix Egg unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins the launch Phoenix, Egg, and fire-spread rows", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_MYTH | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE | UNIT_CLASS_AIR,
      maxHp: 400,
      lineOfSight: 20,
      movementSpeed: 3.6,
      movementDomain: MOVEMENT_DOMAIN_AIR,
      armor: [0.15, 0.55, 0.8],
      costGold: 200,
      costFavor: 30,
      buildTicks: 120,
      populationCost: 5,
      attack: {
        damage: [30, 0, 30],
        range: 4,
        cooldownTicks: 54,
        canTargetAir: true,
        impactArea: { radius: 3, falloff: "constant" },
        cycleVariants: [{ actionTicks: 54, impactDelayTicks: 43 }],
      },
      deathReplacement: {
        unitType: TYPE_PHOENIX_EGG,
        requireNavigableOrigin: true,
      },
    });
    expect(eggDefinition).toMatchObject({
      maxHp: 300,
      lineOfSight: 4,
      movementSpeed: 0,
      armor: [0.15, 0.55, 0.99],
      populationCost: 0,
      trainingSite: {
        consumeOnCompletion: true,
        substitutesForPrerequisites: true,
      },
    });
  });

  test("attacks air and resolves launch crush friendly fire separately from hack splash", () => {
    const world = createWorld(771);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const phoenix = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PHOENIX);
    const airborneTarget = spawnUnit(world, 24, 20, 0, 0, 1, TYPE_PEGASUS);
    const enemy = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    const ally = spawnUnit(world, 24, 21, 0, 0, 0, TYPE_HOPLITE);
    const gaiaUnit = spawnUnit(world, 24, 22, 0, 0, 255, TYPE_TREE);
    const gaiaBuilding = spawnUnit(world, 24, 23, 0, 0, 255, TYPE_GREEK_HOUSE);
    const ids = [airborneTarget, enemy, ally, gaiaUnit, gaiaBuilding];
    const hp = new Map(ids.map((id) => [id, world.hp[resolveId(world, id)]!] as const));

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [phoenix],
      targetId: airborneTarget,
    });
    for (
      let tick = 0;
      tick < 60 && world.hp[resolveId(world, airborneTarget)] === hp.get(airborneTarget);
      tick += 1
    ) {
      tickWorld(world);
    }

    expect(world.attackTarget[resolveId(world, phoenix)]).toBe(airborneTarget);
    expect(world.hp[resolveId(world, airborneTarget)]).toBeLessThan(hp.get(airborneTarget)!);
    expect(world.hp[resolveId(world, enemy)]).toBeLessThan(hp.get(enemy)!);
    expect(world.hp[resolveId(world, ally)]).toBeLessThan(hp.get(ally)!);
    expect(world.hp[resolveId(world, gaiaUnit)]).toBeLessThan(hp.get(gaiaUnit)!);
    expect(world.hp[resolveId(world, gaiaBuilding)]).toBeLessThan(hp.get(gaiaBuilding)!);
    // The landed hand attack applies Classic's three-second melee snare.
    expect(world.meleeSnareRemaining[resolveId(world, airborneTarget)]).toBeGreaterThan(0);
  });

  test("creates an Egg only when death occurs directly above navigable land", () => {
    const land = createWorld(772);
    land.walkable.fill(1);
    registerPlayer(land, 0);
    const phoenix = spawnUnit(land, 30, 30, 0, 0, 0, TYPE_PHOENIX);
    killUnit(land, resolveId(land, phoenix), true);
    tickWorld(land);
    expect(findType(land, TYPE_PHOENIX_EGG)).toBeGreaterThanOrEqual(0);

    const water = createWorld(773);
    water.walkable.fill(0);
    registerPlayer(water, 0);
    const drowned = spawnUnit(water, 30, 30, 0, 0, 0, TYPE_PHOENIX);
    killUnit(water, resolveId(water, drowned), true);
    tickWorld(water);
    expect(findType(water, TYPE_PHOENIX_EGG)).toBe(-1);
  });

  test("Egg charges the full Temple cost, trains once without a Temple, then disappears", () => {
    const world = createWorld(774);
    world.walkable.fill(1);
    registerPlayer(world, 0, GOD_RA);
    world.playerAge[0] = AGE_MYTHIC;
    world.playerMinorGods[AGE_MYTHIC] = GOD_THOTH;
    world.stockpiles[GOLD] = 1_000;
    world.stockpiles[FAVOR] = 100;
    spawnBuilding(world, 8, 8, 0, TYPE_EGYPTIAN_HOUSE, true);
    const egg = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PHOENIX_EGG);

    for (let order = 0; order < 2; order += 1) {
      enqueueCommand(world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_TRAIN,
        buildingId: egg,
        unitType: TYPE_PHOENIX,
      });
    }
    for (let tick = 0; tick < definition.buildTicks; tick += 1) tickWorld(world);

    expect(resolveId(world, egg)).toBe(-1);
    expect(findType(world, TYPE_PHOENIX)).toBeGreaterThanOrEqual(0);
    expect(world.stockpiles[GOLD]).toBe(800);
    expect(world.stockpiles[FAVOR]).toBe(70);
    expect(
      Array.from({ length: world.count }, (_, index) => world.unitType[index]).filter(
        (type) => type === TYPE_PHOENIX,
      ),
    ).toHaveLength(1);
  });
});
