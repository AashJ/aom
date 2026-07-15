import { TICK_HZ } from "../clock";
import type { ProjectileAttack, UnitTypeStats } from "../content/unit-type-schema";
import { idGeneration, idIndex } from "./id";
import { resolveAttackDamage } from "./combat";

export const MAX_PROJECTILES = 40_000;
export const NO_PROJECTILE_TICK = 0xffff_ffff;

// Shared, append-only projectile presentation identities. These are gameplay
// data because flight/collision values live on the attack, but the engine alone
// decides which model represents each identity.
export const PROJECTILE_ARROW = 0;
export const PROJECTILE_SPEAR = 1;
export const PROJECTILE_SLING_STONE = 2;
export const PROJECTILE_TYPE_COUNT = 3;

export interface ProjectileStore {
  count: number;
  nextId: number;
  ids: Uint32Array;
  owners: Uint8Array;
  sourceTypes: Uint16Array;
  sourceIds: Uint32Array;
  targetIds: Uint32Array;
  launchTicks: Uint32Array;
  impactTicks: Uint32Array;
  launchX: Float64Array;
  launchZ: Float64Array;
  impactX: Float64Array;
  impactZ: Float64Array;
  expiresBeforeImpact: Uint8Array;
}

export interface ProjectileWorldState {
  tick: number;
  count: number;
  nextHandle: number;
  generation: Uint16Array;
  slotOf: Int32Array;
  posX: Float64Array;
  posZ: Float64Array;
  hp: Float64Array;
  dying: Uint8Array;
  unitType: Uint16Array;
}

export interface QueueProjectile {
  sourceId: number;
  sourceType: number;
  owner: number;
  targetId: number;
  attackTick: number;
  attack: ProjectileAttack;
}

export type ApplyProjectileDamage<TWorld extends ProjectileWorldState> = (
  world: TWorld,
  targetIndex: number,
  damage: number,
) => void;

export function createProjectileStore(capacity = MAX_PROJECTILES): ProjectileStore {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError("Projectile capacity must be a positive integer.");
  }

  return {
    count: 0,
    // Zero remains a useful uninitialized/debug value in snapshots.
    nextId: 1,
    ids: new Uint32Array(capacity),
    owners: new Uint8Array(capacity),
    sourceTypes: new Uint16Array(capacity),
    sourceIds: new Uint32Array(capacity),
    targetIds: new Uint32Array(capacity),
    launchTicks: new Uint32Array(capacity),
    impactTicks: new Uint32Array(capacity).fill(NO_PROJECTILE_TICK),
    launchX: new Float64Array(capacity),
    launchZ: new Float64Array(capacity),
    impactX: new Float64Array(capacity),
    impactZ: new Float64Array(capacity),
    expiresBeforeImpact: new Uint8Array(capacity),
  };
}

export function queueProjectile(store: ProjectileStore, request: QueueProjectile): number {
  if (store.count >= store.ids.length) {
    throw new RangeError("World projectile capacity exceeded.");
  }
  if (store.nextId === NO_PROJECTILE_TICK) {
    throw new RangeError("Projectile identity space exhausted.");
  }
  if (request.attack.kind !== "projectile") {
    throw new TypeError("Only projectile attacks can queue projectile entities.");
  }

  const index = store.count;
  const id = store.nextId;
  store.nextId += 1;
  store.ids[index] = id;
  store.owners[index] = request.owner;
  store.sourceTypes[index] = request.sourceType;
  store.sourceIds[index] = request.sourceId;
  store.targetIds[index] = request.targetId;
  // Projectile processing already ran for attackTick, so even a zero-delay
  // release becomes observable on the next deterministic simulation tick.
  store.launchTicks[index] = request.attackTick + Math.max(1, request.attack.launchDelayTicks);
  store.impactTicks[index] = NO_PROJECTILE_TICK;
  store.expiresBeforeImpact[index] = 0;
  store.count += 1;
  return id;
}

function resolveUnit(world: ProjectileWorldState, id: number): number {
  const handle = idIndex(id);
  if (handle >= world.nextHandle || world.generation[handle] !== idGeneration(id)) return -1;
  const index = world.slotOf[handle]!;
  return index >= 0 && index < world.count && world.dying[index] === 0 && world.hp[index]! > 0
    ? index
    : -1;
}

