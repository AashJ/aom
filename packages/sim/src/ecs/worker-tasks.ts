import type { World } from "./world";
import { isCompletedOwnedBuilding } from "./availability";
import { isGreekMajorGod } from "./favor";
import { assignFieldGoal, setFacingToward } from "./navigation";
import { CULTURE_GREEK, UNIT_CLASS_TEMPLE, UNIT_TYPES } from "./types";
import { cellOf } from "../flow";
import {
  assignUnitTask,
  clearUnitTask,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_PRAYING,
} from "./unit-tasks";

export {
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_IDLE,
  MODE_PRAYING,
  MODE_RETURNING,
  NO_TARGET,
} from "./unit-tasks";

export type AssignedWorkerTaskMode =
  | typeof MODE_GATHERING
  | typeof MODE_BUILDING
  | typeof MODE_PRAYING;

export function assignWorkerTask(
  world: World,
  index: number,
  mode: AssignedWorkerTaskMode,
  targetId: number,
): void {
  assignUnitTask(world, index, mode, targetId);
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
  const targetStats =
    target >= 0 && target < world.count ? UNIT_TYPES[world.unitType[target]!] : null;

  return (
    targetStats !== null &&
    targetStats !== undefined &&
    (targetStats.classes & UNIT_CLASS_TEMPLE) !== 0 &&
    targetStats.culture === CULTURE_GREEK &&
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
    clearUnitTask(world, index);
    return;
  }

  const templeStats = UNIT_TYPES[world.unitType[target]!]!;
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
