import { describe, expect, test } from "bun:test";
import {
  COMMAND_GARRISON,
  COMMAND_GATHER,
  COMMAND_MOVE,
  COMMAND_TRAIN,
  enqueueCommand,
} from "../../../commands";
import { hashWorld } from "../../../hash";
import { registerPlayer } from "../../../ecs/players";
import {
  canPlaceBuilding,
  createWorld,
  killUnit,
  resolveId,
  spawnBuilding,
  spawnUnit,
  tickWorld,
} from "../../../ecs/world";
import { MODE_RETURNING } from "../../../ecs/unit-tasks";
import { FOOD, MOVEMENT_DOMAIN_WATER, UNIT_CLASS_SHIP, WOOD } from "../../unit-type-schema";
import { TERRAIN_DOMAIN_LAND, TERRAIN_DOMAIN_WATER } from "../../../maps";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_FISH_PERCH,
  TYPE_GREEK_DOCK,
  TYPE_GREEK_FISHING_SHIP,
  TYPE_GREEK_TOWN_CENTER,
} from "../../unit-type-ids";
import { definition as dockDefinition } from "./dock";
import { definition } from "./fishing-ship";

function setup(seed = 338) {
  const world = createWorld(seed);
  world.walkable.fill(0);
  world.waterNavigable.fill(1);
  world.waterWalkable.fill(1);
  world.terrainDomains.fill(TERRAIN_DOMAIN_WATER);
  registerPlayer(world, 0);
  return world;
}

