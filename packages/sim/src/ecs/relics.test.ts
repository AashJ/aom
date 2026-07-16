import { describe, expect, test } from "bun:test";
import { COMMAND_DROP_OFF_RELIC, COMMAND_PICK_UP_RELIC, enqueueCommand } from "../commands";
import { hashWorld } from "../hash";
import { createSnapshot, writeSnapshot } from "../snapshot";
import { registerPlayer } from "./players";
import { GOD_ZEUS } from "./progression";
import { firstCarriedRelicId } from "./relics";
import { TYPE_GREEK_TEMPLE, TYPE_JASON, TYPE_RELIC } from "./types";
import {
  createWorld,
  killUnit,
  NEUTRAL_OWNER,
  NO_TARGET,
  resolveId,
  spawnBuilding,
  spawnUnit,
  tickWorld,
  type World,
} from "./world";

interface RelicWorld {
  world: World;
  heroId: number;
  relicId: number;
  templeId: number;
}

function relicWorld(seed: number): RelicWorld {
  const world = createWorld(seed);
  registerPlayer(world, 0, GOD_ZEUS);
  world.walkable.fill(1);
  const heroId = spawnUnit(world, 42, 42, 0, 0, 0, TYPE_JASON);
  const relicId = spawnUnit(world, 48, 42, 0, 0, NEUTRAL_OWNER, TYPE_RELIC);
  const templeId = spawnBuilding(world, 54, 40, 0, TYPE_GREEK_TEMPLE);
  return { world, heroId, relicId, templeId };
}

function runUntil(world: World, predicate: () => boolean, limit = 200): void {
  for (let tick = 0; tick < limit; tick += 1) {
    if (predicate()) return;
    tickWorld(world);
  }
  throw new Error("Relic lifecycle did not reach the expected state.");
}

describe("relic containment lifecycle", () => {
  test("picks up, snapshots, deposits, and releases relics on Temple and hero death", () => {
    const { world, heroId, relicId, templeId } = relicWorld(42);
    const beforePickup = hashWorld(world);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_PICK_UP_RELIC,
      unitIds: [heroId],
      targetId: relicId,
    });
    runUntil(world, () => {
      const relic = resolveId(world, relicId);
      return relic >= 0 && world.containedBy[relic] === heroId;
    });

    const hero = resolveId(world, heroId);
    const relic = resolveId(world, relicId);
    expect(firstCarriedRelicId(world, hero)).toBe(relicId);
    expect(world.selectable[relic]).toBe(0);
    expect(hashWorld(world)).not.toBe(beforePickup);

    const snapshot = createSnapshot(8);
    writeSnapshot(world, snapshot);
    expect(snapshot.carriedRelicCount[hero]).toBe(1);
    expect(snapshot.visible[relic]).toBe(0);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_DROP_OFF_RELIC,
      unitIds: [heroId],
      targetId: templeId,
    });
    runUntil(world, () => {
      const currentRelic = resolveId(world, relicId);
      return currentRelic >= 0 && world.containedBy[currentRelic] === templeId;
    });

    killUnit(world, resolveId(world, templeId));
    tickWorld(world);
    expect(world.containedBy[resolveId(world, relicId)]).toBe(NO_TARGET);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_PICK_UP_RELIC,
      unitIds: [heroId],
      targetId: relicId,
    });
    runUntil(world, () => world.containedBy[resolveId(world, relicId)] === heroId);
    killUnit(world, resolveId(world, heroId));
    tickWorld(world);

    const releasedRelic = resolveId(world, relicId);
    expect(releasedRelic).toBeGreaterThanOrEqual(0);
    expect(world.containedBy[releasedRelic]).toBe(NO_TARGET);
    expect(world.selectable[releasedRelic]).toBe(1);
  });

  test("produces equal hashes through the complete pickup and deposit path", () => {
    const left = relicWorld(99);
    const right = relicWorld(99);

    for (const state of [left, right]) {
      enqueueCommand(state.world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_PICK_UP_RELIC,
        unitIds: [state.heroId],
        targetId: state.relicId,
      });
    }

    for (let tick = 0; tick < 80; tick += 1) {
      tickWorld(left.world);
      tickWorld(right.world);
      expect(hashWorld(left.world)).toBe(hashWorld(right.world));
    }

    for (const state of [left, right]) {
      enqueueCommand(state.world, {
        tick: state.world.tick,
        issuer: 0,
        type: COMMAND_DROP_OFF_RELIC,
        unitIds: [state.heroId],
        targetId: state.templeId,
      });
    }
    for (let tick = 0; tick < 80; tick += 1) {
      tickWorld(left.world);
      tickWorld(right.world);
      expect(hashWorld(left.world)).toBe(hashWorld(right.world));
    }
  });
});
