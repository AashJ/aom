import { CULTURE_SHARED, NO_UNIT_TYPE, UNIT_TYPES } from "./types";
import { NO_GOD } from "./progression";

export interface BuildingCompletionState {
  count: number;
  owner: Uint8Array;
  unitType: Uint16Array;
  dying: Uint8Array;
  hp: ArrayLike<number>;
  buildProgress: Uint16Array;
}

export type HasCompletedBuilding = (buildingType: number) => boolean;
export type HasGod = (god: number) => boolean;
export type OwnedOrQueuedUnitCount = (unitType: number) => number;

export interface TypeAvailabilityContext {
  readonly playerAge: number;
  readonly playerCulture: number;
  readonly hasCompletedBuilding: HasCompletedBuilding;
  readonly hasGod: HasGod;
  readonly ownedOrQueuedUnitCount: OwnedOrQueuedUnitCount;
  readonly producerType?: number;
}

export type TypeAvailability =
  | { available: true }
  | { available: false; reason: "invalid-type" }
  | { available: false; reason: "culture"; requiredCulture: number }
  | { available: false; reason: "age"; requiredAge: number }
  | { available: false; reason: "god"; requiredGod: number }
  | { available: false; reason: "producer"; producerType: number }
  | { available: false; reason: "building"; buildingType: number }
  | { available: false; reason: "train-limit"; limit: number };

export function isCompletedOwnedBuilding(
  state: BuildingCompletionState,
  index: number,
  playerId: number,
): boolean {
  const stats = UNIT_TYPES[state.unitType[index]!];

  return (
    stats !== undefined &&
    stats.footprint > 0 &&
    state.owner[index] === playerId &&
    state.dying[index] === 0 &&
    state.hp[index]! > 0 &&
    state.buildProgress[index]! >= stats.buildTicks
  );
}

export function hasCompletedBuilding(
  state: BuildingCompletionState,
  playerId: number,
  buildingType: number,
): boolean {
  const stats = UNIT_TYPES[buildingType];

  if (stats === undefined || stats.footprint === 0) {
    return false;
  }

  for (let index = 0; index < state.count; index += 1) {
    if (
      state.unitType[index] === buildingType &&
      isCompletedOwnedBuilding(state, index, playerId)
    ) {
      return true;
    }
  }

  return false;
}

// The single tech-tree rule shared by authoritative commands and snapshot consumers.
// Affordability, placement geometry, producer ownership, population, and queues remain
// separate checks at their existing owning boundaries.
export function getTypeAvailability(
  unitType: number,
  context: TypeAvailabilityContext,
): TypeAvailability {
  const stats = UNIT_TYPES[unitType];

  if (stats === undefined) {
    return { available: false, reason: "invalid-type" };
  }

  if (stats.culture !== CULTURE_SHARED && stats.culture !== context.playerCulture) {
    return { available: false, reason: "culture", requiredCulture: stats.culture };
  }

  if (context.playerAge < stats.requiredAge) {
    return { available: false, reason: "age", requiredAge: stats.requiredAge };
  }

  if (stats.requiredGod !== NO_GOD && !context.hasGod(stats.requiredGod)) {
    return { available: false, reason: "god", requiredGod: stats.requiredGod };
  }

  const producerType = context.producerType ?? NO_UNIT_TYPE;
  if (producerType !== NO_UNIT_TYPE) {
    let hasProducer = false;

    for (let index = 0; index < stats.trainedAt.length; index += 1) {
      hasProducer ||= stats.trainedAt[index]!.type === producerType;
    }
    for (let index = 0; index < stats.builtBy.length; index += 1) {
      hasProducer ||= stats.builtBy[index]!.type === producerType;
    }

    if (!hasProducer) {
      return { available: false, reason: "producer", producerType };
    }
  }

  for (let i = 0; i < stats.prerequisiteBuildings.length; i += 1) {
    if (!context.hasCompletedBuilding(stats.prerequisiteBuildings[i]!)) {
      return {
        available: false,
        reason: "building",
        buildingType: stats.prerequisiteBuildings[i]!,
      };
    }
  }

  const trainLimit = stats.hero?.trainLimit;
  if (trainLimit !== undefined && context.ownedOrQueuedUnitCount(unitType) >= trainLimit) {
    return { available: false, reason: "train-limit", limit: trainLimit };
  }

  return { available: true };
}

export function isTypeAvailable(unitType: number, context: TypeAvailabilityContext): boolean {
  return getTypeAvailability(unitType, context).available;
}
