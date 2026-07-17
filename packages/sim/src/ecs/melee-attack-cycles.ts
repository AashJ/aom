import type { MeleeAttack, MeleeAttackCycle } from "../content/unit-type-schema";

export const NO_MELEE_ATTACK_VARIANT = 0xff;

export interface MeleeAttackCycleState {
  readonly attackCooldown: Uint16Array;
  readonly meleeActionVariant: Uint8Array;
  readonly meleeActionImpactPending: Uint8Array;
}

export function activeMeleeAttackCycle(
  state: MeleeAttackCycleState,
  index: number,
  attack: MeleeAttack,
): MeleeAttackCycle | null {
  const variant = state.meleeActionVariant[index]!;
  if (variant === NO_MELEE_ATTACK_VARIANT) return null;
  const cycle = attack.cycleVariants?.[variant];
  if (cycle === undefined) {
    throw new RangeError(`Stored melee attack variant ${variant} is not authored.`);
  }
  return cycle;
}

export function beginMeleeAttackCycle(
  state: MeleeAttackCycleState,
  index: number,
  attack: MeleeAttack,
  randomValue: number,
): MeleeAttackCycle | null {
  const variants = attack.cycleVariants;
  if (variants === undefined) return null;
  const variant = Math.min(variants.length - 1, Math.floor(randomValue * variants.length));
  const cycle = variants[variant]!;
  state.attackCooldown[index] = cycle.actionTicks;
  state.meleeActionVariant[index] = variant;
  state.meleeActionImpactPending[index] = 1;
  return cycle;
}

export function interruptMeleeAttackCycle(state: MeleeAttackCycleState, index: number): void {
  state.meleeActionVariant[index] = NO_MELEE_ATTACK_VARIANT;
  state.meleeActionImpactPending[index] = 0;
}

export function advanceMeleeAttackCycle(
  state: MeleeAttackCycleState,
  index: number,
  cycle: MeleeAttackCycle,
): "windup" | "impact" | "recovery" | "complete" {
  const remaining = state.attackCooldown[index]!;
  if (remaining === 0) {
    interruptMeleeAttackCycle(state, index);
    return "complete";
  }

  const next = remaining - 1;
  state.attackCooldown[index] = next;

  if (
    state.meleeActionImpactPending[index] === 1 &&
    next === cycle.actionTicks - cycle.impactDelayTicks
  ) {
    state.meleeActionImpactPending[index] = 0;
    return "impact";
  }
  if (next === 0) {
    interruptMeleeAttackCycle(state, index);
    return "complete";
  }
  return state.meleeActionImpactPending[index] === 1 ? "windup" : "recovery";
}
