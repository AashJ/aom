import { describe, expect, test } from "bun:test";
import { COMMAND_BUILD, COMMAND_GATHER, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, resolveId, spawnBuilding, spawnUnit, tickWorld } from "../../../ecs/world";
import { TERRAIN_DOMAIN_WATER } from "../../../maps";
import { FOOD, MOVEMENT_DOMAIN_WATER, UNIT_CLASS_SHIP } from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_EGYPTIAN_DOCK,
  TYPE_EGYPTIAN_FISHING_SHIP,
  TYPE_FISH_PERCH,
} from "../../unit-type-ids";
import { definition as dockDefinition } from "./dock";
import { definition } from "./fishing-ship";

function waterWorld(seed: number) {
  const world = createWorld(seed);
  world.walkable.fill(0);
  world.waterNavigable.fill(1);
  world.waterWalkable.fill(1);
  world.terrainDomains.fill(TERRAIN_DOMAIN_WATER);
  registerPlayer(world, 0);
  return world;
}

describe("Egyptian Fishing Ship unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = unitReferenceEntry(definition.key)!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins the Egyptian fishing and released Dock rows", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_SHIP,
      maxHp: 120,
      lineOfSight: 20,
      movementSpeed: 4.8,
      movementDomain: MOVEMENT_DOMAIN_WATER,
      workRange: 1,
      gather: { capacity: 25, ratePerSecond: 0.54 },
      construction: { range: 4, ratePerSecond: 0.28, baselineRatePerSecond: 0.99 },
      armor: [0.6, 0.5, 0.05],
      costWood: 50,
      buildTicks: 280,
      populationCost: 1,
    });
    expect(dockDefinition).toMatchObject({
      maxHp: 1600,
      lineOfSight: 22,
      armor: [0.3, 0.96, 0.2],
      costWood: 0,
      costGold: 50,
      buildTicks: 800,
      placementTerrain: "shoreline",
      resourceDropsiteDomain: MOVEMENT_DOMAIN_WATER,
      garrison: { capacity: 10 },
    });
  });

  test("gathers Fish at the Egyptian 0.54 food-per-second rate", () => {
    const world = waterWorld(480);
    const fish = spawnUnit(world, 40, 40, 0, 0, 255, TYPE_FISH_PERCH);
    const ship = spawnUnit(world, 40, 40, 0, 0, 0, TYPE_EGYPTIAN_FISHING_SHIP);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [ship],
      targetId: fish,
    });

    tickWorld(world);
    const shipIndex = resolveId(world, ship);
    expect(world.resourceCargo[shipIndex]).toBeCloseTo(0.27, 12);
    for (let tick = 0; tick < 10; tick += 1) tickWorld(world);
    expect(world.resourceCargo[shipIndex]).toBeCloseTo(0.54, 12);
    expect(world.hp[resolveId(world, fish)]).toBeCloseTo(999.46, 12);
  });

  test("constructs its authored Dock at range four and 0.28/0.99 Laborer speed", () => {
    const world = waterWorld(481);
    const dock = spawnBuilding(world, 20, 20, 0, TYPE_EGYPTIAN_DOCK, false);
    const ship = spawnUnit(world, 28, 22, 0, 0, 0, TYPE_EGYPTIAN_FISHING_SHIP);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_BUILD,
      unitIds: [ship],
      targetId: dock,
    });

    tickWorld(world);
    const dockIndex = resolveId(world, dock);
    expect(world.buildProgress[dockIndex]).toBeCloseTo((10 * 0.28) / 0.99, 12);
    expect(world.moving[resolveId(world, ship)]).toBe(0);

    const before = world.stockpiles[FOOD]!;
    for (let tick = 1; tick < 10; tick += 1) tickWorld(world);
    expect(world.buildProgress[dockIndex]).toBeCloseTo((10 * 0.28) / 0.99, 12);
    expect(world.stockpiles[FOOD]).toBe(before);
  });
});
