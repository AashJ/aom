export * from "../content/unit-type-ids";
export * from "../content/unit-type-schema";
export {
  BUILD_OPTIONS_BY_WORKER,
  TRAIN_OPTIONS_BY_PRODUCER,
  UNIT_TYPE_DEFINITIONS,
  UNIT_TYPES,
} from "../content/generated/unit-types";

// Balance-pass placeholders: 0.5 s per unit, 5 s to fill at 20 Hz.
// Build cadence reuses GATHER_COOLDOWN_TICKS (10), so the average rate is 1 progress/tick/builder and buildTicks reads as solo builder-ticks.
export const BUILD_PER_STRIKE = 10;
export const CARRY_CAPACITY = 10;
export const GATHER_PER_STRIKE = 1;
export const GATHER_COOLDOWN_TICKS = 10;
// A depleted node hands workers to a nearby node so a forest is one worksite, not thirty orders.
export const NODE_RETARGET_RADIUS = 14;

export const LEASH_FACTOR = 1.4;
