import type { ChargedMeleeSpecialAttack, UnitTypeStats } from "../content/unit-type-schema";
import { matchesDamageTarget } from "./combat";
import { NO_TARGET } from "./id";

export interface SpecialAttackState {
  readonly specialRecharge: Uint16Array;
  readonly specialActionRemaining: Uint16Array;
  readonly specialActionTarget: Uint32Array;
  readonly specialActionImpactPending: Uint8Array;
}

export function isValidSpecialTarget(
  special: ChargedMeleeSpecialAttack,
  target: UnitTypeStats,
): boolean {
  return special.validTargets.some((predicate) => matchesDamageTarget(predicate, target));
}

export function beginSpecialAttack(
  state: SpecialAttackState,
  index: number,
  targetId: number,
  special: ChargedMeleeSpecialAttack,
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
  special: ChargedMeleeSpecialAttack,
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
