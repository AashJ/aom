import { describe, expect, test } from "bun:test";
import { COMMAND_RESEARCH, enqueueCommand } from "./commands";
import {
  attackDamageMultiplierForPlayer,
  closeAttackForPlayer,
  effectiveLineOfSightForPlayer,
  effectiveMaxHpForPlayer,
  effectivePopBonusForPlayer,
  primaryAttackForPlayer,
  projectileTrackRatingForPlayer,
} from "./ecs/building-technology-effects";
import { registerPlayer } from "./ecs/players";
import {
  AGE_CLASSICAL,
  AGE_HEROIC,
  AGE_MYTHIC,
  GOD_ISIS,
  GOD_RA,
  GOD_ZEUS,
} from "./ecs/progression";
import {
  RESEARCH_ARCHITECTS,
  RESEARCH_BALLISTA_TOWER,
  RESEARCH_BOILING_OIL,
  RESEARCH_CARRIER_PIGEONS,
  RESEARCH_CITADEL_WALL,
  RESEARCH_CRENELLATIONS,
  RESEARCH_FORTIFIED_TOWN_CENTER,
  RESEARCH_FORTIFIED_WALL,
  RESEARCH_GUARD_TOWER,
  RESEARCH_MASONS,
  RESEARCH_SIGNAL_FIRES,
  RESEARCH_STONE_WALL,
  RESEARCH_WATCH_TOWER,
  getTechnology,
  setTechnology,
} from "./ecs/technologies";
import {
  FOOD,
  GOLD,
  TYPE_EGYPTIAN_TOWER,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_TOWER,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_WALL_MEDIUM,
  UNIT_TYPES,
  WOOD,
} from "./ecs/types";
import { createWorld, killUnit, resolveId, spawnBuilding, tickWorld } from "./ecs/world";
import { hashWorld } from "./hash";

function technologyWorld(majorGod = GOD_ZEUS) {
  const world = createWorld(91);
  registerPlayer(world, 0, majorGod);
  world.walkable.fill(1);
  world.playerAge[0] = AGE_MYTHIC;
  world.stockpiles[FOOD] = 10_000;
  world.stockpiles[WOOD] = 10_000;
  world.stockpiles[GOLD] = 10_000;
  return world;
}

function beginResearch(
  world: ReturnType<typeof technologyWorld>,
  buildingId: number,
  researchId: number,
) {
  enqueueCommand(world, {
    tick: world.tick,
    issuer: 0,
    type: COMMAND_RESEARCH,
    buildingId,
    researchId,
  });
  tickWorld(world);
}

