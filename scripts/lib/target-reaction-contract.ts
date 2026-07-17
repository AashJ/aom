import type {
  TargetReaction,
  ThrownTargetReaction,
} from "../../packages/sim/src/content/unit-type-schema";

export const MAX_STORED_TARGET_REACTION_BOUNCES = 0x7f;

function hasFinitePositiveSampleRange(base: number, randomRange: number): boolean {
  return (
    Number.isFinite(base) &&
    base > 0 &&
    Number.isFinite(randomRange) &&
    randomRange >= 0 &&
    Number.isFinite(base + randomRange)
  );
}

function isValidThrownTargetReaction(reaction: ThrownTargetReaction): boolean {
  const maximumBounces = reaction.bounceBase + reaction.bounceRandomRange - 1;
  return (
    hasFinitePositiveSampleRange(reaction.distanceBase, reaction.distanceRandomRange) &&
    hasFinitePositiveSampleRange(reaction.maxVelocityBase, reaction.maxVelocityRandomRange) &&
    hasFinitePositiveSampleRange(reaction.maxHeightBase, reaction.maxHeightRandomRange) &&
    Number.isInteger(reaction.bounceBase) &&
    reaction.bounceBase >= 0 &&
    Number.isInteger(reaction.bounceRandomRange) &&
    reaction.bounceRandomRange >= 1 &&
    Number.isSafeInteger(maximumBounces) &&
    maximumBounces <= MAX_STORED_TARGET_REACTION_BOUNCES
  );
}

function unsupportedTargetReaction(reaction: TargetReaction): never {
  throw new TypeError(`Unsupported target-reaction contract ${JSON.stringify(reaction)}.`);
}

export function isValidTargetReactionContract(reaction: TargetReaction): boolean {
  switch (reaction.kind) {
    case "thrown":
      return isValidThrownTargetReaction(reaction);
    default:
      return unsupportedTargetReaction(reaction);
  }
}
