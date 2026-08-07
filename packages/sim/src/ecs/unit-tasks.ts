import { clearAttackOrder } from "./attack-state";
import { NO_TARGET } from "./id";
import { clearSpecialAttack } from "./special-attacks";
import type { World } from "./world";

// One namespace owns every mode stored in World.mode. New task families extend
// this union instead of allocating numeric values in independent subsystems.
export const MODE_IDLE = 0;
export const MODE_GATHERING = 1;
export const MODE_RETURNING = 2;
export const MODE_BUILDING = 3;
export const MODE_PRAYING = 4;
export const MODE_PICKING_UP_RELIC = 5;
export const MODE_DROPPING_OFF_RELIC = 6;
export const MODE_ENTERING_GARRISON = 7;
export const MODE_TRADING_TO_TOWN_CENTER = 8;
export const MODE_TRADING_TO_MARKET = 9;
export const MODE_EATING_RESOURCE = 10;
export const MODE_HEALING = 11;
export const MODE_EMPOWERING = 12;
export const MODE_CONVERTING = 13;

export type UnitTaskMode =
  | typeof MODE_IDLE
  | typeof MODE_GATHERING
  | typeof MODE_RETURNING
  | typeof MODE_BUILDING
  | typeof MODE_PRAYING
  | typeof MODE_PICKING_UP_RELIC
  | typeof MODE_DROPPING_OFF_RELIC
  | typeof MODE_ENTERING_GARRISON
  | typeof MODE_TRADING_TO_TOWN_CENTER
  | typeof MODE_TRADING_TO_MARKET
  | typeof MODE_EATING_RESOURCE
  | typeof MODE_HEALING
  | typeof MODE_EMPOWERING
  | typeof MODE_CONVERTING;

export type AssignedUnitTaskMode = Exclude<UnitTaskMode, typeof MODE_IDLE>;

export function clearUnitTask(world: World, index: number): void {
  world.mode[index] = MODE_IDLE;
  world.taskTarget[index] = NO_TARGET;
  world.tradeMarket[index] = NO_TARGET;
  world.tradeTownCenter[index] = NO_TARGET;
  world.gatherPosX[index] = 0;
  world.gatherPosZ[index] = 0;
  world.supportActionRemaining[index] = 0;
  // Stages 2 and 3 are Classic Cyclops's committed BUnitThrowAction after the
  // Pickup tag. Ordinary commands cannot strand its terminal carried victim.
  if (world.specialActionImpactPending[index]! < 2) {
    clearSpecialAttack(world, index);
  }
  clearAttackOrder(world, index);
}

export function assignUnitTask(
  world: World,
  index: number,
  mode: AssignedUnitTaskMode,
  targetId: number,
): void {
  clearUnitTask(world, index);
  world.mode[index] = mode;
  world.taskTarget[index] = targetId;
}

export { NO_TARGET };