function launchProjectile(
  world: ProjectileWorldState,
  store: ProjectileStore,
  index: number,
  attack: ProjectileAttack,
): boolean {
  const source = resolveUnit(world, store.sourceIds[index]!);
  const target = resolveUnit(world, store.targetIds[index]!);
  if (source < 0 || target < 0) return false;

  const launchX = world.posX[source]!;
  const launchZ = world.posZ[source]!;
  // B1 captures a fixed target point so moving targets can dodge. Classic's
  // Accuracy/AimBonus/SpreadFactor/TrackRating formula and unintended path hits
  // remain a blocked B2 fidelity contract rather than a guessed approximation.
  const impactX = world.posX[target]!;
  const impactZ = world.posZ[target]!;

  const dx = impactX - launchX;
  const dz = impactZ - launchZ;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const requestedTravelTicks = Math.max(
    1,
    Math.ceil((distance / attack.projectile.speed) * TICK_HZ),
  );
  const travelTicks = Math.min(requestedTravelTicks, attack.projectile.lifespanTicks);

  store.launchX[index] = launchX;
  store.launchZ[index] = launchZ;
  if (requestedTravelTicks > travelTicks && distance > 0) {
    const fraction = (attack.projectile.speed * (travelTicks / TICK_HZ)) / distance;
    store.impactX[index] = launchX + dx * fraction;
    store.impactZ[index] = launchZ + dz * fraction;
    store.expiresBeforeImpact[index] = 1;
  } else {
    store.impactX[index] = impactX;
    store.impactZ[index] = impactZ;
  }
  store.impactTicks[index] = world.tick + travelTicks;
  return true;
}

function removeProjectile(store: ProjectileStore, index: number): void {
  const last = store.count - 1;
  if (index !== last) {
    store.ids[index] = store.ids[last]!;
    store.owners[index] = store.owners[last]!;
    store.sourceTypes[index] = store.sourceTypes[last]!;
    store.sourceIds[index] = store.sourceIds[last]!;
    store.targetIds[index] = store.targetIds[last]!;
    store.launchTicks[index] = store.launchTicks[last]!;
    store.impactTicks[index] = store.impactTicks[last]!;
    store.launchX[index] = store.launchX[last]!;
    store.launchZ[index] = store.launchZ[last]!;
    store.impactX[index] = store.impactX[last]!;
    store.impactZ[index] = store.impactZ[last]!;
    store.expiresBeforeImpact[index] = store.expiresBeforeImpact[last]!;
  }
  store.count = last;
}

export function projectileProgressAt(store: ProjectileStore, index: number, tick: number): number {
  const impactTick = store.impactTicks[index]!;
  if (impactTick === NO_PROJECTILE_TICK) return 0;
  const launchTick = store.launchTicks[index]!;
  return Math.min(1, Math.max(0, (tick - launchTick) / Math.max(1, impactTick - launchTick)));
}

export function tickProjectileStore<TWorld extends ProjectileWorldState>(
  world: TWorld,
  store: ProjectileStore,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  applyDamage: ApplyProjectileDamage<TWorld>,
): void {
  for (let index = 0; index < store.count; ) {
    const stats = unitTypes[store.sourceTypes[index]!];
    const attack = stats?.attack;
    if (!attack || attack.kind !== "projectile") {
      removeProjectile(store, index);
      continue;
    }

    if (store.impactTicks[index] === NO_PROJECTILE_TICK) {
      if (world.tick < store.launchTicks[index]!) {
        index += 1;
        continue;
      }
      if (!launchProjectile(world, store, index, attack)) {
        removeProjectile(store, index);
        continue;
      }
      index += 1;
      continue;
    }

    if (world.tick < store.impactTicks[index]!) {
      index += 1;
      continue;
    }

    if (store.expiresBeforeImpact[index] === 0) {
      const target = resolveUnit(world, store.targetIds[index]!);
      if (target >= 0) {
        const dx = world.posX[target]! - store.impactX[index]!;
        const dz = world.posZ[target]! - store.impactZ[index]!;
        const targetStats = unitTypes[world.unitType[target]!]!;
        const collisionRadius = attack.projectile.collisionRadius + targetStats.bodyRadius;
        if (dx * dx + dz * dz <= collisionRadius * collisionRadius) {
          applyDamage(world, target, resolveAttackDamage(attack, targetStats));
        }
      }
    }

    removeProjectile(store, index);
  }
}
