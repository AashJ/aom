import { describe, expect, test } from "bun:test";
import { registerPlayer } from "./players";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "./world";
import { hashWorld } from "../hash";
import { nextFloat, nextU32 } from "../math/prng";
import { TYPE_HOPLITE } from "../content/unit-type-ids";
import type { ThrownTargetReaction } from "../content/unit-type-schema";
import {
  clearTargetReaction,
  copyTargetReaction,
  createTargetReactionStore,
  installTargetReaction,
  isTargetReactionActive,
  TARGET_REACTION_NONE,
  TARGET_REACTION_THROWN,
  targetReactionCapabilitiesAt,
  type TargetReactionStore,
  tickTargetReactions,
} from "./target-reactions";

const CLASSIC_GORE_THROW = {
  kind: "thrown",
  distanceBase: 8,
  distanceRandomRange: 2,
  maxVelocityBase: 12,
  maxVelocityRandomRange: 4,
  maxHeightBase: 6,
  maxHeightRandomRange: 2,
  bounceBase: 1,
  bounceRandomRange: 2,
} as const satisfies ThrownTargetReaction;

function flatWorld(seed = 42) {
  const world = createWorld(seed);
  world.heights.fill(0);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  const targetId = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HOPLITE);
  return { world, targetId };
}

type MutableReactionArray = Float64Array | Int8Array | Uint8Array;

function reactionArrays(store: TargetReactionStore): MutableReactionArray[] {
  const arrays: MutableReactionArray[] = [];
  for (const value of Object.values(store)) {
    if (
      !(value instanceof Float64Array) &&
      !(value instanceof Int8Array) &&
      !(value instanceof Uint8Array)
    ) {
      throw new TypeError("Target-reaction stores may contain only numeric typed arrays.");
    }
    arrays.push(value);
  }
  return arrays;
}

