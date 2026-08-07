import {
  COMMAND_EMPOWER,
  COMMAND_HEAL,
  type ConvertCommand,
  type EmpowerCommand,
  type HealCommand,
} from "../commands";
import { TICK_S } from "../clock";
import { isEntityVisibleTo } from "../visibility";
import {
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_HUNTABLE,
  UNIT_TYPES,
  type EmpowerTraits,
} from "./types";
import { resolveStableId, stableIdAt } from "./id";
import { assignFieldGoal, setFacingToward } from "./navigation";
import { effectiveMaxHp } from "./unit-age";
import {
  clearUnitTask,
  MODE_CONVERTING,
  MODE_EMPOWERING,
  MODE_HEALING,
  MODE_IDLE,
  NO_TARGET,
} from "./unit-tasks";
import type { World } from "./world";

const NEUTRAL_OWNER = 255;

export type SupportCommand = HealCommand | EmpowerCommand | ConvertCommand;

function resolveId(world: World, id: number): number {
  return resolveStableId(world, id);
}

function supportTargetIsValid(
  world: World,
  source: number,
  target: number,
  mode: typeof MODE_HEALING | typeof MODE_EMPOWERING | typeof MODE_CONVERTING,
): boolean {
  if (
    target < 0 ||
    world.dying[source] === 1 ||
    world.dying[target] === 1 ||
    world.hp[source]! <= 0 ||
    world.hp[target]! <= 0 ||
    world.containedBy[source] !== NO_TARGET
  ) {
    return false;
  }
  const sourceStats = UNIT_TYPES[world.unitType[source]!]!;
  const targetStats = UNIT_TYPES[world.unitType[target]!]!;
  if (mode === MODE_HEALING) {
    return (
      sourceStats.heal !== undefined &&
      world.owner[target] === world.owner[source] &&
      targetStats.healable !== false &&
      (targetStats.classes & UNIT_CLASS_BUILDING) === 0 &&
      world.hp[target]! < effectiveMaxHp(targetStats, world.playerAge[world.owner[target]!]!)
    );
  }
  if (mode === MODE_EMPOWERING) {
    return (
      sourceStats.empower !== undefined &&
      (sourceStats.empower.requiredMajorGod === undefined ||
        world.playerMajorGod[world.owner[source]!] === sourceStats.empower.requiredMajorGod) &&
      world.owner[target] === world.owner[source] &&
      (targetStats.classes & UNIT_CLASS_BUILDING) !== 0
    );
  }
  return (
    sourceStats.convert !== undefined &&
    (sourceStats.convert.requiredMajorGod === undefined ||
      world.playerMajorGod[world.owner[source]!] === sourceStats.convert.requiredMajorGod) &&
    world.owner[target] === NEUTRAL_OWNER &&
    (targetStats.classes & UNIT_CLASS_HUNTABLE) !== 0
  );
}

function assignSupportTask(
  world: World,
  source: number,
  targetId: number,
  mode: typeof MODE_HEALING | typeof MODE_EMPOWERING | typeof MODE_CONVERTING,
): void {
  const target = resolveId(world, targetId);
  if (!supportTargetIsValid(world, source, target, mode)) return;
  clearUnitTask(world, source);
  world.mode[source] = mode;
  world.taskTarget[source] = targetId;
  assignFieldGoal(world, source, world.posX[target]!, world.posZ[target]!);
}

export function applySupportCommand(world: World, command: SupportCommand): void {
  const target = resolveId(world, command.targetId);
  if (target < 0 || !isEntityVisibleTo(world, command.issuer, target)) return;
  const mode =
    command.type === COMMAND_HEAL
      ? MODE_HEALING
      : command.type === COMMAND_EMPOWER
        ? MODE_EMPOWERING
        : MODE_CONVERTING;
  for (const id of command.unitIds) {
    const source = resolveId(world, id);
    if (source < 0 || world.owner[source] !== command.issuer) continue;
    assignSupportTask(world, source, command.targetId, mode);
  }
}

