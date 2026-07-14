import { describe, expect, test } from "bun:test";
import {
  VILLAGER_IDLE_FRAME,
  VILLAGER_WALK_FIRST_FRAME,
  VILLAGER_WALK_FRAME_COUNT,
  spriteDirectionRow,
  villagerAnimationFrame,
  villagerGatherAnimationFrame,
} from "./unit-animation";

describe("spriteDirectionRow", () => {
  test("maps world headings into camera-relative atlas rows", () => {
    // The fixed camera looks along +X/+Z, so -X/-Z faces the viewer.
    // The source model's native yaw puts that front-facing pose in atlas row 1.
    expect(spriteDirectionRow(5, 1, 1, 8)).toBe(1);
    // Screen-right is -X/+Z and screen-left is +X/-Z. The atlas's Blender
    // ground plane stores those side profiles in the opposite numeric order.
    expect(spriteDirectionRow(7, 1, 1, 8)).toBe(7);
    expect(spriteDirectionRow(3, 1, 1, 8)).toBe(3);
    // +X/+Z walks directly away from the camera.
    expect(spriteDirectionRow(1, 1, 1, 8)).toBe(5);
  });

  test("uses every directional row exactly once", () => {
    const rows = new Set<number>();

    for (let facing = 0; facing < 8; facing += 1) {
      rows.add(spriteDirectionRow(facing, 1, 1, 8));
    }

    expect([...rows].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("keeps non-directional sprites on their only row", () => {
    expect(spriteDirectionRow(3, 1, 1, 1)).toBe(0);
  });
});

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

describe("villagerGatherAnimationFrame", () => {
  const config = {
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 6,
  };

  test("cycles through every action frame between resource strikes", () => {
    const seen = new Set<number>();

    for (let cooldown = 10; cooldown > 0; cooldown -= 1) {
      seen.add(villagerGatherAnimationFrame({ cooldown, alpha: 0 }, config));
    }

    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("restarts at the first frame when the gather cooldown resets", () => {
    expect(villagerGatherAnimationFrame({ cooldown: 10, alpha: 0 }, config)).toBe(0);
    expect(villagerGatherAnimationFrame({ cooldown: 1, alpha: 0.99 }, config)).toBe(5);
  });
});