describe("authoritative target reactions", () => {
  test("samples the executable-pinned Gore fields from the synchronized RNG in order", () => {
    const { world } = flatWorld();
    const expectedRng = { ...world.rng };
    const expectedDistance = 8 + nextFloat(expectedRng) * 2;
    const expectedVelocity = 12 + nextFloat(expectedRng) * 4;
    const expectedHeight = 6 + nextFloat(expectedRng) * 2;
    const expectedBounces = 1 + (nextU32(expectedRng) % 2);

    expect(installTargetReaction(world, 0, 19, 20, CLASSIC_GORE_THROW)).toBe(true);
    expect(world.targetReactions.kind[0]).toBe(TARGET_REACTION_THROWN);
    expect(world.targetReactions.directionX[0]).toBe(1);
    expect(world.targetReactions.directionZ[0]).toBe(0);
    expect(world.targetReactions.distance[0]).toBe(expectedDistance);
    expect(world.targetReactions.maxVelocity[0]).toBe(expectedVelocity);
    expect(world.targetReactions.maxHeight[0]).toBe(expectedHeight);
    expect(world.targetReactions.numberBounces[0]).toBe(expectedBounces);
    expect(world.targetReactions.numberBouncesDone[0]).toBe(-1);
    expect(world.rng).toEqual(expectedRng);
    expect(targetReactionCapabilitiesAt(world.targetReactions, 0)).toEqual({
      blocksOrderExecution: true,
      drivesPosition: true,
      participatesInGroundSeparation: false,
    });
  });

  test("flies, lands, and runs every successively shorter Classic bounce arc", () => {
    const { world } = flatWorld();
    const startX = world.posX[0]!;
    expect(installTargetReaction(world, 0, 19, 20, CLASSIC_GORE_THROW)).toBe(true);
    const distance = world.targetReactions.distance[0]!;
    const numberBounces = world.targetReactions.numberBounces[0]!;
    let peakElevation = 0;
    let ticks = 0;

    while (isTargetReactionActive(world.targetReactions, 0) && ticks < 500) {
      tickTargetReactions(world);
      peakElevation = Math.max(peakElevation, world.targetReactions.elevation[0]!);
      ticks += 1;
    }

    let distanceMultiplier = 1;
    for (let divisor = 1; divisor <= numberBounces + 1; divisor += 1) {
      distanceMultiplier += 1 / divisor;
    }
    expect(ticks).toBeLessThan(500);
    expect(peakElevation).toBeGreaterThan(0);
    expect(world.targetReactions.kind[0]).toBe(TARGET_REACTION_NONE);
    expect(world.targetReactions.elevation[0]).toBe(0);
    expect(world.posX[0]).toBeCloseTo(startX + distance * distanceMultiplier, 10);
    expect(world.posZ[0]).toBe(20);
  });

  test("uses Classic's short horizontal fallback when the initial landing is invalid", () => {
    const { world } = flatWorld();
    const fixedThrow = {
      ...CLASSIC_GORE_THROW,
      distanceRandomRange: 0,
      maxVelocityRandomRange: 0,
      maxHeightRandomRange: 0,
      bounceRandomRange: 1,
    };
    world.walkable[20 * 256 + 28] = 0;

    expect(installTargetReaction(world, 0, 19, 20, fixedThrow)).toBe(true);
    expect(world.targetReactions.kind[0]).toBe(TARGET_REACTION_THROWN);
    expect(world.targetReactions.directionX[0]).toBe(-1);
    expect(world.targetReactions.directionZ[0]).toBe(0);
    expect(world.targetReactions.distance[0]).toBe(0.1);
    expect(world.posZ[0]).toBe(20);
  });

  test("terminates at a completed landing when the next bounce landing is invalid", () => {
    const { world } = flatWorld();
    const fixedThrow = {
      ...CLASSIC_GORE_THROW,
      distanceRandomRange: 0,
      maxVelocityRandomRange: 0,
      maxHeightRandomRange: 0,
      bounceRandomRange: 1,
    };
    expect(installTargetReaction(world, 0, 19, 20, fixedThrow)).toBe(true);
    world.walkable[20 * 256 + 36] = 0;

    let ticks = 0;
    while (isTargetReactionActive(world.targetReactions, 0) && ticks < 200) {
      tickTargetReactions(world);
      ticks += 1;
    }

    expect(ticks).toBeLessThan(200);
    expect(world.targetReactions.kind[0]).toBe(TARGET_REACTION_NONE);
    expect(world.posX[0]).toBe(28);
    expect(world.posZ[0]).toBe(20);
  });

  test("hashes every future-affecting reaction field and remains deterministic tick by tick", () => {
    const left = flatWorld(99).world;
    const right = flatWorld(99).world;
    installTargetReaction(left, 0, 19, 20, CLASSIC_GORE_THROW);
    installTargetReaction(right, 0, 19, 20, CLASSIC_GORE_THROW);

    for (let tick = 0; tick < 80; tick += 1) {
      expect(hashWorld(left)).toBe(hashWorld(right));
      tickTargetReactions(left);
      tickTargetReactions(right);
    }

    const baselineHash = hashWorld(right);
    for (const array of reactionArrays(right.targetReactions)) {
      const previous = array[0]!;
      array[0] = previous + (array instanceof Float64Array ? 0.125 : 1);
      expect(hashWorld(right)).not.toBe(baselineHash);
      array[0] = previous;
      expect(hashWorld(right)).toBe(baselineHash);
    }
  });

  test("copies and clears every target-reaction array through the canonical lifecycle", () => {
    const store = createTargetReactionStore(2);
    const arrays = reactionArrays(store);
    for (let field = 0; field < arrays.length; field += 1) {
      arrays[field]![0] = field + 1;
      arrays[field]![1] = field + 40;
    }

    copyTargetReaction(store, 1, 0);
    for (const array of arrays) expect(array[1]).toBe(array[0]);

    clearTargetReaction(store, 1);
    for (const array of arrays) expect(array[1]).toBe(0);
  });

  test("rejects an unsupported stored kind instead of silently freezing the unit", () => {
    const { world } = flatWorld();
    world.targetReactions.kind[0] = 255;

    expect(() => targetReactionCapabilitiesAt(world.targetReactions, 0)).toThrow(
      "Unsupported authoritative target-reaction kind 255",
    );
    expect(() => tickTargetReactions(world)).toThrow(
      "Unsupported authoritative target-reaction kind 255",
    );
  });

  test("moves reaction ownership with a dense-slot death swap and clears the vacated slot", () => {
    const { world } = flatWorld();
    const targetId = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_HOPLITE);
    expect(installTargetReaction(world, 1, 19, 20, CLASSIC_GORE_THROW)).toBe(true);

    killUnit(world, 0);
    tickWorld(world);

    expect(resolveId(world, targetId)).toBe(0);
    expect(world.targetReactions.kind[0]).toBe(TARGET_REACTION_THROWN);
    expect(world.targetReactions.elevation[0]).toBeGreaterThan(0);
    expect(world.targetReactions.kind[1]).toBe(TARGET_REACTION_NONE);
  });
});
