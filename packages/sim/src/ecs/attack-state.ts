import type { FlowField } from "../flow";
import { NO_TARGET } from "./id";

export interface AttackSequenceState {
  readonly attackTarget: Uint32Array;
  readonly attackOrdered: Uint8Array;
  readonly attackAimTarget: Uint32Array;
  readonly attackAimShots: Uint16Array;
  readonly moving: Uint8Array;
  readonly unitField: (FlowField | null)[];
}

export function resetAttackSequence(state: AttackSequenceState, index: number): void {
  state.attackAimTarget[index] = NO_TARGET;
  state.attackAimShots[index] = 0;
}

/** Records one projectile attack cycle and returns the number of prior same-target shots. */
export function advanceProjectileAim(
  state: AttackSequenceState,
  index: number,
  targetId: number,
): number {
  const priorShots = state.attackAimTarget[index] === targetId ? state.attackAimShots[index]! : 0;
  state.attackAimTarget[index] = targetId;
  state.attackAimShots[index] = Math.min(0xffff, priorShots + 1);
  return priorShots;
}

export function clearAttackOrder(state: AttackSequenceState, index: number): void {
  state.attackTarget[index] = NO_TARGET;
  state.attackOrdered[index] = 0;
  resetAttackSequence(state, index);
  state.moving[index] = 0;
  state.unitField[index] = null;
}
