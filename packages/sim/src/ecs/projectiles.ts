import { TICK_HZ } from "../clock";
import type { ProjectileAttack, UnitTypeStats } from "../content/unit-type-schema";
import { nextFloat, type Pcg32 } from "../math/prng";
import { advanceProjectileAim, type AttackSequenceState } from "./attack-state";
import { idGeneration, idIndex, stableIdAt, type StableIdState } from "./id";
import { resolveAttackDamage } from "./combat";
import {
  classicProjectileHits,
  classicProjectileHitScore,
  classicProjectileLeadSeconds,
  classicProjectileSpread,
} from "./projectile-accuracy";
import { projectileCircleEntryFraction, projectileHitComesFirst } from "./projectile-collision";
import { visitUnitSpatialGridAabb, type UnitSpatialGridState } from "./spatial-grid";

export const MAX_PROJECTILES = 40_000;
export const NO_PROJECTILE_TICK = 0xffff_ffff;

// Shared, append-only projectile presentation identities. These are gameplay
// data because flight/collision values live on the attack, but the engine alone
// decides which model represents each identity.
export const PROJECTILE_ARROW = 0;
export const PROJECTILE_SPEAR = 1;
export const PROJECTILE_SLING_STONE = 2;
export const PROJECTILE_TYPE_COUNT = 3;

const EMPTY_UNIT_TYPES: readonly (UnitTypeStats | undefined)[] = Object.freeze([]);

interface ProjectileCollisionScratch {
  unitTypes: readonly (UnitTypeStats | undefined)[];
  sourceId: number;
  owner: number;
  collisionRadius: number;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  hitIndex: number;
  hitTargetId: number;
  hitFraction: number;
}

export interface ProjectileStore {
  count: number;
  nextId: number;
  ids: Uint32Array;
  owners: Uint8Array;
  sourceTypes: Uint16Array;
  sourceIds: Uint32Array;
  targetIds: Uint32Array;
  priorShots: Uint16Array;
  launchTicks: Uint32Array;
  impactTicks: Uint32Array;
  launchX: Float64Array;
  launchZ: Float64Array;
  impactX: Float64Array;
  impactZ: Float64Array;
  expiresBeforeImpact: Uint8Array;
  // Reused query context; derived and deliberately excluded from snapshots/hash.
  collisionScratch: ProjectileCollisionScratch;
}

export interface ProjectileWorldState extends UnitSpatialGridState, StableIdState {
  tick: number;
  nextHandle: number;
  rng: Pcg32;
  slotOf: Int32Array;
  velX: Float64Array;
  velZ: Float64Array;
  owner: Uint8Array;
  hp: Float64Array;
  dying: Uint8Array;
  unitType: Uint16Array;
}

interface ProjectileAttackIssuerState extends ProjectileWorldState, AttackSequenceState {
  readonly attackCooldown: Uint16Array;
  readonly projectiles: ProjectileStore;
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
    priorShots: new Uint16Array(capacity),
    launchTicks: new Uint32Array(capacity),
    impactTicks: new Uint32Array(capacity).fill(NO_PROJECTILE_TICK),
    launchX: new Float64Array(capacity),
    launchZ: new Float64Array(capacity),
    impactX: new Float64Array(capacity),
    impactZ: new Float64Array(capacity),
    expiresBeforeImpact: new Uint8Array(capacity),
    collisionScratch: {
      unitTypes: EMPTY_UNIT_TYPES,
      sourceId: 0,
      owner: 0,
      collisionRadius: 0,
      startX: 0,
      startZ: 0,
      endX: 0,
      endZ: 0,
      hitIndex: -1,
      hitTargetId: 0,
      hitFraction: -1,
    },
  };
}

