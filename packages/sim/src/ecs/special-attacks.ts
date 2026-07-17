import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  type ChargedAreaPulseSpecialAttack,
  type SpecialAttack,
  type UnitTypeStats,
} from "../content/unit-type-schema";
import { matchesDamageTarget, resolveDamage } from "./combat";
import { NO_TARGET } from "./id";

export interface SpecialAttackState {
  readonly specialRecharge: Uint16Array;
  readonly specialActionRemaining: Uint16Array;
  readonly specialActionTarget: Uint32Array;
  readonly specialActionImpactPending: Uint8Array;
}

export function isValidSpecialTarget(special: SpecialAttack, target: UnitTypeStats): boolean {
  return special.validTargets.some((predicate) => matchesDamageTarget(predicate, target));
}

export function beginSpecialAttack(
  state: SpecialAttackState,
  index: number,
  targetId: number,
  special: SpecialAttack,
): void {
  state.specialActionRemaining[index] = special.actionTicks;
  state.specialActionTarget[index] = targetId;
  state.specialActionImpactPending[index] = 1;
}

export function clearSpecialAttack(state: SpecialAttackState, index: number): void {
  state.specialActionRemaining[index] = 0;
  state.specialActionTarget[index] = NO_TARGET;
  state.specialActionImpactPending[index] = 0;
}

export function tickSpecialRecharge(state: SpecialAttackState, index: number): void {
  if (state.specialRecharge[index]! > 0) {
    state.specialRecharge[index] = state.specialRecharge[index]! - 1;
  }
}

export function advanceSpecialAttack(
  state: SpecialAttackState,
  index: number,
  special: SpecialAttack,
): "windup" | "impact" | "recovery" | "complete" {
  const remaining = state.specialActionRemaining[index]!;
  if (remaining === 0) return "complete";

  const next = remaining - 1;
  state.specialActionRemaining[index] = next;

  if (
    state.specialActionImpactPending[index] === 1 &&
    next === special.actionTicks - special.impactDelayTicks
  ) {
    state.specialActionImpactPending[index] = 0;
    state.specialRecharge[index] = special.rechargeTicks;
    return "impact";
  }

  if (next === 0) {
    state.specialActionTarget[index] = NO_TARGET;
    return "complete";
  }
  return state.specialActionImpactPending[index] === 1 ? "windup" : "recovery";
}

export interface AreaPulseWorld {
  readonly count: number;
  readonly posX: Float64Array;
  readonly posZ: Float64Array;
  readonly owner: Uint8Array;
  readonly unitType: Uint16Array;
  readonly hp: Float64Array;
  readonly dying: Uint8Array;
}

export function resolveChargedAreaPulse<W extends AreaPulseWorld>(
  world: W,
  attacker: number,
  special: ChargedAreaPulseSpecialAttack,
  unitTypes: readonly UnitTypeStats[],
  neutralOwner: number,
  dealDamage: (world: W, index: number, damage: number) => void,
): void {
  const attackerOwner = world.owner[attacker]!;
  const centerX = world.posX[attacker]!;
  const centerZ = world.posZ[attacker]!;
  const radiusSq = special.radius * special.radius;

  // Dense ascending order is authoritative. Damage only marks deaths; removal
  // happens after the combat pass, so enumeration cannot invalidate itself.
  for (let target = 0; target < world.count; target += 1) {
    if (target === attacker || world.dying[target] === 1 || world.hp[target] === 0) continue;

    const targetOwner = world.owner[target]!;
    const relation =
      targetOwner === neutralOwner
        ? AREA_DAMAGE_NEUTRAL_UNITS
        : targetOwner !== attackerOwner
          ? AREA_DAMAGE_ENEMIES
          : 0;
    if ((special.damageRelations & relation) === 0) continue;

    const dx = world.posX[target]! - centerX;
    const dz = world.posZ[target]! - centerZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= radiusSq) continue;

    const falloff = 1 - Math.sqrt(distanceSq) / special.radius;
    const targetStats = unitTypes[world.unitType[target]!]!;
    dealDamage(world, target, resolveDamage(special, targetStats) * falloff);
  }
}
