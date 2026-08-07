import {
  AREA_DAMAGE_ALLIES,
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_BUILDINGS,
  AREA_DAMAGE_NEUTRAL_UNITS,
  UNIT_CLASS_BUILDING,
  type ChargedAreaPulseSpecialAttack,
  type ChargedConeThrowSpecialAttack,
  type ChargedJumpSpecialAttack,
  type ChargedPickupThrowSpecialAttack,
  type DamageBonus,
  type DamageProfile,
  type MeleeAttack,
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
  readonly specialActionStartX: Float64Array;
  readonly specialActionStartZ: Float64Array;
}

export function isValidSpecialTarget(
  special: SpecialAttack,
  target: UnitTypeStats,
  targetConditions = 0,
): boolean {
  return (
    (targetConditions & (special.invalidTargetConditions ?? 0)) === 0 &&
    special.validTargets.some((predicate) => matchesDamageTarget(predicate, target))
  );
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

export function beginJumpSpecialAttack(
  state: SpecialAttackState,
  index: number,
  targetId: number,
  special: ChargedJumpSpecialAttack,
  startX: number,
  startZ: number,
): void {
  beginSpecialAttack(state, index, targetId, special);
  state.specialActionStartX[index] = startX;
  state.specialActionStartZ[index] = startZ;
}

export function beginPickupThrowSpecialAttack(
  state: SpecialAttackState,
  index: number,
  targetId: number,
  special: ChargedPickupThrowSpecialAttack,
  targetX: number,
  targetZ: number,
): void {
  beginSpecialAttack(state, index, targetId, special);
  state.specialActionStartX[index] = targetX;
  state.specialActionStartZ[index] = targetZ;
}

export function clearSpecialAttack(state: SpecialAttackState, index: number): void {
  state.specialActionRemaining[index] = 0;
  state.specialActionTarget[index] = NO_TARGET;
  state.specialActionImpactPending[index] = 0;
  state.specialActionStartX[index] = 0;
  state.specialActionStartZ[index] = 0;
}

export function jumpFlightProgress(
  special: ChargedJumpSpecialAttack,
  remainingTicks: number,
): number {
  const elapsedTicks = special.actionTicks - remainingTicks;
  if (elapsedTicks <= special.takeoffTicks) return 0;
  if (elapsedTicks >= special.takeoffTicks + special.flightTicks) return 1;
  return (elapsedTicks - special.takeoffTicks) / special.flightTicks;
}

export function jumpElevation(special: ChargedJumpSpecialAttack, remainingTicks: number): number {
  const progress = jumpFlightProgress(special, remainingTicks);
  return 4 * special.jumpHeight * progress * (1 - progress);
}

export function updateJumpSpecialPosition(
  state: SpecialAttackState & {
    readonly posX: Float64Array;
    readonly posZ: Float64Array;
    readonly moveTargetX: Float64Array;
    readonly moveTargetZ: Float64Array;
  },
  index: number,
  special: ChargedJumpSpecialAttack,
): void {
  const progress = jumpFlightProgress(special, state.specialActionRemaining[index]!);
  const startX = state.specialActionStartX[index]!;
  const startZ = state.specialActionStartZ[index]!;
  state.posX[index] = startX + (state.moveTargetX[index]! - startX) * progress;
  state.posZ[index] = startZ + (state.moveTargetZ[index]! - startZ) * progress;
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
    if (next === 0) {
      state.specialActionTarget[index] = NO_TARGET;
      state.specialActionStartX[index] = 0;
      state.specialActionStartZ[index] = 0;
    }
    return "impact";
  }

  if (next === 0) {
    state.specialActionImpactPending[index] = 0;
    state.specialActionTarget[index] = NO_TARGET;
    state.specialActionStartX[index] = 0;
    state.specialActionStartZ[index] = 0;
    return "complete";
  }
  return state.specialActionImpactPending[index] === 1 ? "windup" : "recovery";
}

