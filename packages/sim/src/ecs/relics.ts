import { cellOf } from "../flow";
import { isEntityVisibleTo } from "../visibility";
import {
  COMMAND_DROP_OFF_RELIC,
  COMMAND_PICK_UP_RELIC,
  type Command,
  type DropOffRelicCommand,
  type PickUpRelicCommand,
} from "../commands";
import { isCompletedOwnedBuilding } from "./availability";
import { assignFieldGoal, setFacingToward } from "./navigation";
import { CULTURE_GREEK, UNIT_CLASS_RELIC, UNIT_CLASS_TEMPLE, UNIT_TYPES } from "./types";
import {
  assignUnitTask,
  clearUnitTask,
  MODE_DROPPING_OFF_RELIC,
  MODE_PICKING_UP_RELIC,
  NO_TARGET,
} from "./unit-tasks";
import { resolveId, unitIdAt, type World } from "./world";

type RelicCommand = PickUpRelicCommand | DropOffRelicCommand;

function isRelic(world: World, index: number): boolean {
  return (
    index >= 0 &&
    index < world.count &&
    world.dying[index] === 0 &&
    world.hp[index]! > 0 &&
    (UNIT_TYPES[world.unitType[index]!]!.classes & UNIT_CLASS_RELIC) !== 0
  );
}

function isGroundRelic(world: World, index: number): boolean {
  return isRelic(world, index) && world.containedBy[index] === NO_TARGET;
}

function isRelicTemple(world: World, index: number, playerId: number): boolean {
  if (index < 0 || index >= world.count) return false;
  const stats = UNIT_TYPES[world.unitType[index]!]!;
  return (
    stats.culture === CULTURE_GREEK &&
    (stats.classes & UNIT_CLASS_TEMPLE) !== 0 &&
    isCompletedOwnedBuilding(world, index, playerId)
  );
}

export function countCarriedRelics(world: World, carrierIndex: number): number {
  const carrierId = unitIdAt(world, carrierIndex);
  let count = 0;
  for (let index = 0; index < world.count; index += 1) {
    if (isRelic(world, index) && world.containedBy[index] === carrierId) count += 1;
  }
  return count;
}

export function firstCarriedRelicId(world: World, carrierIndex: number): number {
  const carrierId = unitIdAt(world, carrierIndex);
  for (let index = 0; index < world.count; index += 1) {
    if (isRelic(world, index) && world.containedBy[index] === carrierId) {
      return unitIdAt(world, index);
    }
  }
  return NO_TARGET;
}

export function canAssignRelicPickup(
  world: World,
  heroIndex: number,
  relicIndex: number,
  playerId: number,
): boolean {
  if (heroIndex < 0 || heroIndex >= world.count) return false;
  const traits = UNIT_TYPES[world.unitType[heroIndex]!]!.hero;
  return (
    traits !== undefined &&
    world.owner[heroIndex] === playerId &&
    world.dying[heroIndex] === 0 &&
    world.hp[heroIndex]! > 0 &&
    isGroundRelic(world, relicIndex) &&
    isEntityVisibleTo(world, playerId, relicIndex) &&
    countCarriedRelics(world, heroIndex) < traits.relicCapacity
  );
}

export function assignRelicPickup(world: World, heroIndex: number, relicId: number): void {
  assignUnitTask(world, heroIndex, MODE_PICKING_UP_RELIC, relicId);
}

export function canAssignRelicDropOff(
  world: World,
  heroIndex: number,
  templeIndex: number,
  playerId: number,
): boolean {
  if (heroIndex < 0 || heroIndex >= world.count) return false;
  return (
    UNIT_TYPES[world.unitType[heroIndex]!]!.hero !== undefined &&
    world.owner[heroIndex] === playerId &&
    world.dying[heroIndex] === 0 &&
    world.hp[heroIndex]! > 0 &&
    countCarriedRelics(world, heroIndex) > 0 &&
    isRelicTemple(world, templeIndex, playerId)
  );
}

export function assignRelicDropOff(world: World, heroIndex: number, templeId: number): void {
  assignUnitTask(world, heroIndex, MODE_DROPPING_OFF_RELIC, templeId);
}

