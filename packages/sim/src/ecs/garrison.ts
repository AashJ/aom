import {
  COMMAND_GARRISON,
  COMMAND_UNGARRISON,
  type Command,
  type GarrisonCommand,
  type UngarrisonCommand,
} from "../commands";
import { matchesDamageTarget } from "./combat";
import { MAP_TILES } from "../terrain";
import {
  assignFieldGoal,
  movementDomainForType,
  navigableCellNear,
  navigationGridForDomain,
  setFacingToward,
} from "./navigation";
import { UNIT_CLASS_RELIC, UNIT_TYPES } from "./types";
import { assignUnitTask, clearUnitTask, MODE_ENTERING_GARRISON, NO_TARGET } from "./unit-tasks";
import { resolveId, unitIdAt, type World } from "./world";

type GarrisonCommandType = GarrisonCommand | UngarrisonCommand;

const EJECT_OFFSETS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

export function countGarrisonedUnits(world: World, containerIndex: number): number {
  if (containerIndex < 0 || containerIndex >= world.count) return 0;
  const containerId = unitIdAt(world, containerIndex);
  let count = 0;
  for (let index = 0; index < world.count; index += 1) {
    if (
      world.containedBy[index] === containerId &&
      (UNIT_TYPES[world.unitType[index]!]!.classes & UNIT_CLASS_RELIC) === 0
    ) {
      count += 1;
    }
  }
  return count;
}

export function garrisonAttackMultiplier(world: World, containerIndex: number): number {
  const traits = UNIT_TYPES[world.unitType[containerIndex]!]!.garrison;
  return traits === undefined
    ? 1
    : 1 + countGarrisonedUnits(world, containerIndex) * traits.attackMultiplierPerOccupant;
}

function wouldCreateContainmentCycle(
  world: World,
  unitIndex: number,
  containerIndex: number,
): boolean {
  const unitId = unitIdAt(world, unitIndex);
  let current = containerIndex;
  for (let depth = 0; depth < world.count; depth += 1) {
    if (unitIdAt(world, current) === unitId) return true;
    const parentId = world.containedBy[current]!;
    if (parentId === NO_TARGET) return false;
    current = resolveId(world, parentId);
    if (current < 0) return false;
  }
  return true;
}

export function canEnterGarrison(
  world: World,
  unitIndex: number,
  containerIndex: number,
  playerId: number,
): boolean {
  if (
    unitIndex < 0 ||
    unitIndex >= world.count ||
    containerIndex < 0 ||
    containerIndex >= world.count ||
    unitIndex === containerIndex ||
    world.owner[unitIndex] !== playerId ||
    world.owner[containerIndex] !== playerId ||
    world.dying[unitIndex] === 1 ||
    world.hp[unitIndex]! <= 0 ||
    world.dying[containerIndex] === 1 ||
    world.hp[containerIndex]! <= 0 ||
    world.buildProgress[containerIndex]! < UNIT_TYPES[world.unitType[containerIndex]!]!.buildTicks ||
    world.containedBy[unitIndex] !== NO_TARGET ||
    world.containedBy[containerIndex] !== NO_TARGET
  ) {
    return false;
  }
  const traits = UNIT_TYPES[world.unitType[containerIndex]!]!.garrison;
  if (
    traits === undefined ||
    countGarrisonedUnits(world, containerIndex) >= traits.capacity ||
    wouldCreateContainmentCycle(world, unitIndex, containerIndex)
  ) {
    return false;
  }
  const unitStats = UNIT_TYPES[world.unitType[unitIndex]!]!;
  return traits.validOccupants.some((target) => matchesDamageTarget(target, unitStats));
}

export function assignGarrisonTask(world: World, unitIndex: number, containerId: number): void {
  assignUnitTask(world, unitIndex, MODE_ENTERING_GARRISON, containerId);
}

