import { describe, expect, test } from "bun:test";
import { COMMAND_CANCEL_TRAIN, COMMAND_TRAIN, enqueueCommand } from "../commands";
import { AGE_CLASSICAL, GOD_ZEUS } from "./progression";
import { registerPlayer } from "./players";
import {
  activeTrainType,
  cancelProduction,
  enqueueProduction,
  finishActiveProduction,
  MAX_TRAIN_QUEUE,
  type ProductionQueueState,
} from "./production";
import {
  FOOD,
  GOLD,
  NO_UNIT_TYPE,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_HOPLITE,
  TYPE_SPEARMAN,
  UNIT_TYPES,
} from "./types";
import { createWorld, resolveId, spawnBuilding, tickWorld } from "./world";

function queueState(): ProductionQueueState {
  return {
    trainRemaining: new Uint16Array(1),
    trainQueueLength: new Uint8Array(1),
    trainQueueTypes: new Uint16Array(MAX_TRAIN_QUEUE).fill(NO_UNIT_TYPE),
  };
}

describe("production queue contract", () => {
  test("slot zero is the active type and completion adopts the next type's duration", () => {
    const state = queueState();
    enqueueProduction(state, 0, TYPE_HOPLITE, 320);
    enqueueProduction(state, 0, TYPE_SPEARMAN, 180);

    expect(activeTrainType(state, 0)).toBe(TYPE_HOPLITE);
    expect(finishActiveProduction(state, 0, (type) => UNIT_TYPES[type]!.buildTicks)).toBe(
      TYPE_HOPLITE,
    );
    expect(activeTrainType(state, 0)).toBe(TYPE_SPEARMAN);
    expect(state.trainRemaining[0]).toBe(180);
  });

  test("canceling the active entry resets the next entry while canceling a tail does not", () => {
    const state = queueState();
    enqueueProduction(state, 0, TYPE_HOPLITE, 320);
    enqueueProduction(state, 0, TYPE_SPEARMAN, 180);
    state.trainRemaining[0] = 50;

    expect(cancelProduction(state, 0, 1, (type) => UNIT_TYPES[type]!.buildTicks)).toBe(
      TYPE_SPEARMAN,
    );
    expect(state.trainRemaining[0]).toBe(50);
    enqueueProduction(state, 0, TYPE_SPEARMAN, 180);
    expect(cancelProduction(state, 0, 0, (type) => UNIT_TYPES[type]!.buildTicks)).toBe(
      TYPE_HOPLITE,
    );
    expect(activeTrainType(state, 0)).toBe(TYPE_SPEARMAN);
    expect(state.trainRemaining[0]).toBe(180);
  });

  test("the authoritative cancel command refunds and compacts the queue", () => {
    const world = createWorld(42);
    registerPlayer(world, 0, GOD_ZEUS);
    world.walkable.fill(1);
    world.playerAge[0] = AGE_CLASSICAL;
    world.stockpiles[FOOD] = 1_000;
    world.stockpiles[GOLD] = 1_000;
    const buildingId = spawnBuilding(world, 100, 100, 0, TYPE_GREEK_MILITARY_ACADEMY, true);
    spawnBuilding(world, 120, 120, 0, TYPE_GREEK_TOWN_CENTER, true);
    const building = resolveId(world, buildingId);

    for (let count = 0; count < 2; count += 1) {
      enqueueCommand(world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_TRAIN,
        buildingId,
        unitType: TYPE_HOPLITE,
      });
    }
    tickWorld(world);
    expect(world.trainQueueLength[building]).toBe(2);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_CANCEL_TRAIN,
      buildingId,
      queueIndex: 0,
    });
    tickWorld(world);

    expect(world.trainQueueLength[building]).toBe(1);
    expect(activeTrainType(world, building)).toBe(TYPE_HOPLITE);
    expect(world.stockpiles[FOOD]).toBe(1_000 - UNIT_TYPES[TYPE_HOPLITE]!.costFood);
    expect(world.stockpiles[GOLD]).toBe(1_000 - UNIT_TYPES[TYPE_HOPLITE]!.costGold);
    expect(world.trainRemaining[building]).toBe(UNIT_TYPES[TYPE_HOPLITE]!.buildTicks - 1);
  });
});