function tickPickup(world: World, heroIndex: number): void {
  const relic = resolveId(world, world.taskTarget[heroIndex]!);
  const traits = UNIT_TYPES[world.unitType[heroIndex]!]!.hero;
  if (
    traits === undefined ||
    !isGroundRelic(world, relic) ||
    countCarriedRelics(world, heroIndex) >= traits.relicCapacity
  ) {
    clearUnitTask(world, heroIndex);
    return;
  }

  const targetX = world.posX[relic]!;
  const targetZ = world.posZ[relic]!;
  const dx = targetX - world.posX[heroIndex]!;
  const dz = targetZ - world.posZ[heroIndex]!;
  const reach = traits.relicPickupRange + UNIT_TYPES[world.unitType[relic]!]!.bodyRadius;

  if (dx * dx + dz * dz <= reach * reach) {
    world.moving[heroIndex] = 0;
    world.unitField[heroIndex] = null;
    setFacingToward(world, heroIndex, targetX, targetZ);
    world.containedBy[relic] = unitIdAt(world, heroIndex);
    world.selectable[relic] = 0;
    world.selected[relic] = 0;
    world.posX[relic] = world.posX[heroIndex]!;
    world.posZ[relic] = world.posZ[heroIndex]!;
    clearUnitTask(world, heroIndex);
    return;
  }

  const targetCell = cellOf(targetX, targetZ);
  if (world.unitField[heroIndex]?.goalCell !== targetCell) {
    assignFieldGoal(world, heroIndex, targetX, targetZ);
  }
}

function tickDropOff(world: World, heroIndex: number): void {
  const temple = resolveId(world, world.taskTarget[heroIndex]!);
  const owner = world.owner[heroIndex]!;
  const traits = UNIT_TYPES[world.unitType[heroIndex]!]!.hero;
  if (
    traits === undefined ||
    countCarriedRelics(world, heroIndex) === 0 ||
    !isRelicTemple(world, temple, owner)
  ) {
    clearUnitTask(world, heroIndex);
    return;
  }

  const templeStats = UNIT_TYPES[world.unitType[temple]!]!;
  const targetX = world.posX[temple]!;
  const targetZ = world.posZ[temple]!;
  const dx = targetX - world.posX[heroIndex]!;
  const dz = targetZ - world.posZ[heroIndex]!;
  const reach = traits.relicDropOffRange + templeStats.bodyRadius;

  if (dx * dx + dz * dz <= reach * reach) {
    const heroId = unitIdAt(world, heroIndex);
    const templeId = unitIdAt(world, temple);
    for (let index = 0; index < world.count; index += 1) {
      if (isRelic(world, index) && world.containedBy[index] === heroId) {
        world.containedBy[index] = templeId;
        world.posX[index] = targetX;
        world.posZ[index] = targetZ;
      }
    }
    world.moving[heroIndex] = 0;
    world.unitField[heroIndex] = null;
    setFacingToward(world, heroIndex, targetX, targetZ);
    clearUnitTask(world, heroIndex);
    return;
  }

  const targetCell = cellOf(targetX, targetZ);
  if (world.unitField[heroIndex]?.goalCell !== targetCell) {
    assignFieldGoal(world, heroIndex, targetX, targetZ, templeStats.footprint);
  }
}

export function tickRelicTask(world: World, index: number): boolean {
  if (world.mode[index] === MODE_PICKING_UP_RELIC) {
    if (world.dying[index] === 0 && world.hp[index]! > 0) tickPickup(world, index);
    return true;
  }
  if (world.mode[index] === MODE_DROPPING_OFF_RELIC) {
    if (world.dying[index] === 0 && world.hp[index]! > 0) tickDropOff(world, index);
    return true;
  }
  return false;
}

export function isRelicCommand(command: Command): command is RelicCommand {
  return command.type === COMMAND_PICK_UP_RELIC || command.type === COMMAND_DROP_OFF_RELIC;
}

export function applyRelicCommand(world: World, command: RelicCommand): void {
  const target = resolveId(world, command.targetId);
  if (target < 0) return;

  if (command.type === COMMAND_PICK_UP_RELIC) {
    for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
      const hero = resolveId(world, command.unitIds[unitIndex]!);
      if (!canAssignRelicPickup(world, hero, target, command.issuer)) continue;
      assignRelicPickup(world, hero, command.targetId);
      // A single relic can only be promised to one hero per command.
      return;
    }
    return;
  }

  for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
    const hero = resolveId(world, command.unitIds[unitIndex]!);
    if (!canAssignRelicDropOff(world, hero, target, command.issuer)) continue;
    assignRelicDropOff(world, hero, command.targetId);
  }
}

export function syncContainedRelics(world: World): void {
  for (let index = 0; index < world.count; index += 1) {
    if (!isRelic(world, index) || world.containedBy[index] === NO_TARGET) continue;
    const container = resolveId(world, world.containedBy[index]!);
    if (container < 0 || world.dying[container] === 1 || world.hp[container]! <= 0) continue;
    world.posX[index] = world.posX[container]!;
    world.posZ[index] = world.posZ[container]!;
  }
}

export function releaseContainedRelics(world: World, containerIndex: number): void {
  const containerId = unitIdAt(world, containerIndex);
  for (let index = 0; index < world.count; index += 1) {
    if (!isRelic(world, index) || world.containedBy[index] !== containerId) continue;
    world.containedBy[index] = NO_TARGET;
    world.posX[index] = world.posX[containerIndex]!;
    world.posZ[index] = world.posZ[containerIndex]!;
    world.selectable[index] = 1;
  }
}