export function advancePickupThrowSpecialAttack(
  state: SpecialAttackState,
  index: number,
  special: ChargedPickupThrowSpecialAttack,
): "windup" | "pickup" | "held" | "throw" | "recovery" | "complete" {
  const remaining = state.specialActionRemaining[index]!;
  if (remaining === 0) return "complete";

  const next = remaining - 1;
  state.specialActionRemaining[index] = next;
  const elapsed = special.actionTicks - next;

  if (state.specialActionImpactPending[index] === 1 && elapsed === special.pickupDelayTicks) {
    state.specialActionImpactPending[index] = 2;
    state.specialRecharge[index] = special.rechargeTicks;
    return "pickup";
  }

  if (state.specialActionImpactPending[index] === 2 && elapsed === special.throwDelayTicks) {
    // Stage 3 keeps the dedicated throw action committed through recovery.
    // The carried entity remains hidden while the authored combined mesh
    // presents the victim's flight, then dies at full action completion.
    state.specialActionImpactPending[index] = 3;
    return "throw";
  }

  if (next === 0) {
    state.specialActionImpactPending[index] = 0;
    state.specialActionTarget[index] = NO_TARGET;
    state.specialActionStartX[index] = 0;
    state.specialActionStartZ[index] = 0;
    return "complete";
  }
  if (state.specialActionImpactPending[index] === 1) return "windup";
  if (state.specialActionImpactPending[index] === 2) return "held";
  return "recovery";
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

export interface ConeThrowWorld extends AreaPulseWorld {
  readonly facingX: Float64Array;
  readonly facingZ: Float64Array;
  readonly unitConditions: Uint8Array;
}

interface AreaDamageAttack {
  readonly damage: DamageProfile;
  readonly radius: number;
  readonly falloff: "constant" | "linear";
  readonly damageRelations: number;
  readonly bonuses: readonly DamageBonus[];
}

function areaDamageRelation(
  sourceOwner: number,
  targetOwner: number,
  targetStats: UnitTypeStats,
  neutralOwner: number,
): number {
  if (targetOwner === neutralOwner) {
    return (targetStats.classes & UNIT_CLASS_BUILDING) === 0
      ? AREA_DAMAGE_NEUTRAL_UNITS
      : AREA_DAMAGE_NEUTRAL_BUILDINGS;
  }
  return targetOwner === sourceOwner ? AREA_DAMAGE_ALLIES : AREA_DAMAGE_ENEMIES;
}

export function resolveAreaDamageAt<W extends AreaPulseWorld>(
  world: W,
  sourceOwner: number,
  centerX: number,
  centerZ: number,
  attack: AreaDamageAttack,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  neutralOwner: number,
  dealDamage: (world: W, index: number, damage: number) => void,
  excludedIndex = -1,
): void {
  const radiusSq = attack.radius * attack.radius;

  // Dense ascending order is authoritative. Damage only marks deaths; removal
  // happens after the combat pass, so enumeration cannot invalidate itself.
  for (let target = 0; target < world.count; target += 1) {
    if (target === excludedIndex || world.dying[target] === 1 || world.hp[target] === 0) continue;

    const targetOwner = world.owner[target]!;
    const targetStats = unitTypes[world.unitType[target]!]!;
    const relation = areaDamageRelation(sourceOwner, targetOwner, targetStats, neutralOwner);
    if ((attack.damageRelations & relation) === 0) continue;

    const dx = world.posX[target]! - centerX;
    const dz = world.posZ[target]! - centerZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > radiusSq) continue;

    const falloff = attack.falloff === "linear" ? 1 - Math.sqrt(distanceSq) / attack.radius : 1;
    if (falloff <= 0) continue;
    dealDamage(world, target, resolveDamage(attack, targetStats) * falloff);
  }
}

