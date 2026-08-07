import { TICK_S } from "../clock";
import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  UNIT_CLASS_BUILDING,
  type ChargedAreaPoisonSpecialAttack,
  type UnitTypeStats,
} from "../content/unit-type-schema";
import { matchesDamageTarget, resolveDamage } from "./combat";
import { idGeneration, idIndex, stableIdAt, type StableIdLookupState } from "./id";

export const MAX_POISON_EFFECTS = 40_000;

export interface PoisonEffectStore {
  count: number;
  readonly targetIds: Uint32Array;
  readonly sourceIds: Uint32Array;
  readonly sourceTypes: Uint16Array;
  readonly remainingTicks: Uint16Array;
  readonly startTicks: Uint32Array;
  readonly damageMultipliers: Float64Array;
}

export interface PoisonEffectWorld extends StableIdLookupState {
  readonly count: number;
  readonly tick: number;
  readonly owner: Uint8Array;
  readonly posX: Float64Array;
  readonly posZ: Float64Array;
  readonly unitType: Uint16Array;
  readonly hp: Float64Array;
  readonly dying: Uint8Array;
}

export type ApplyPoisonDamage<W extends PoisonEffectWorld> = (
  world: W,
  targetIndex: number,
  damage: number,
  sourceIndex: number,
) => void;

export function createPoisonEffectStore(capacity = MAX_POISON_EFFECTS): PoisonEffectStore {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError("Poison-effect capacity must be a positive integer.");
  }
  return {
    count: 0,
    targetIds: new Uint32Array(capacity),
    sourceIds: new Uint32Array(capacity),
    sourceTypes: new Uint16Array(capacity),
    remainingTicks: new Uint16Array(capacity),
    startTicks: new Uint32Array(capacity),
    damageMultipliers: new Float64Array(capacity),
  };
}

function resolveLiveId(world: PoisonEffectWorld, id: number): number {
  const handle = idIndex(id);
  if (handle >= world.nextHandle || world.generation[handle] !== idGeneration(id)) return -1;
  const index = world.slotOf[handle]!;
  return index >= 0 && index < world.count && world.dying[index] === 0 && world.hp[index]! > 0
    ? index
    : -1;
}

function removePoisonEffect(store: PoisonEffectStore, index: number): void {
  const last = store.count - 1;
  if (index !== last) {
    store.targetIds[index] = store.targetIds[last]!;
    store.sourceIds[index] = store.sourceIds[last]!;
    store.sourceTypes[index] = store.sourceTypes[last]!;
    store.remainingTicks[index] = store.remainingTicks[last]!;
    store.startTicks[index] = store.startTicks[last]!;
    store.damageMultipliers[index] = store.damageMultipliers[last]!;
  }
  store.count = last;
}

export function installAreaPoison<W extends PoisonEffectWorld>(
  world: W,
  store: PoisonEffectStore,
  attacker: number,
  special: ChargedAreaPoisonSpecialAttack,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  neutralOwner: number,
): number {
  const sourceOwner = world.owner[attacker]!;
  const centerX = world.posX[attacker]!;
  const centerZ = world.posZ[attacker]!;
  const radiusSq = special.radius * special.radius;
  let added = 0;

  for (let target = 0; target < world.count; target += 1) {
    if (target === attacker || world.dying[target] === 1 || world.hp[target] === 0) continue;
    const targetStats = unitTypes[world.unitType[target]!]!;
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
    if (!special.validTargets.some((targetRule) => matchesDamageTarget(targetRule, targetStats))) {
      continue;
    }
    const dx = world.posX[target]! - centerX;
    const dz = world.posZ[target]! - centerZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= radiusSq) continue;
    added += 1;
  }

  if (store.count + added > store.targetIds.length) {
    throw new RangeError("World poison-effect capacity exceeded.");
  }

  const sourceId = stableIdAt(world, attacker);
  const sourceType = world.unitType[attacker]!;
  for (let target = 0; target < world.count; target += 1) {
    if (target === attacker || world.dying[target] === 1 || world.hp[target] === 0) continue;
    const targetStats = unitTypes[world.unitType[target]!]!;
    const targetOwner = world.owner[target]!;
    const relation =
      targetOwner === neutralOwner
        ? (targetStats.classes & UNIT_CLASS_BUILDING) === 0
          ? AREA_DAMAGE_NEUTRAL_UNITS
          : 0
        : targetOwner !== sourceOwner
          ? AREA_DAMAGE_ENEMIES
          : 0;
    if (
      (special.damageRelations & relation) === 0 ||
      !special.validTargets.some((targetRule) => matchesDamageTarget(targetRule, targetStats))
    ) {
      continue;
    }
    const dx = world.posX[target]! - centerX;
    const dz = world.posZ[target]! - centerZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance >= special.radius) continue;

    const index = store.count;
    store.targetIds[index] = stableIdAt(world, target);
    store.sourceIds[index] = sourceId;
    store.sourceTypes[index] = sourceType;
    store.remainingTicks[index] = special.poisonDurationTicks;
    store.startTicks[index] = world.tick;
    store.damageMultipliers[index] = 1 - distance / special.radius;
    store.count += 1;
  }
  return added;
}

export function tickPoisonEffects<W extends PoisonEffectWorld>(
  world: W,
  store: PoisonEffectStore,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  dealDamage: ApplyPoisonDamage<W>,
): void {
  for (let index = 0; index < store.count; ) {
    const target = resolveLiveId(world, store.targetIds[index]!);
    if (target < 0 || store.remainingTicks[index] === 0) {
      removePoisonEffect(store, index);
      continue;
    }
    const sourceType = unitTypes[store.sourceTypes[index]!]!;
    const special = sourceType.specialAttack;
    if (special?.kind !== "charged-area-poison") {
      throw new Error(`${sourceType.key} no longer owns the stored poison effect.`);
    }
    const source = resolveLiveId(world, store.sourceIds[index]!);
    const damage =
      resolveDamage(special, unitTypes[world.unitType[target]!]!) *
      store.damageMultipliers[index]! *
      TICK_S;
    dealDamage(world, target, damage, source);
    store.remainingTicks[index] = store.remainingTicks[index]! - 1;
    if (world.dying[target] === 1 || store.remainingTicks[index] === 0) {
      removePoisonEffect(store, index);
      continue;
    }
    index += 1;
  }
}
