import type { MeleeAttack, MeleeAttackCycle } from "../content/unit-type-schema";
import { isEntityVisibleTo } from "../visibility";
import { centerDistanceForEdgeRange } from "./combat";
import { resolveStableId } from "./id";
import { advanceMeleeAttackCycle } from "./melee-attack-cycles";
import { setFacingToward } from "./navigation";
import { UNIT_TYPES } from "./types";
import type { World } from "./world";

/**
 * Owns one already-started variable melee transaction. Returns true while the
 * authored action still owns the unit; completion lets the ordinary combat
 * pass immediately consider its next order without duplicating lifecycle code.
 */
export function tickActiveMeleeAttack(
  world: World,
  attacker: number,
  attack: MeleeAttack,
  cycle: MeleeAttackCycle,
  neutralOwner: number,
  resolveImpact: (
    world: World,
    attacker: number,
    target: number,
    attack: MeleeAttack,
    cycle: MeleeAttackCycle,
  ) => void,
): boolean {
  world.moving[attacker] = 0;
  world.unitField[attacker] = null;

  const target = resolveStableId(world, world.attackTarget[attacker]!);
  if (target >= 0 && isEntityVisibleTo(world, world.owner[attacker]!, target)) {
    setFacingToward(world, attacker, world.posX[target]!, world.posZ[target]!);
  }

  const phase = advanceMeleeAttackCycle(world, attacker, cycle);
  if (phase === "impact" && target >= 0) {
    const attackerStats = UNIT_TYPES[world.unitType[attacker]!]!;
    const targetStats = UNIT_TYPES[world.unitType[target]!]!;
    const dx = world.posX[target]! - world.posX[attacker]!;
    const dz = world.posZ[target]! - world.posZ[attacker]!;
    const reach = centerDistanceForEdgeRange(attack.range, attackerStats, targetStats);
    if (
      world.dying[target] === 0 &&
      world.hp[target]! > 0 &&
      world.owner[target] !== world.owner[attacker] &&
      world.owner[target] !== neutralOwner &&
      isEntityVisibleTo(world, world.owner[attacker]!, target) &&
      dx * dx + dz * dz <= reach * reach
    ) {
      resolveImpact(world, attacker, target, attack, cycle);
    }
  }

  return phase !== "complete";
}
