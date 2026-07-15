import { describe, expect, test } from "bun:test";
import { createSnapshot, writeSnapshot } from "./snapshot";
import { createWorld, killUnit, spawnUnit, tickWorld } from "./ecs/world";
import { registerPlayer } from "./ecs/players";
import { TYPE_HOPLITE } from "./ecs/types";

describe("death snapshot events", () => {
  test("preserves the removed entity's identity and transform for exactly one tick", () => {
    const world = createWorld(42);
    registerPlayer(world, 0);
    world.walkable.fill(1);
    const id = spawnUnit(world, 12, 34, 0, 0, 0, TYPE_HOPLITE);
    const snapshot = createSnapshot(4);

    killUnit(world, 0);
    tickWorld(world);
    writeSnapshot(world, snapshot, 0);

    expect(snapshot.deathCount).toBe(1);
    expect(snapshot.deathIds[0]).toBe(id);
    expect(snapshot.deathTypes[0]).toBe(TYPE_HOPLITE);
    expect(snapshot.deathPosX[0]).toBe(12);
    expect(snapshot.deathPosZ[0]).toBe(34);
    expect(snapshot.deathVisible[0]).toBe(1);

    tickWorld(world);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.deathCount).toBe(0);
  });
});