export function resolveMeleeImpactAreaAt<W extends AreaPulseWorld>(
  world: W,
  sourceOwner: number,
  centerX: number,
  centerZ: number,
  attack: MeleeAttack,
  damageMultiplier: number,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  neutralOwner: number,
  dealDamage: (world: W, index: number, damage: number) => void,
  excludedIndex = -1,
): void {
  const impactArea = attack.impactArea;
  if (impactArea === undefined) return;
  const radiusSq = impactArea.radius * impactArea.radius;

  for (let target = 0; target < world.count; target += 1) {
    if (target === excludedIndex || world.dying[target] === 1 || world.hp[target] === 0) continue;

    const targetStats = unitTypes[world.unitType[target]!]!;
    const relation = areaDamageRelation(
      sourceOwner,
      world.owner[target]!,
      targetStats,
      neutralOwner,
    );
    const dx = world.posX[target]! - centerX;
    const dz = world.posZ[target]! - centerZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > radiusSq) continue;

    const falloff =
      impactArea.falloff === "linear" ? 1 - Math.sqrt(distanceSq) / impactArea.radius : 1;
    if (falloff <= 0) continue;

    let damage = 0;
    for (const component of impactArea.components) {
      if ((component.damageRelations & relation) === 0) continue;
      damage +=
        resolveDamage({ damage: component.damage, bonuses: attack.bonuses }, targetStats) *
        damageMultiplier *
        falloff;
    }
    if (damage > 0) dealDamage(world, target, damage);
  }
}

export function resolveChargedAreaPulse<W extends AreaPulseWorld>(
  world: W,
  attacker: number,
  special: ChargedAreaPulseSpecialAttack,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  neutralOwner: number,
  dealDamage: (world: W, index: number, damage: number) => void,
): void {
  resolveAreaDamageAt(
    world,
    world.owner[attacker]!,
    world.posX[attacker]!,
    world.posZ[attacker]!,
    special,
    unitTypes,
    neutralOwner,
    dealDamage,
    attacker,
  );
}

export function resolveChargedConeThrow<W extends ConeThrowWorld>(
  world: W,
  attacker: number,
  special: ChargedConeThrowSpecialAttack,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  neutralOwner: number,
  dealDamage: (world: W, index: number, damage: number) => void,
  afterSurvivingHit: (index: number) => void,
): void {
  if (special.coneHalfAngleDegrees !== 45) {
    throw new RangeError(
      `Unsupported authoritative cone half-angle ${special.coneHalfAngleDegrees}.`,
    );
  }

  const sourceOwner = world.owner[attacker]!;
  const centerX = world.posX[attacker]!;
  const centerZ = world.posZ[attacker]!;
  const facingX = world.facingX[attacker]!;
  const facingZ = world.facingZ[attacker]!;
  const radiusSq = special.radius * special.radius;

  // BuckAttack walks the synchronized candidate array in ascending identity
  // order. Its 45-degree test is equivalent to dot² >= distance² / 2 while
  // requiring a non-negative forward dot, avoiding platform trig here.
  for (let target = 0; target < world.count; target += 1) {
    if (target === attacker || world.dying[target] === 1 || world.hp[target] === 0) continue;
    const targetStats = unitTypes[world.unitType[target]!]!;
    if (!isValidSpecialTarget(special, targetStats, world.unitConditions[target]!)) continue;

    const targetOwner = world.owner[target]!;
    const relation =
      targetOwner === neutralOwner
        ? (targetStats.classes & UNIT_CLASS_BUILDING) === 0
          ? AREA_DAMAGE_NEUTRAL_UNITS
          : 0
        : targetOwner !== sourceOwner
          ? AREA_DAMAGE_ENEMIES
          : 0;
    if ((special.damageRelations & relation) === 0) continue;

    const dx = world.posX[target]! - centerX;
    const dz = world.posZ[target]! - centerZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > radiusSq) continue;
    const forwardDot = facingX * dx + facingZ * dz;
    if (forwardDot < 0 || forwardDot * forwardDot < distanceSq * 0.5) continue;

    dealDamage(world, target, resolveDamage(special, targetStats));
    if (world.dying[target] === 0 && world.hp[target]! > 0) afterSurvivingHit(target);
  }
}

export function resolveChargedJump<W extends AreaPulseWorld>(
  world: W,
  attacker: number,
  special: Extract<ChargedJumpSpecialAttack, { readonly delivery: "area" }>,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  neutralOwner: number,
  dealDamage: (world: W, index: number, damage: number) => void,
): void {
  resolveAreaDamageAt(
    world,
    world.owner[attacker]!,
    world.posX[attacker]!,
    world.posZ[attacker]!,
    special,
    unitTypes,
    neutralOwner,
    dealDamage,
    attacker,
  );
}