function targetTicks(world: World, source: number, target: number): number {
  const traits = UNIT_TYPES[world.unitType[source]!]!.convert!;
  return (
    traits.targetTicks?.find((entry) => entry.unitType === world.unitType[target])?.ticks ??
    traits.baseTicks
  );
}

export function tickSupportTask(world: World, source: number): boolean {
  const mode = world.mode[source]!;
  if (mode !== MODE_HEALING && mode !== MODE_EMPOWERING && mode !== MODE_CONVERTING) return false;
  const target = resolveId(world, world.taskTarget[source]!);
  if (!supportTargetIsValid(world, source, target, mode)) {
    clearUnitTask(world, source);
    return true;
  }
  const sourceStats = UNIT_TYPES[world.unitType[source]!]!;
  const targetStats = UNIT_TYPES[world.unitType[target]!]!;
  const range =
    mode === MODE_HEALING
      ? sourceStats.heal!.range
      : mode === MODE_EMPOWERING
        ? sourceStats.empower!.range
        : sourceStats.convert!.range;
  const dx = world.posX[target]! - world.posX[source]!;
  const dz = world.posZ[target]! - world.posZ[source]!;
  const reach = range + targetStats.bodyRadius;
  if (dx * dx + dz * dz > reach * reach) {
    const goalCellChanged =
      world.moveTargetX[source] !== world.posX[target] ||
      world.moveTargetZ[source] !== world.posZ[target];
    if (goalCellChanged) {
      assignFieldGoal(world, source, world.posX[target]!, world.posZ[target]!);
    }
    return true;
  }

  world.moving[source] = 0;
  world.unitField[source] = null;
  setFacingToward(world, source, world.posX[target]!, world.posZ[target]!);
  if (mode === MODE_HEALING) {
    const targetIsActive =
      world.moving[target] === 1 ||
      world.mode[target] !== MODE_IDLE ||
      world.attackTarget[target] !== NO_TARGET;
    const multiplier = targetIsActive ? sourceStats.heal!.activeTargetMultiplier : 1;
    const targetMaxHp = effectiveMaxHp(targetStats, world.playerAge[world.owner[target]!]!);
    world.hp[target] = Math.min(
      targetMaxHp,
      world.hp[target]! + sourceStats.heal!.hitPointsPerSecond * multiplier * TICK_S,
    );
    if (world.hp[target] === targetMaxHp) clearUnitTask(world, source);
  } else if (mode === MODE_CONVERTING) {
    if (world.supportActionRemaining[source] === 0) {
      world.supportActionRemaining[source] = targetTicks(world, source, target);
    }
    world.supportActionRemaining[source] = world.supportActionRemaining[source]! - 1;
    if (world.supportActionRemaining[source] === 0) {
      world.owner[target] = world.owner[source]!;
      clearUnitTask(world, target);
      clearUnitTask(world, source);
    }
  }
  // Empowering intentionally remains active until another order interrupts it.
  return true;
}

export function empowermentAt(world: World, building: number): EmpowerTraits | null {
  const buildingId = stableIdAt(world, building);
  let bestSource = -1;
  for (let source = 0; source < world.count; source += 1) {
    if (
      world.mode[source] !== MODE_EMPOWERING ||
      world.taskTarget[source] !== (buildingId >>> 0) ||
      world.owner[source] !== world.owner[building] ||
      world.dying[source] === 1 ||
      world.hp[source]! <= 0
    ) {
      continue;
    }
    const traits = UNIT_TYPES[world.unitType[source]!]!.empower;
    if (
      traits === undefined ||
      (traits.requiredMajorGod !== undefined &&
        world.playerMajorGod[world.owner[source]!] !== traits.requiredMajorGod)
    ) {
      continue;
    }
    const dx = world.posX[building]! - world.posX[source]!;
    const dz = world.posZ[building]! - world.posZ[source]!;
    const reach = traits.range + UNIT_TYPES[world.unitType[building]!]!.bodyRadius;
    if (dx * dx + dz * dz <= reach * reach) {
      if (bestSource < 0 || world.handleOf[source]! < world.handleOf[bestSource]!) bestSource = source;
    }
  }
  return bestSource < 0 ? null : UNIT_TYPES[world.unitType[bestSource]!]!.empower!;
}
