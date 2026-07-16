import { describe, expect, test } from "bun:test";
import { COMMAND_CANCEL_TRAIN, COMMAND_TRAIN, enqueueCommand } from "../commands";
import { hashWorld } from "../hash";
import { registerPlayer } from "./players";
import { AGE_HEROIC, GOD_ZEUS } from "./progression";
import {
  FOOD,
  GOLD,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_JASON,
  UNIT_TYPES,
} from "./types";
import { createWorld, killUnit, resolveId, spawnBuilding, tickWorld, type World } from "./world";

function heroWorld(seed: number): {
  world: World;
  townCenterId: number;
  fortressId: number;
} {
  const world = createWorld(seed);
  registerPlayer(world, 0, GOD_ZEUS);
  world.walkable.fill(1);
  world.playerAge[0] = AGE_HEROIC;
  world.stockpiles[FOOD] = 10_000;
  world.stockpiles[GOLD] = 10_000;
  const townCenterId = spawnBuilding(world, 40, 40, 0, TYPE_GREEK_TOWN_CENTER);
  const fortressId = spawnBuilding(world, 60, 60, 0, TYPE_GREEK_FORTRESS);
  spawnBuilding(world, 80, 80, 0, TYPE_GREEK_TEMPLE);
  return { world, townCenterId, fortressId };
}

function train(world: World, buildingId: number): void {
  enqueueCommand(world, {
    tick: world.tick,
    issuer: 0,
    type: COMMAND_TRAIN,
    buildingId,
    unitType: TYPE_JASON,
  });
}

describe("Greek hero lifecycle", () => {
  test("enforces one live-or-queued identity across every producer and refunds cancellation", () => {
    const { world, townCenterId, fortressId } = heroWorld(42);
    const foodBefore = world.stockpiles[FOOD]!;
    const goldBefore = world.stockpiles[GOLD]!;

    train(world, townCenterId);
    train(world, fortressId);
    tickWorld(world);

    const townCenter = resolveId(world, townCenterId);
    const fortress = resolveId(world, fortressId);
    expect(world.trainQueueLength[townCenter]! + world.trainQueueLength[fortress]!).toBe(1);
    expect(world.stockpiles[FOOD]).toBe(foodBefore - UNIT_TYPES[TYPE_JASON]!.costFood);
    expect(world.stockpiles[GOLD]).toBe(goldBefore - UNIT_TYPES[TYPE_JASON]!.costGold);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_CANCEL_TRAIN,
      buildingId: townCenterId,
      queueIndex: 0,
    });
    train(world, fortressId);
    tickWorld(world);

    expect(world.trainQueueLength[townCenter]).toBe(0);
    expect(world.trainQueueLength[fortress]).toBe(1);
    expect(world.stockpiles[FOOD]).toBe(foodBefore - UNIT_TYPES[TYPE_JASON]!.costFood);
    expect(world.stockpiles[GOLD]).toBe(goldBefore - UNIT_TYPES[TYPE_JASON]!.costGold);
  });

  test("releases the identity on death and retrains deterministically", () => {
    const left = heroWorld(77);
    const right = heroWorld(77);

    for (const { world, townCenterId } of [left, right]) train(world, townCenterId);
    for (let tick = 0; tick < UNIT_TYPES[TYPE_JASON]!.buildTicks; tick += 1) {
      tickWorld(left.world);
      tickWorld(right.world);
      expect(hashWorld(left.world)).toBe(hashWorld(right.world));
    }

    const leftJason = left.world.unitType.findIndex((type) => type === TYPE_JASON);
    const rightJason = right.world.unitType.findIndex((type) => type === TYPE_JASON);
    expect(leftJason).toBeGreaterThanOrEqual(0);
    killUnit(left.world, leftJason);
    killUnit(right.world, rightJason);
    tickWorld(left.world);
    tickWorld(right.world);

    train(left.world, left.townCenterId);
    train(right.world, right.townCenterId);
    tickWorld(left.world);
    tickWorld(right.world);

    expect(left.world.trainQueueLength[resolveId(left.world, left.townCenterId)]).toBe(1);
    expect(hashWorld(left.world)).toBe(hashWorld(right.world));
  });
});