export function beginProjectileAttack(
  world: ProjectileAttackIssuerState,
  sourceIndex: number,
  targetIndex: number,
  unitTypes: readonly (UnitTypeStats | undefined)[],
): number {
  if (
    sourceIndex < 0 ||
    sourceIndex >= world.count ||
    targetIndex < 0 ||
    targetIndex >= world.count ||
    world.dying[sourceIndex] === 1 ||
    world.hp[sourceIndex]! <= 0 ||
    world.dying[targetIndex] === 1 ||
    world.hp[targetIndex]! <= 0
  ) {
    throw new RangeError("Projectile attack indices must identify live dense units.");
  }

  const store = world.projectiles;
  if (store.count >= store.ids.length) {
    throw new RangeError("World projectile capacity exceeded.");
  }
  if (store.nextId === NO_PROJECTILE_TICK) {
    throw new RangeError("Projectile identity space exhausted.");
  }
  const sourceType = world.unitType[sourceIndex]!;
  const attack = unitTypes[sourceType]?.attack;
  if (!attack || attack.kind !== "projectile") {
    throw new TypeError("Projectile source type has no canonical projectile attack.");
  }

  const sourceId = stableIdAt(world, sourceIndex);
  const targetId = stableIdAt(world, targetIndex);
  const priorShots = advanceProjectileAim(world, sourceIndex, targetId);
  const index = store.count;
  const id = store.nextId;
  store.nextId += 1;
  store.ids[index] = id;
  store.owners[index] = world.owner[sourceIndex]!;
  store.sourceTypes[index] = sourceType;
  store.sourceIds[index] = sourceId;
  store.targetIds[index] = targetId;
  store.priorShots[index] = priorShots;
  // Projectile processing already ran for attackTick, so even a zero-delay
  // release becomes observable on the next deterministic simulation tick.
  store.launchTicks[index] = world.tick + Math.max(1, attack.launchDelayTicks);
  store.impactTicks[index] = NO_PROJECTILE_TICK;
  store.expiresBeforeImpact[index] = 0;
  store.count += 1;
  world.attackCooldown[sourceIndex] = attack.cooldownTicks;
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
  const targetX = world.posX[target]!;
  const targetZ = world.posZ[target]!;
  const targetDx = targetX - launchX;
  const targetDz = targetZ - launchZ;
  const targetDistance = Math.sqrt(targetDx * targetDx + targetDz * targetDz);
  const priorShots = store.priorShots[index]!;
  const leadSeconds = classicProjectileLeadSeconds(
    launchX,
    launchZ,
    targetX,
    targetZ,
    world.velX[target]!,
    world.velZ[target]!,
    attack.projectile.speed,
    attack.trackRating,
  );
  let impactX = targetX + world.velX[target]! * leadSeconds;
  let impactZ = targetZ + world.velZ[target]! * leadSeconds;
  const hitScore = classicProjectileHitScore(attack, targetDistance, priorShots);
  // The Trial executable draws an integer in [0, 100] only for a score in
  // (0, 100]. Keeping the skipped-draw cases exact matters to lockstep RNG.
  const roll = hitScore > 0 && hitScore <= 100 ? Math.floor(nextFloat(world.rng) * 101) : 0;

  if (!classicProjectileHits(hitScore, roll)) {
    const spread = classicProjectileSpread(attack, targetDistance, priorShots);
    impactX += (nextFloat(world.rng) * 2 - 1) * spread;
    impactZ += (nextFloat(world.rng) * 2 - 1) * spread;
  }

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
    store.priorShots[index] = store.priorShots[last]!;
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

export function cancelPendingProjectilesBySource(store: ProjectileStore, sourceId: number): void {
  for (let index = 0; index < store.count; ) {
    if (store.sourceIds[index] === sourceId && store.impactTicks[index] === NO_PROJECTILE_TICK) {
      removeProjectile(store, index);
      continue;
    }
    index += 1;
  }
}

export function projectileProgressAt(store: ProjectileStore, index: number, tick: number): number {
  const impactTick = store.impactTicks[index]!;
  if (impactTick === NO_PROJECTILE_TICK) return 0;
  const launchTick = store.launchTicks[index]!;
  return Math.min(1, Math.max(0, (tick - launchTick) / Math.max(1, impactTick - launchTick)));
}

function projectileCoordinateAt(
  store: ProjectileStore,
  index: number,
  tick: number,
  launchCoordinate: Float64Array,
  impactCoordinate: Float64Array,
): number {
  const progress = projectileProgressAt(store, index, tick);
  return (
    launchCoordinate[index]! + (impactCoordinate[index]! - launchCoordinate[index]!) * progress
  );
}

function considerProjectileCollisionCandidate(
  world: ProjectileWorldState,
  scratch: ProjectileCollisionScratch,
  candidate: number,
): void {
  if (
    world.dying[candidate] === 1 ||
    world.hp[candidate]! <= 0 ||
    world.owner[candidate] === scratch.owner
  ) {
    return;
  }

  const candidateId = stableIdAt(world, candidate);
  if (candidateId === scratch.sourceId) return;

  const candidateStats = scratch.unitTypes[world.unitType[candidate]!];
  if (!candidateStats?.collidesWithProjectiles) return;

  const entryFraction = projectileCircleEntryFraction(
    scratch.startX,
    scratch.startZ,
    scratch.endX,
    scratch.endZ,
    world.posX[candidate]!,
    world.posZ[candidate]!,
    scratch.collisionRadius + candidateStats.bodyRadius,
  );
  if (
    projectileHitComesFirst(scratch.hitFraction, scratch.hitTargetId, entryFraction, candidateId)
  ) {
    scratch.hitIndex = candidate;
    scratch.hitTargetId = candidateId;
    scratch.hitFraction = entryFraction;
  }
}

function projectileHitAlongSegment(
  world: ProjectileWorldState,
  store: ProjectileStore,
  index: number,
  attack: ProjectileAttack,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  maxBodyRadius: number,
  startTick: number,
  endTick: number,
): number {
  const startX = projectileCoordinateAt(store, index, startTick, store.launchX, store.impactX);
  const startZ = projectileCoordinateAt(store, index, startTick, store.launchZ, store.impactZ);
  const endX = projectileCoordinateAt(store, index, endTick, store.launchX, store.impactX);
  const endZ = projectileCoordinateAt(store, index, endTick, store.launchZ, store.impactZ);
  const queryPadding = attack.projectile.collisionRadius + maxBodyRadius;
  const scratch = store.collisionScratch;
  scratch.unitTypes = unitTypes;
  scratch.sourceId = store.sourceIds[index]!;
  scratch.owner = store.owners[index]!;
  scratch.collisionRadius = attack.projectile.collisionRadius;
  scratch.startX = startX;
  scratch.startZ = startZ;
  scratch.endX = endX;
  scratch.endZ = endZ;
  scratch.hitIndex = -1;
  scratch.hitTargetId = 0;
  scratch.hitFraction = -1;

  visitUnitSpatialGridAabb(
    world,
    Math.min(startX, endX) - queryPadding,
    Math.min(startZ, endZ) - queryPadding,
    Math.max(startX, endX) + queryPadding,
    Math.max(startZ, endZ) + queryPadding,
    scratch,
    considerProjectileCollisionCandidate,
  );

  return scratch.hitIndex;
}

export function tickProjectileStore<TWorld extends ProjectileWorldState>(
  world: TWorld,
  store: ProjectileStore,
  unitTypes: readonly (UnitTypeStats | undefined)[],
  maxBodyRadius: number,
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

    const impactTick = store.impactTicks[index]!;
    const pathEndTick = world.tick < impactTick ? world.tick : impactTick;
    // The production scheduler invokes this system exactly once per world tick,
    // so collision progress is derived instead of duplicated in authoritative state.
    const pathStartTick = Math.max(store.launchTicks[index]!, pathEndTick - 1);
    if (pathEndTick > pathStartTick) {
      const hitIndex = projectileHitAlongSegment(
        world,
        store,
        index,
        attack,
        unitTypes,
        maxBodyRadius,
        pathStartTick,
        pathEndTick,
      );
      if (hitIndex >= 0) {
        const targetStats = unitTypes[world.unitType[hitIndex]!]!;
        const hitId = stableIdAt(world, hitIndex);
        const damageMultiplier =
          hitId === store.targetIds[index]! ? 1 : attack.unintentionalDamageMultiplier;
        applyDamage(world, hitIndex, resolveAttackDamage(attack, targetStats) * damageMultiplier);
        removeProjectile(store, index);
        continue;
      }
    }

    if (world.tick < impactTick) {
      index += 1;
      continue;
    }

    removeProjectile(store, index);
  }
}
