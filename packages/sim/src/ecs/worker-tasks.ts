import type { World } from "./world";
import { isCompletedOwnedBuilding } from "./availability";
import { isGreekMajorGod } from "./favor";
import { assignFieldGoal, setFacingToward } from "./navigation";
import { TYPE_TEMPLE, UNIT_TYPES } from "./types";
import { cellOf } from "../flow";

// Packed id 0 is valid (handle 0, generation 0), so task targets use an
// impossible handle as their empty sentinel.
export const NO_TARGET = 0xffffffff;

export const MODE_IDLE = 0;
export const MODE_GATHERING = 1;
export const MODE_RETURNING = 2;
export const MODE_BUILDING = 3;
export const MODE_PRAYING = 4;

export type AssignedWorkerTaskMode =
  | typeof MODE_GATHERING
  | typeof MODE_BUILDING
  | typeof MODE_PRAYING;

export function clearWorkerTask(world: World, index: number): void {
  world.mode[index] = MODE_IDLE;
  world.taskTarget[index] = NO_TARGET;
  world.gatherPosX[index] = 0;
  world.gatherPosZ[index] = 0;
  world.attackTarget[index] = NO_TARGET;
  world.attackOrdered[index] = 0;
  world.moving[index] = 0;
  world.unitField[index] = null;
}

export function assignWorkerTask(
  world: World,
  index: number,
  mode: AssignedWorkerTaskMode,
  targetId: number,
): void {
  clearWorkerTask(world, index);
  world.mode[index] = mode;
  world.taskTarget[index] = targetId;
}

export function assignGatherTask(
  world: World,
  index: number,
  targetId: number,
  targetX: number,
  targetZ: number,
): void {
  assignWorkerTask(world, index, MODE_GATHERING, targetId);
  world.gatherPosX[index] = targetX;
  world.gatherPosZ[index] = targetZ;
}

export function isValidPrayerTarget(world: World, target: number, playerId: number): boolean {
  return (
    target >= 0 &&
    target < world.count &&
    world.unitType[target] === TYPE_TEMPLE &&
    isGreekMajorGod(world.playerMajorGod[playerId]!) &&
    isCompletedOwnedBuilding(world, target, playerId)
  );
}

export function tickPrayerTask(
  world: World,
  index: number,
  target: number,
  villagerReach: number,
): void {
  const owner = world.owner[index]!;

  if (!isValidPrayerTarget(world, target, owner)) {
    clearWorkerTask(world, index);
    return;
  }

  const templeStats = UNIT_TYPES[TYPE_TEMPLE]!;
  const targetX = world.posX[target]!;
  const targetZ = world.posZ[target]!;
  const dx = targetX - world.posX[index]!;
  const dz = targetZ - world.posZ[index]!;
  const reach = villagerReach + templeStats.bodyRadius;

  if (dx * dx + dz * dz <= reach * reach) {
    world.moving[index] = 0;
    world.unitField[index] = null;
    setFacingToward(world, index, targetX, targetZ);
    world.prayingVillagers[owner] = world.prayingVillagers[owner]! + 1;
    return;
  }

  const targetGoalCell = cellOf(targetX, targetZ);

  if (world.unitField[index]?.goalCell !== targetGoalCell) {
    assignFieldGoal(world, index, targetX, targetZ, templeStats.footprint);
  }
}