describe("Greek Fishing Ship unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = unitReferenceEntry(definition.key)!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins the Trial water, economy, and Dock rows", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_SHIP,
      maxHp: 120,
      lineOfSight: 20,
      movementSpeed: 4.8,
      movementDomain: MOVEMENT_DOMAIN_WATER,
      workRange: 1,
      gather: { capacity: 25, ratePerSecond: 0.61 },
      armor: [0.6, 0.5, 0.05],
      attack: null,
      costWood: 50,
      buildTicks: 280,
      populationCost: 1,
    });
    expect(dockDefinition).toMatchObject({
      maxHp: 1600,
      lineOfSight: 22,
      armor: [0.3, 0.96, 0.2],
      costWood: 125,
      buildTicks: 600,
      resourceDropsiteDomain: MOVEMENT_DOMAIN_WATER,
      garrison: { capacity: 10 },
    });
  });

  test("moves only over the authored water navigation mask", () => {
    const world = setup();
    world.waterNavigable.fill(0);
    world.waterWalkable.fill(0);
    world.waterNavigable[20 * 256 + 20] = 1;
    world.waterNavigable[20 * 256 + 21] = 1;
    world.waterWalkable[20 * 256 + 20] = 1;
    world.waterWalkable[20 * 256 + 21] = 1;
    const ship = spawnUnit(world, 20.5, 20.5, 0, 0, 0, TYPE_GREEK_FISHING_SHIP);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [ship],
      targetX: 21.5,
      targetZ: 20.5,
    });
    tickWorld(world);
    expect(world.moving[resolveId(world, ship)]).toBe(1);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [ship],
      targetX: 22.5,
      targetZ: 20.5,
    });
    tickWorld(world);
    expect(world.moveTargetX[resolveId(world, ship)]).toBe(21.5);
  });

  test("gathers fish at 0.61 food per second with fractional authoritative cargo", () => {
    const world = setup(339);
    const fish = spawnUnit(world, 40, 40, 0, 0, 255, TYPE_FISH_PERCH);
    const ship = spawnUnit(world, 40, 40, 0, 0, 0, TYPE_GREEK_FISHING_SHIP);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [ship],
      targetId: fish,
    });

    tickWorld(world);
    const index = resolveId(world, ship);
    expect(world.resourceCargo[index]).toBeCloseTo(0.305, 12);
    expect(world.carried[index]).toBe(0);
    for (let tick = 0; tick < 10; tick += 1) tickWorld(world);
    expect(world.resourceCargo[index]).toBeCloseTo(0.61, 12);
    expect(world.hp[resolveId(world, fish)]).toBeCloseTo(999.39, 12);
  });

  test("returns only to a water dropsite, deposits whole food, and keeps fractions hashed", () => {
    const world = setup(340);
    const dock = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_GREEK_DOCK);
    const townCenter = spawnUnit(world, 39, 40, 0, 0, 0, TYPE_GREEK_TOWN_CENTER);
    const fish = spawnUnit(world, 40, 40, 0, 0, 255, TYPE_FISH_PERCH);
    const ship = spawnUnit(world, 40, 40, 0, 0, 0, TYPE_GREEK_FISHING_SHIP);
    world.buildProgress[resolveId(world, dock)] = dockDefinition.buildTicks;
    world.buildProgress[resolveId(world, townCenter)] = 300;
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [ship],
      targetId: fish,
    });

    const index = resolveId(world, ship);
    for (let tick = 0; tick < 900 && world.mode[index] !== MODE_RETURNING; tick += 1) {
      tickWorld(world);
    }
    expect(world.mode[index]).toBe(MODE_RETURNING);
    expect(world.resourceCargo[index]).toBe(25);
    expect(world.unitField[index]?.goalCell).toBe(20 * 256 + 20);

    const before = world.stockpiles[FOOD]!;
    world.posX[index] = 20;
    world.posZ[index] = 20;
    tickWorld(world);
    expect(world.stockpiles[FOOD]).toBe(before + 25);
    expect(world.resourceCargo[index]).toBe(0);

    const first = setup(342);
    const second = setup(342);
    for (const candidate of [first, second]) {
      spawnUnit(candidate, 40, 40, 0, 0, 0, TYPE_GREEK_FISHING_SHIP);
      candidate.resourceCargo[0] = 0.305;
    }
    expect(hashWorld(first)).toBe(hashWorld(second));
    second.resourceCargo[0] = second.resourceCargo[0]! + Number.EPSILON;
    expect(hashWorld(first)).not.toBe(hashWorld(second));
  });

  test("uses the Dock's source harbor capacity and ejects into water on destruction", () => {
    const world = setup(341);
    const dock = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_GREEK_DOCK);
    const ship = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_GREEK_FISHING_SHIP);
    world.buildProgress[resolveId(world, dock)] = dockDefinition.buildTicks;
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [ship],
      targetId: dock,
    });
    tickWorld(world);
    expect(world.containedBy[resolveId(world, ship)]).toBe(dock);

    killUnit(world, resolveId(world, dock));
    tickWorld(world);
    const shipIndex = resolveId(world, ship);
    expect(shipIndex).toBeGreaterThanOrEqual(0);
    expect(world.containedBy[shipIndex]).toBe(0xffff_ffff);
    expect(
      world.waterWalkable[
        Math.floor(world.posZ[shipIndex]!) * 256 + Math.floor(world.posX[shipIndex]!)
      ],
    ).toBe(1);
  });

  test("requires a free mixed shoreline and restores both terrain domains after destruction", () => {
    const world = setup(343);
    world.walkable.fill(0);
    world.waterWalkable.fill(1);
    world.terrainDomains.fill(TERRAIN_DOMAIN_WATER);

    for (let z = 20; z < 24; z += 1) {
      for (let x = 20; x < 22; x += 1) {
        const cell = z * 256 + x;
        world.walkable[cell] = 1;
        world.waterWalkable[cell] = 0;
        world.terrainDomains[cell] = TERRAIN_DOMAIN_LAND;
      }
    }

    expect(canPlaceBuilding(world, 30, 30, TYPE_GREEK_DOCK)).toBe(false);
    expect(canPlaceBuilding(world, 20, 20, TYPE_GREEK_DOCK)).toBe(true);
    const dock = spawnBuilding(world, 20, 20, 0, TYPE_GREEK_DOCK, true);

    for (let z = 20; z < 24; z += 1) {
      for (let x = 20; x < 24; x += 1) {
        const cell = z * 256 + x;
        expect(world.walkable[cell]).toBe(0);
        expect(world.waterWalkable[cell]).toBe(0);
      }
    }

    killUnit(world, resolveId(world, dock));
    tickWorld(world);
    expect(world.walkable[20 * 256 + 20]).toBe(1);
    expect(world.waterWalkable[20 * 256 + 20]).toBe(0);
    expect(world.walkable[20 * 256 + 23]).toBe(0);
    expect(world.waterWalkable[20 * 256 + 23]).toBe(1);
  });

  test("trains into the produced ship's water domain", () => {
    const world = setup(344);
    world.walkable.fill(1);
    world.waterWalkable.fill(0);
    world.terrainDomains.fill(TERRAIN_DOMAIN_LAND);
    for (let z = 20; z < 40; z += 1) {
      for (let x = 22; x < 40; x += 1) {
        const cell = z * 256 + x;
        world.walkable[cell] = 0;
        world.waterWalkable[cell] = 1;
        world.terrainDomains[cell] = TERRAIN_DOMAIN_WATER;
      }
    }
    const dock = spawnBuilding(world, 20, 20, 0, TYPE_GREEK_DOCK, true);
    spawnBuilding(world, 100, 100, 0, TYPE_GREEK_TOWN_CENTER, true);
    world.stockpiles[WOOD] = 1_000;
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: dock,
      unitType: TYPE_GREEK_FISHING_SHIP,
    });

    for (let tick = 0; tick <= definition.buildTicks; tick += 1) tickWorld(world);
    const ship = world.count - 1;
    const cell = Math.floor(world.posZ[ship]!) * 256 + Math.floor(world.posX[ship]!);
    expect(world.unitType[ship]).toBe(TYPE_GREEK_FISHING_SHIP);
    expect(world.waterWalkable[cell]).toBe(1);
    expect(world.walkable[cell]).toBe(0);
  });
});
