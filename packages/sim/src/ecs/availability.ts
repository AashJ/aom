import { UNIT_TYPES } from "./types";

export interface BuildingCompletionState {
  count: number;
  owner: Uint8Array;
  unitType: Uint8Array;
  dying: Uint8Array;
  hp: Uint16Array;
  buildProgress: Uint16Array;
}

export type HasCompletedBuilding = (buildingType: number) => boolean;

export type TypeAvailability =
  | { available: true }
  | { available: false; reason: "invalid-type" }
  | { available: false; reason: "age"; requiredAge: number }
  | { available: false; reason: "building"; buildingType: number };

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
  playerAge: number,
  hasCompletedBuilding: HasCompletedBuilding,
): TypeAvailability {
  const stats = UNIT_TYPES[unitType];

  if (stats === undefined) {
    return { available: false, reason: "invalid-type" };
  }

  if (playerAge < stats.requiredAge) {
    return { available: false, reason: "age", requiredAge: stats.requiredAge };
  }

  for (let i = 0; i < stats.prerequisiteBuildings.length; i += 1) {
    if (!hasCompletedBuilding(stats.prerequisiteBuildings[i]!)) {
      return {
        available: false,
        reason: "building",
        buildingType: stats.prerequisiteBuildings[i]!,
      };
    }
  }

  return { available: true };
}

export function isTypeAvailable(
  unitType: number,
  playerAge: number,
  hasCompletedBuilding: HasCompletedBuilding,
): boolean {
  return getTypeAvailability(unitType, playerAge, hasCompletedBuilding).available;
}
