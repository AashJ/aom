import { describe, expect, test } from "bun:test";
import {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  FOOD,
  RESOURCE_COUNT,
  TYPE_BARRACKS,
  TYPE_MILITIA,
  TYPE_TOWN_CENTER,
  TYPE_VILLAGER,
  UNIT_TYPES,
  createSnapshot,
} from "@aom/sim";
import { createPlayerStateStore, type PlayerState } from "./player-state";

const PLAYER_ID = 3;

function populatedSnapshot() {
  const snapshot = createSnapshot(4);
  const stockpileBase = PLAYER_ID * RESOURCE_COUNT;

  snapshot.age = AGE_CLASSICAL;
  snapshot.stockpiles[stockpileBase + FOOD] = 275;
  snapshot.count = 2;
  snapshot.owner[0] = PLAYER_ID;
  snapshot.unitType[0] = TYPE_VILLAGER;
  snapshot.owner[1] = PLAYER_ID;
  snapshot.unitType[1] = TYPE_TOWN_CENTER;
  snapshot.buildProgress[1] = UNIT_TYPES[TYPE_TOWN_CENTER]!.buildTicks;
  snapshot.trainQueueLength[1] = 2;
  snapshot.completedBuildings[TYPE_TOWN_CENTER] = 1;
  return snapshot;
}

describe("player state store", () => {
  test("projects viewer gameplay state from snapshots", () => {
    const store = createPlayerStateStore(PLAYER_ID);
    const snapshot = populatedSnapshot();
    let received: PlayerState | null = null;

    store.update(snapshot);
    store.subscribe((state) => {
      received = state;
    });

    expect(received).not.toBeNull();
    expect(received!.age).toBe(AGE_CLASSICAL);
    expect(received!.food).toBe(275);
    expect(received!.pop).toBe(3);
    expect(received!.popCap).toBe(UNIT_TYPES[TYPE_TOWN_CENTER]!.popBonus);
    expect(received!.completedBuildings[TYPE_TOWN_CENTER]).toBe(1);
  });

  test("notifies subscribers only when projected gameplay state changes", () => {
    const store = createPlayerStateStore(PLAYER_ID);
    const snapshot = populatedSnapshot();
    const received: PlayerState[] = [];

    store.update(snapshot);
    const unsubscribe = store.subscribe((state) => received.push(state));
    store.update(snapshot);
    expect(received).toHaveLength(1);

    const foodIndex = PLAYER_ID * RESOURCE_COUNT + FOOD;
    snapshot.stockpiles[foodIndex] = snapshot.stockpiles[foodIndex]! + 1;
    store.update(snapshot);
    expect(received).toHaveLength(2);
    expect(received[1]!.food).toBe(276);

    unsubscribe();
    snapshot.age = AGE_ARCHAIC;
    store.update(snapshot);
    expect(received).toHaveLength(2);
  });

  test("answers availability from the same age and completion projection", () => {
    const store = createPlayerStateStore(PLAYER_ID);
    const snapshot = populatedSnapshot();

    snapshot.age = AGE_ARCHAIC;
    store.update(snapshot);
    expect(store.availability(TYPE_MILITIA)).toEqual({
      available: false,
      reason: "age",
      requiredAge: AGE_CLASSICAL,
    });

    snapshot.age = AGE_CLASSICAL;
    store.update(snapshot);
    expect(store.availability(TYPE_MILITIA)).toEqual({
      available: false,
      reason: "building",
      buildingType: TYPE_BARRACKS,
    });

    snapshot.completedBuildings[TYPE_BARRACKS] = 1;
    store.update(snapshot);
    expect(store.availability(TYPE_MILITIA)).toEqual({ available: true });
  });
});
