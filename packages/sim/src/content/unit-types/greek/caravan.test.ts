import { describe, expect, test } from "bun:test";
import { COMMAND_TRADE, enqueueCommand } from "../../../commands";
import { hashWorld } from "../../../hash";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { MODE_TRADING_TO_MARKET, MODE_TRADING_TO_TOWN_CENTER } from "../../../ecs/unit-tasks";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GOLD, UNIT_CLASS_CARAVAN } from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_GREEK_CARAVAN,
  TYPE_GREEK_MARKET,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_HOPLITE,
} from "../../unit-type-ids";
import { definition } from "./caravan";

function setup(seed = 493) {
  const world = createWorld(seed);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  return world;
}

function complete(world: ReturnType<typeof setup>, id: number): number {
  const index = resolveId(world, id);
  world.buildProgress[index] = UNIT_TYPES[world.unitType[index]!]!.buildTicks;
  return index;
}

describe("Greek Donkey Caravan unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = unitReferenceEntry(definition.key)!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins the Trial caravan and trade-action rows", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_CARAVAN,
      maxHp: 115,
      lineOfSight: 16,
      movementSpeed: 3.8,
      armor: [0.4, 0.4, 0.99],
      attack: null,
      costFood: 100,
      buildTicks: 300,
      populationCost: 1,
      trade: {
        capacity: 1000,
        interactionRange: 2,
        townCenterWorkRate: 0.511,
        townCenterMinimumRate: 0.066,
        incomeMultiplier: 1,
      },
    });
  });

  test("pins the farthest owned Market and preserves fractional cargo over round trips", () => {
    const world = setup();
    const nearMarket = spawnUnit(world, 100, 120, 0, 0, 0, TYPE_GREEK_MARKET);
    const farMarket = spawnUnit(world, 20, 120, 0, 0, 0, TYPE_GREEK_MARKET);
    const townCenter = spawnUnit(world, 120, 120, 0, 0, 0, TYPE_GREEK_TOWN_CENTER);
    complete(world, nearMarket);
    complete(world, farMarket);
    complete(world, townCenter);
    const caravan = spawnUnit(world, 120, 120, 0, 0, 0, TYPE_GREEK_CARAVAN);

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRADE,
      unitIds: [caravan],
      targetId: townCenter,
    });
    tickWorld(world);
    const index = resolveId(world, caravan);
    expect(world.tradeMarket[index]).toBe(farMarket);
    expect(world.mode[index]).toBe(MODE_TRADING_TO_MARKET);
    const earned = (100 * 100 * 0.511) / 256;
    expect(world.tradeCargo[index]).toBeCloseTo(earned, 12);
    expect(world.carried[index]).toBe(19);

    world.posX[index] = 20;
    world.posZ[index] = 120;
    tickWorld(world);
    expect(world.stockpiles[GOLD]).toBe(19);
    expect(world.tradeCargo[index]).toBeCloseTo(earned - 19, 12);
    expect(world.mode[index]).toBe(MODE_TRADING_TO_TOWN_CENTER);

    world.posX[index] = 120;
    world.posZ[index] = 120;
    tickWorld(world);
    world.posX[index] = 20;
    world.posZ[index] = 120;
    tickWorld(world);
    expect(world.stockpiles[GOLD]).toBe(39);
    expect(world.tradeCargo[index]).toBeCloseTo(earned * 2 - 39, 12);
  });

  test("uses the source minimum-rate floor on short routes", () => {
    const world = setup(494);
    const market = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_GREEK_MARKET);
    const townCenter = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_GREEK_TOWN_CENTER);
    complete(world, market);
    complete(world, townCenter);
    const caravan = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_GREEK_CARAVAN);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRADE,
      unitIds: [caravan],
      targetId: townCenter,
    });
    tickWorld(world);
    expect(world.tradeCargo[resolveId(world, caravan)]).toBeCloseTo(0.066, 12);
  });

  test("hashes and compacts route endpoints plus fractional cargo", () => {
    const a = setup(495);
    const b = setup(495);
    for (const world of [a, b]) {
      spawnUnit(world, 10, 10, 0, 0, 0, TYPE_HOPLITE);
      spawnUnit(world, 20, 20, 0, 0, 0, TYPE_GREEK_CARAVAN);
      world.tradeMarket[1] = 17;
      world.tradeTownCenter[1] = 23;
      world.tradeCargo[1] = 0.9609375;
    }
    expect(hashWorld(a)).toBe(hashWorld(b));
    b.tradeCargo[1] = b.tradeCargo[1]! + Number.EPSILON;
    expect(hashWorld(a)).not.toBe(hashWorld(b));

    killUnit(a, 0);
    tickWorld(a);
    expect(a.unitType[0]).toBe(TYPE_GREEK_CARAVAN);
    expect(a.tradeMarket[0]).toBe(17);
    expect(a.tradeTownCenter[0]).toBe(23);
    expect(a.tradeCargo[0]).toBe(0.9609375);
  });
});