describe("Greek and Egyptian building technologies", () => {
  test("research occupies its producer, pays the Classic cost, completes, and hashes", () => {
    const world = technologyWorld();
    const towerId = spawnBuilding(world, 40, 40, 0, TYPE_GREEK_TOWER, true);
    const tower = resolveId(world, towerId);
    const beforeHash = hashWorld(world);

    beginResearch(world, towerId, RESEARCH_WATCH_TOWER);
    expect(world.stockpiles[WOOD]).toBe(9_800);
    expect(world.stockpiles[GOLD]).toBe(9_900);
    expect(world.researchId[tower]).toBe(RESEARCH_WATCH_TOWER);
    expect(hashWorld(world)).not.toBe(beforeHash);

    world.researchRemaining[tower] = 1;
    tickWorld(world);
    expect(world.playerResearch[RESEARCH_WATCH_TOWER]).toBe(1);
    expect(world.researchId[tower]).toBe(255);
  });

  test("rejects forged producer, age, prerequisite, duplicate, and unaffordable orders", () => {
    const world = technologyWorld();
    const house = spawnBuilding(world, 30, 30, 0, TYPE_GREEK_HOUSE, true);
    const tower = spawnBuilding(world, 40, 40, 0, TYPE_GREEK_TOWER, true);

    beginResearch(world, house, RESEARCH_WATCH_TOWER);
    expect(world.playerResearch[RESEARCH_WATCH_TOWER]).toBe(0);

    world.playerAge[0] = AGE_CLASSICAL;
    beginResearch(world, tower, RESEARCH_GUARD_TOWER);
    expect(world.playerResearch[RESEARCH_GUARD_TOWER]).toBe(0);

    world.stockpiles[WOOD] = 0;
    beginResearch(world, tower, RESEARCH_WATCH_TOWER);
    expect(world.researchId[resolveId(world, tower)]).toBe(255);
  });

  test("refunds the exact Isis-discounted cost when a producer is destroyed", () => {
    const world = technologyWorld(GOD_ISIS);
    const towerId = spawnBuilding(world, 40, 40, 0, TYPE_EGYPTIAN_TOWER, true);
    setTechnology(world.playerResearch, 0, RESEARCH_WATCH_TOWER);

    beginResearch(world, towerId, RESEARCH_GUARD_TOWER);
    expect(world.stockpiles[WOOD]).toBe(9_730);
    expect(world.stockpiles[GOLD]).toBe(9_730);

    killUnit(world, resolveId(world, towerId));
    tickWorld(world);
    expect(world.stockpiles[WOOD]).toBe(10_000);
    expect(world.stockpiles[GOLD]).toBe(10_000);
  });

  test("tower line unlocks attacks and applies Watch, Guard, and Ballista stats", () => {
    const greek = technologyWorld();
    const greekStats = UNIT_TYPES[TYPE_GREEK_TOWER]!;
    expect(primaryAttackForPlayer(greek, 0, greekStats)).toBeNull();

    setTechnology(greek.playerResearch, 0, RESEARCH_WATCH_TOWER);
    expect(primaryAttackForPlayer(greek, 0, greekStats)).toBe(greekStats.attack);
    expect(effectiveMaxHpForPlayer(greek, 0, greekStats)).toBe(550);
    expect(attackDamageMultiplierForPlayer(greek, 0, greekStats)).toBe(1);

    setTechnology(greek.playerResearch, 0, RESEARCH_GUARD_TOWER);
    expect(effectiveMaxHpForPlayer(greek, 0, greekStats)).toBe(850);
    expect(attackDamageMultiplierForPlayer(greek, 0, greekStats)).toBeCloseTo(1.7);

    const egyptian = technologyWorld(GOD_RA);
    const egyptianStats = UNIT_TYPES[TYPE_EGYPTIAN_TOWER]!;
    setTechnology(egyptian.playerResearch, 0, RESEARCH_WATCH_TOWER);
    setTechnology(egyptian.playerResearch, 0, RESEARCH_GUARD_TOWER);
    setTechnology(egyptian.playerResearch, 0, RESEARCH_BALLISTA_TOWER);
    expect(effectiveMaxHpForPlayer(egyptian, 0, egyptianStats)).toBe(1_150);
    expect(attackDamageMultiplierForPlayer(egyptian, 0, egyptianStats)).toBeCloseTo(2.2);
  });

  test("wall tiers and structural technologies preserve Classic HP", () => {
    const world = technologyWorld();
    const wallStats = UNIT_TYPES[TYPE_GREEK_WALL_MEDIUM]!;
    const houseStats = UNIT_TYPES[TYPE_GREEK_HOUSE]!;

    expect(effectiveMaxHpForPlayer(world, 0, wallStats)).toBe(600);
    setTechnology(world.playerResearch, 0, RESEARCH_STONE_WALL);
    expect(effectiveMaxHpForPlayer(world, 0, wallStats)).toBe(1_200);
    setTechnology(world.playerResearch, 0, RESEARCH_FORTIFIED_WALL);
    expect(effectiveMaxHpForPlayer(world, 0, wallStats)).toBe(1_800);
    setTechnology(world.playerResearch, 0, RESEARCH_CITADEL_WALL);
    expect(effectiveMaxHpForPlayer(world, 0, wallStats)).toBe(2_400);

    setTechnology(world.playerResearch, 0, RESEARCH_MASONS);
    setTechnology(world.playerResearch, 0, RESEARCH_ARCHITECTS);
    expect(effectiveMaxHpForPlayer(world, 0, houseStats)).toBe(houseStats.maxHp * 1.5);
  });

  test("vision, crenellations, boiling oil, and fortified Town Center effects are gated", () => {
    const world = technologyWorld();
    const towerStats = UNIT_TYPES[TYPE_GREEK_TOWER]!;
    const townCenterStats = UNIT_TYPES[TYPE_GREEK_TOWN_CENTER]!;
    expect(getTechnology(RESEARCH_FORTIFIED_TOWN_CENTER)?.requiredAge).toBe(AGE_HEROIC);

    expect(effectiveLineOfSightForPlayer(world, 0, towerStats)).toBe(24);
    setTechnology(world.playerResearch, 0, RESEARCH_SIGNAL_FIRES);
    setTechnology(world.playerResearch, 0, RESEARCH_CARRIER_PIGEONS);
    expect(effectiveLineOfSightForPlayer(world, 0, towerStats)).toBe(36);

    expect(closeAttackForPlayer(world, 0, towerStats)).toBeUndefined();
    setTechnology(world.playerResearch, 0, RESEARCH_BOILING_OIL);
    expect(closeAttackForPlayer(world, 0, towerStats)).toBe(towerStats.closeAttack);
    setTechnology(world.playerResearch, 0, RESEARCH_CRENELLATIONS);
    expect(projectileTrackRatingForPlayer(world, 0, TYPE_GREEK_TOWER, 5)).toBe(10);

    setTechnology(world.playerResearch, 0, RESEARCH_FORTIFIED_TOWN_CENTER);
    expect(effectiveMaxHpForPlayer(world, 0, townCenterStats)).toBe(3_500);
    expect(effectivePopBonusForPlayer(world, 0, townCenterStats)).toBe(20);
    expect(attackDamageMultiplierForPlayer(world, 0, townCenterStats)).toBe(1.5);
  });
});