export function tickGarrisonTask(world: World, unitIndex: number): boolean {
  if (world.mode[unitIndex] !== MODE_ENTERING_GARRISON) return false;
  const container = resolveId(world, world.taskTarget[unitIndex]!);
  if (!canEnterGarrison(world, unitIndex, container, world.owner[unitIndex]!)) {
    clearUnitTask(world, unitIndex);
    return true;
  }
  const traits = UNIT_TYPES[world.unitType[container]!]!.garrison!;
  const containerStats = UNIT_TYPES[world.unitType[container]!]!;
  const targetX = world.posX[container]!;
  const targetZ = world.posZ[container]!;
  const dx = targetX - world.posX[unitIndex]!;
  const dz = targetZ - world.posZ[unitIndex]!;
  const reach = traits.enterRange + containerStats.bodyRadius;
  if (dx * dx + dz * dz <= reach * reach) {
    world.moving[unitIndex] = 0;
    world.unitField[unitIndex] = null;
    setFacingToward(world, unitIndex, targetX, targetZ);
    const containerId = unitIdAt(world, container);
    clearUnitTask(world, unitIndex);
    world.containedBy[unitIndex] = containerId;
    world.selectable[unitIndex] = 0;
    world.selected[unitIndex] = 0;
    world.posX[unitIndex] = targetX;
    world.posZ[unitIndex] = targetZ;
    return true;
  }
  const movementDomain = movementDomainForType(world.unitType[unitIndex]!);
  const boardingCell = navigableCellNear(world, targetX, targetZ, movementDomain);
  const navigationGrid = navigationGridForDomain(world, movementDomain);
  if (navigationGrid[boardingCell] !== 1) {
    clearUnitTask(world, unitIndex);
    return true;
  }
  assignFieldGoal(
    world,
    unitIndex,
    (boardingCell % MAP_TILES) + 0.5,
    Math.floor(boardingCell / MAP_TILES) + 0.5,
  );
  return true;
}

export function syncContainedUnits(world: World): void {
  for (let index = 0; index < world.count; index += 1) {
    if (world.containedBy[index] === NO_TARGET) continue;
    let container = resolveId(world, world.containedBy[index]!);
    if (container < 0) continue;
    let outer = container;
    for (let depth = 0; depth < world.count; depth += 1) {
      const parent = world.containedBy[outer]!;
      if (parent === NO_TARGET) break;
      const resolved = resolveId(world, parent);
      if (resolved < 0) break;
      outer = resolved;
    }
    world.posX[index] = world.posX[outer]!;
    world.posZ[index] = world.posZ[outer]!;
  }
}

export function releaseGarrisonedUnits(world: World, containerIndex: number): void {
  const traits = UNIT_TYPES[world.unitType[containerIndex]!]!.garrison;
  if (traits === undefined) return;
  const containerId = unitIdAt(world, containerIndex);
  let released = 0;
  for (let index = 0; index < world.count; index += 1) {
    if (
      world.containedBy[index] !== containerId ||
      (UNIT_TYPES[world.unitType[index]!]!.classes & UNIT_CLASS_RELIC) !== 0
    ) {
      continue;
    }
    if (releaseGarrisonedUnit(world, index, released)) released += 1;
  }
}

export function releaseGarrisonedUnit(world: World, unitIndex: number, releaseOrder = 0): boolean {
  if (unitIndex < 0 || unitIndex >= world.count) return false;
  const containerIndex = resolveId(world, world.containedBy[unitIndex]!);
  if (containerIndex < 0) return false;
  const offset = EJECT_OFFSETS[releaseOrder % EJECT_OFFSETS.length]!;
  const ring = 1 + Math.floor(releaseOrder / EJECT_OFFSETS.length);
  const preferredX = Math.min(
    MAP_TILES - 0.5,
    Math.max(0.5, world.posX[containerIndex]! + offset[0] * ring),
  );
  const preferredZ = Math.min(
    MAP_TILES - 0.5,
    Math.max(0.5, world.posZ[containerIndex]! + offset[1] * ring),
  );
  const movementDomain = movementDomainForType(world.unitType[unitIndex]!);
  const releaseCell = navigableCellNear(world, preferredX, preferredZ, movementDomain);
  const releaseGrid = navigationGridForDomain(world, movementDomain);
  if (releaseGrid[releaseCell] !== 1) return false;

  world.containedBy[unitIndex] = NO_TARGET;
  world.posX[unitIndex] = (releaseCell % MAP_TILES) + 0.5;
  world.posZ[unitIndex] = Math.floor(releaseCell / MAP_TILES) + 0.5;
  world.selectable[unitIndex] = 1;
  world.moving[unitIndex] = 0;
  world.unitField[unitIndex] = null;
  return true;
}

export function isGarrisonCommand(command: Command): command is GarrisonCommandType {
  return command.type === COMMAND_GARRISON || command.type === COMMAND_UNGARRISON;
}

export function applyGarrisonCommand(world: World, command: GarrisonCommandType): void {
  if (command.type === COMMAND_UNGARRISON) {
    const container = resolveId(world, command.containerId);
    if (
      container >= 0 &&
      world.owner[container] === command.issuer &&
      world.dying[container] === 0 &&
      world.hp[container]! > 0
    ) {
      releaseGarrisonedUnits(world, container);
    }
    return;
  }
  const container = resolveId(world, command.targetId);
  if (container < 0) return;
  for (const unitId of command.unitIds) {
    const unit = resolveId(world, unitId);
    if (!canEnterGarrison(world, unit, container, command.issuer)) continue;
    assignGarrisonTask(world, unit, command.targetId);
  }
}
