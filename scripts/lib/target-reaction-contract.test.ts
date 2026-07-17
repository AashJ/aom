import { describe, expect, test } from "bun:test";
import type { ThrownTargetReaction } from "../../packages/sim/src/content/unit-type-schema";
import {
  isValidTargetReactionContract,
  MAX_STORED_TARGET_REACTION_BOUNCES,
} from "./target-reaction-contract";

const VALID_THROW = {
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

describe("target-reaction content contracts", () => {
  test("accepts the largest bounce progression representable by authoritative storage", () => {
    expect(
      isValidTargetReactionContract({
        ...VALID_THROW,
        bounceBase: MAX_STORED_TARGET_REACTION_BOUNCES - 1,
        bounceRandomRange: 2,
      }),
    ).toBe(true);
  });

  test("rejects bounce progress that would wrap the signed authoritative counter", () => {
    expect(
      isValidTargetReactionContract({
        ...VALID_THROW,
        bounceBase: MAX_STORED_TARGET_REACTION_BOUNCES,
        bounceRandomRange: 2,
      }),
    ).toBe(false);
  });

  test("rejects finite endpoints whose sampled range can overflow", () => {
    expect(
      isValidTargetReactionContract({
        ...VALID_THROW,
        distanceBase: Number.MAX_VALUE,
        distanceRandomRange: Number.MAX_VALUE,
      }),
    ).toBe(false);
  });
});
