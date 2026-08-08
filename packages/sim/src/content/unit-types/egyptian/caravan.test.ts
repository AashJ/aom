import { describe, expect, test } from "bun:test";
import { COMMAND_TRADE, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { AGE_HEROIC } from "../../../ecs/progression";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { UNIT_TYPES } from "../../generated/unit-types";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { UNIT_CLASS_CARAVAN } from "../../unit-type-schema";
import {
  TYPE_EGYPTIAN_CARAVAN,
  TYPE_EGYPTIAN_MARKET,
  TYPE_EGYPTIAN_TOWN_CENTER,
} from "../../unit-type-ids";
import { definition } from "./caravan";
import { definition as marketDefinition } from "./market";

describe("Egyptian Camel Caravan unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = unitReferenceEntry(definition.key)!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins the released Egyptian caravan and free Market balance", () => {
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
        incomeMultiplier: 0.9,
      },
    });
    expect(marketDefinition).toMatchObject({
      maxHp: 1200,
      armor: [0.3, 0.96, 0.05],
      costWood: 0,
      buildTicks: 40 * 20,
      requiredAge: AGE_HEROIC,
      tradeSite: "market",
      builtBy: [{ commandSlot: 6 }],
    });
  });

  test("applies the Egyptian 10% trade-income penalty after the distance formula", () => {
    const world = createWorld(494);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    const market = spawnUnit(world, 20, 120, 0, 0, 0, TYPE_EGYPTIAN_MARKET);
    const townCenter = spawnUnit(world, 120, 120, 0, 0, 0, TYPE_EGYPTIAN_TOWN_CENTER);
    const caravan = spawnUnit(world, 120, 120, 0, 0, 0, TYPE_EGYPTIAN_CARAVAN);
    world.buildProgress[resolveId(world, market)] = marketDefinition.buildTicks;
    world.buildProgress[resolveId(world, townCenter)] =
      UNIT_TYPES[TYPE_EGYPTIAN_TOWN_CENTER]!.buildTicks;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRADE,
      unitIds: [caravan],
      targetId: townCenter,
    });
    tickWorld(world);

    expect(world.tradeCargo[resolveId(world, caravan)]).toBeCloseTo(
      ((100 * 100 * 0.511) / 256) * 0.9,
      12,
    );
    expect(world.carried[resolveId(world, caravan)]).toBe(17);
  });

  test("also applies the culture penalty to the short-route minimum", () => {
    const world = createWorld(495);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    const market = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_EGYPTIAN_MARKET);
    const townCenter = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_EGYPTIAN_TOWN_CENTER);
    const caravan = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_EGYPTIAN_CARAVAN);
    world.buildProgress[resolveId(world, market)] = marketDefinition.buildTicks;
    world.buildProgress[resolveId(world, townCenter)] =
      UNIT_TYPES[TYPE_EGYPTIAN_TOWN_CENTER]!.buildTicks;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRADE,
      unitIds: [caravan],
      targetId: townCenter,
    });
    tickWorld(world);

    expect(world.tradeCargo[resolveId(world, caravan)]).toBeCloseTo(0.066 * 0.9, 12);
  });
});
