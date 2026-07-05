import { describe, expect, test } from "bun:test";
import {
  VILLAGER_IDLE_FRAME,
  VILLAGER_WALK_FIRST_FRAME,
  VILLAGER_WALK_FRAME_COUNT,
  villagerAnimationFrame,
} from "./unit-animation";

describe("villagerAnimationFrame", () => {
  test("uses the idle frame when the snapshot position is unchanged", () => {
    expect(
      villagerAnimationFrame({
        prevX: 12,
        prevZ: 20,
        currX: 12,
        currZ: 20,
        tick: 100,
        alpha: 0.5,
        unitIndex: 4,
      }),
    ).toBe(VILLAGER_IDLE_FRAME);
  });

  test("cycles moving units through the walk frames", () => {
    const seen = new Set<number>();

    for (let tick = 0; tick < 30; tick += 1) {
      seen.add(
        villagerAnimationFrame({
          prevX: 12,
          prevZ: 20,
          currX: 12.15,
          currZ: 20,
          tick,
          alpha: 0,
          unitIndex: 0,
        }),
      );
    }

    expect([...seen].sort((a, b) => a - b)).toEqual(
      Array.from(
        { length: VILLAGER_WALK_FRAME_COUNT },
        (_, frame) => VILLAGER_WALK_FIRST_FRAME + frame,
      ),
    );
  });

  test("is stable for the same tick alpha and unit index", () => {
    const input = {
      prevX: 12,
      prevZ: 20,
      currX: 12.15,
      currZ: 20.15,
      tick: 17,
      alpha: 0.25,
      unitIndex: 5,
    };

    expect(villagerAnimationFrame(input)).toBe(villagerAnimationFrame(input));
  });
});
