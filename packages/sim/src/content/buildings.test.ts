import { describe, expect, test } from "bun:test";
import { COMMAND_GATHER, COMMAND_PLACE, enqueueCommand } from "../commands";
import { AGE_HEROIC, GOD_RA, GOD_ZEUS } from "../ecs/progression";
import { registerPlayer } from "../ecs/players";
import {
  createWorld,
  killUnit,
  MODE_GATHERING,
  MODE_IDLE,
  NEUTRAL_OWNER,
  SETTLEMENT_VICTORY_TICKS,
  spawnBuilding,
  spawnUnit,
  tickWorld,
  type World,
} from "../ecs/world";
import {
  BUILD_OPTIONS_BY_WORKER,
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
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
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_WONDER,
  TYPE_SETTLEMENT,
  UNIT_CLASS_BUILDING,
  UNIT_TYPES,
  WOOD,
} from "../ecs/types";
import { VIS_VISIBLE } from "../visibility";
import { MAP_TILES } from "../terrain";
import { TERRAIN_DOMAIN_LAND } from "../maps";
import {
  CLASSIC_BUILDING_ROSTER,
  EGYPTIAN_BUILDING_ROSTER,
  GREEK_BUILDING_ROSTER,
} from "./building-roster";

function flatWorld(players: readonly { readonly id: number; readonly god: number }[]): World {
  const world = createWorld(2026, undefined, Math.max(2, players.length));
  for (const player of players) registerPlayer(world, player.id, player.god);
  world.walkable.fill(1);
  world.terrainDomains.fill(TERRAIN_DOMAIN_LAND);
  world.visibility.fill(VIS_VISIBLE);
  return world;
}

describe("Classic Greek and Egyptian buildings", () => {
  test("the complete 20-Greek and 27-Egyptian proto roster is implemented once", () => {
    expect(GREEK_BUILDING_ROSTER).toHaveLength(20);
    expect(EGYPTIAN_BUILDING_ROSTER).toHaveLength(27);
    expect(new Set(CLASSIC_BUILDING_ROSTER.map((entry) => entry.id)).size).toBe(47);

    for (const entry of CLASSIC_BUILDING_ROSTER) {
      const stats = UNIT_TYPES[entry.id];
      expect(stats, entry.protoName).toBeDefined();
      expect(stats!.culture).toBe(entry.culture);
      expect(stats!.classes & UNIT_CLASS_BUILDING).not.toBe(0);
      expect(stats!.builtBy.length).toBeGreaterThan(0);
      for (const relationship of stats!.builtBy) {
        expect(BUILD_OPTIONS_BY_WORKER[relationship.type]).toContainEqual({
          type: entry.id,
          commandSlot: relationship.commandSlot,
        });
      }
    }

    const implementedCultureBuildings = UNIT_TYPES.flatMap((stats) =>
      stats &&
      (stats.culture === CULTURE_GREEK || stats.culture === CULTURE_EGYPTIAN) &&
      (stats.classes & UNIT_CLASS_BUILDING) !== 0 &&
      stats.footprint > 0
        ? [stats.id]
        : [],
    ).sort((left, right) => left - right);
    expect(implementedCultureBuildings).toEqual(
      CLASSIC_BUILDING_ROSTER.map((entry) => entry.id).sort((left, right) => left - right),
    );
  });

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

  test("destroying a Town Center restores its neutral Settlement socket", () => {
    const world = flatWorld([{ id: 0, god: GOD_ZEUS }]);
    spawnBuilding(world, 50, 50, 0, TYPE_GREEK_TOWN_CENTER);
    killUnit(world, 0, true);

    tickWorld(world);

    expect(world.count).toBe(1);
    expect(world.unitType[0]).toBe(TYPE_SETTLEMENT);
    expect(world.owner[0]).toBe(NEUTRAL_OWNER);
    expect(world.posX[0]).toBe(52.5);
    expect(world.posZ[0]).toBe(52.5);
    expect(world.walkable[52 * MAP_TILES + 52]).toBe(0);
  });

  test("the proto one-Town-Center cap unlocks expansion Settlements in Heroic", () => {
    const world = flatWorld([{ id: 0, god: GOD_ZEUS }]);
    spawnBuilding(world, 20, 20, 0, TYPE_GREEK_TOWN_CENTER);
    spawnBuilding(world, 50, 50, NEUTRAL_OWNER, TYPE_SETTLEMENT);
    spawnBuilding(world, 70, 70, NEUTRAL_OWNER, TYPE_SETTLEMENT);
    spawnUnit(world, 48, 52, 0, 0, 0, TYPE_GREEK_VILLAGER);
    world.stockpiles[WOOD] = 600;
    world.stockpiles[GOLD] = 600;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_GREEK_TOWN_CENTER,
      tileX: 50,
      tileZ: 50,
    });
    tickWorld(world);
    expect(world.unitType[1]).toBe(TYPE_SETTLEMENT);

    world.playerAge[0] = AGE_HEROIC;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_GREEK_TOWN_CENTER,
      tileX: 50,
      tileZ: 50,
    });
    tickWorld(world);
    expect(world.unitType[1]).toBe(TYPE_GREEK_TOWN_CENTER);
    expect(world.owner[1]).toBe(0);
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

  test("claiming every Settlement wins after the Classic two-minute countdown", () => {
    const world = flatWorld([
      { id: 0, god: GOD_ZEUS },
      { id: 1, god: GOD_RA },
    ]);
    spawnBuilding(world, 20, 20, 0, TYPE_GREEK_TOWN_CENTER);
    spawnBuilding(world, 50, 50, 0, TYPE_GREEK_TOWN_CENTER);
    spawnUnit(world, 80, 80, 0, 0, 1, TYPE_GREEK_VILLAGER);
    world.contested = true;
    world.settlementVictoryProgress[0] = SETTLEMENT_VICTORY_TICKS - 1;

    tickWorld(world);

    expect(world.winner).toBe(0);
  });

  test("an unclaimed Settlement resets the ownership victory countdown", () => {
    const world = flatWorld([
      { id: 0, god: GOD_ZEUS },
      { id: 1, god: GOD_RA },
    ]);
    spawnBuilding(world, 20, 20, 0, TYPE_GREEK_TOWN_CENTER);
    spawnBuilding(world, 50, 50, NEUTRAL_OWNER, TYPE_SETTLEMENT);
    spawnUnit(world, 80, 80, 0, 0, 1, TYPE_GREEK_VILLAGER);
    world.contested = true;
    world.settlementVictoryProgress[0] = 400;

    tickWorld(world);

    expect(world.settlementVictoryProgress[0]).toBe(0);
    expect(world.winner).toBe(-1);
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

  test("rectangular wall pieces place and obstruct in either rotation", () => {
    const world = flatWorld([{ id: 0, god: GOD_ZEUS }]);
    spawnUnit(world, 22, 28, 0, 0, 0, TYPE_GREEK_VILLAGER);
    world.stockpiles[GOLD] = UNIT_TYPES[TYPE_GREEK_WALL_LONG]!.costGold;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_GREEK_WALL_LONG,
      tileX: 20,
      tileZ: 30,
      rotation: 1,
    });
    tickWorld(world);

    expect(world.count).toBe(2);
    expect(world.posX[1]).toBe(20.5);
    expect(world.posZ[1]).toBe(32.5);
    expect(world.facingX[1]).toBe(1);
    for (let z = 30; z < 35; z += 1) {
      expect(world.walkable[z * MAP_TILES + 20]).toBe(0);
    }
    expect(world.walkable[30 * MAP_TILES + 21]).toBe(1);
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
