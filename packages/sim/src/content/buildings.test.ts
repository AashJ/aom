import { describe, expect, test } from "bun:test";
import { COMMAND_GATHER, COMMAND_PLACE, enqueueCommand } from "../commands";
import { GOD_RA, GOD_ZEUS } from "../ecs/progression";
import { registerPlayer } from "../ecs/players";
import {
  createWorld,
  killUnit,
  MODE_GATHERING,
  MODE_IDLE,
  NEUTRAL_OWNER,
  spawnBuilding,
  spawnUnit,
  tickWorld,
  type World,
} from "../ecs/world";
import {
  FAVOR,
  GOLD,
  TYPE_EGYPTIAN_MONUMENT_TO_VILLAGERS,
  TYPE_GREEK_FARM,
  TYPE_GREEK_GATE,
  TYPE_GREEK_GRANARY,
  TYPE_GREEK_STOREHOUSE,
  TYPE_GREEK_TOWER,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_VILLAGER,
  TYPE_GREEK_WONDER,
  TYPE_SETTLEMENT,
  UNIT_TYPES,
  WOOD,
} from "../ecs/types";
import { VIS_VISIBLE } from "../visibility";
import { MAP_TILES } from "../terrain";
import { TERRAIN_DOMAIN_LAND } from "../maps";

function flatWorld(players: readonly { readonly id: number; readonly god: number }[]): World {
  const world = createWorld(2026, undefined, Math.max(2, players.length));
  for (const player of players) registerPlayer(world, player.id, player.god);
  world.walkable.fill(1);
  world.terrainDomains.fill(TERRAIN_DOMAIN_LAND);
  world.visibility.fill(VIS_VISIBLE);
  return world;
}

describe("Classic Greek and Egyptian buildings", () => {
  test("resource dropsites retain their authored resource classes", () => {
    expect(UNIT_TYPES[TYPE_GREEK_GRANARY]!.resourceDropsiteResources).toEqual([0]);
    expect(UNIT_TYPES[TYPE_GREEK_STOREHOUSE]!.resourceDropsiteResources).toEqual([WOOD, GOLD]);
  });

  test("a Town Center converts a neutral Settlement socket in place", () => {
    const world = flatWorld([{ id: 0, god: GOD_ZEUS }]);
    spawnBuilding(world, 50, 50, NEUTRAL_OWNER, TYPE_SETTLEMENT);
    spawnUnit(world, 48, 52, 0, 0, 0, TYPE_GREEK_VILLAGER);
    world.stockpiles[WOOD] = 300;
    world.stockpiles[GOLD] = 300;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_GREEK_TOWN_CENTER,
      tileX: 50,
      tileZ: 50,
    });
    tickWorld(world);

    expect(world.count).toBe(2);
    expect(world.unitType[0]).toBe(TYPE_GREEK_TOWN_CENTER);
    expect(world.owner[0]).toBe(0);
    expect(world.buildProgress[0]).toBe(0);
    expect(world.stockpiles[WOOD]).toBe(0);
    expect(world.stockpiles[GOLD]).toBe(0);
  });

  test("farms retain combat HP while yielding unlimited food to one worker", () => {
    const world = flatWorld([{ id: 0, god: GOD_ZEUS }]);
    spawnBuilding(world, 20, 20, 0, TYPE_GREEK_TOWN_CENTER);
    const farm = spawnBuilding(world, 30, 30, 0, TYPE_GREEK_FARM);
    const first = spawnUnit(world, 28, 31, 0, 0, 0, TYPE_GREEK_VILLAGER);
    const second = spawnUnit(world, 28, 32, 0, 0, 0, TYPE_GREEK_VILLAGER);
    const farmHp = UNIT_TYPES[TYPE_GREEK_FARM]!.maxHp;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [first, second],
      targetId: farm,
    });
    tickWorld(world);

    expect(world.mode[2]).toBe(MODE_GATHERING);
    expect(world.mode[3]).toBe(MODE_IDLE);
    for (let tick = 0; tick < 300; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(farmHp);
  });

  test("completed Egyptian monuments generate their exact passive Favor rate", () => {
    const world = flatWorld([{ id: 0, god: GOD_RA }]);
    spawnBuilding(world, 40, 40, 0, TYPE_EGYPTIAN_MONUMENT_TO_VILLAGERS);
    for (let tick = 0; tick < 207; tick += 1) tickWorld(world);
    expect(world.stockpiles[FAVOR]).toBe(1);
  });

  test("a completed Wonder wins after its uninterrupted authored countdown", () => {
    const world = flatWorld([
      { id: 0, god: GOD_ZEUS },
      { id: 1, god: GOD_RA },
    ]);
    const wonderType = TYPE_GREEK_WONDER;
    spawnBuilding(world, 30, 30, 0, wonderType);
    spawnUnit(world, 80, 80, 0, 0, 1, TYPE_GREEK_VILLAGER);
    world.contested = true;
    world.wonderVictoryProgress[0] = UNIT_TYPES[wonderType]!.wonderVictoryTicks! - 1;

    tickWorld(world);
    expect(world.winner).toBe(0);
  });

  test("gates open for friendly units, stay open while occupied, and close clear", () => {
    const world = flatWorld([{ id: 0, god: GOD_ZEUS }]);
    spawnBuilding(world, 50, 50, 0, TYPE_GREEK_GATE);
    spawnUnit(world, 49, 50.5, 0, 0, 0, TYPE_GREEK_VILLAGER);

    tickWorld(world);
    expect(world.gateOpen[0]).toBe(1);
    expect(world.walkable[50 * MAP_TILES + 52]).toBe(1);

    world.posX[1] = 40;
    world.posZ[1] = 40;
    tickWorld(world);
    expect(world.gateOpen[0]).toBe(0);
    expect(world.walkable[50 * MAP_TILES + 52]).toBe(0);
  });

  test("static defensive buildings acquire targets without moving", () => {
    const world = flatWorld([
      { id: 0, god: GOD_ZEUS },
      { id: 1, god: GOD_RA },
    ]);
    spawnBuilding(world, 50, 50, 0, TYPE_GREEK_TOWER);
    spawnUnit(world, 60, 50, 0, 0, 1, TYPE_GREEK_VILLAGER);
    world.contested = true;
    const initialHp = world.hp[1]!;

    for (let tick = 0; tick < 80; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBeLessThan(initialHp);
    expect(world.posX[0]).toBe(50.5);
    expect(world.posZ[0]).toBe(50.5);
  });

  test("destroying a Wonder resets its countdown", () => {
    const world = flatWorld([
      { id: 0, god: GOD_ZEUS },
      { id: 1, god: GOD_RA },
    ]);
    spawnBuilding(world, 30, 30, 0, TYPE_GREEK_WONDER);
    spawnUnit(world, 80, 80, 0, 0, 1, TYPE_GREEK_VILLAGER);
    world.contested = true;
    world.wonderVictoryProgress[0] = 500;
    killUnit(world, 0);

    tickWorld(world);
    expect(world.wonderVictoryProgress[0]).toBe(0);
  });
});
