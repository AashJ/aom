import { TICK_S } from "../clock";
import type { TargetReaction, ThrownTargetReaction } from "../content/unit-type-schema";
import { nextFloat, nextU32, type Pcg32 } from "../math/prng";
import { heightAt, MAP_TILES } from "../terrain";
import { resetAttackSequence, type AttackSequenceState } from "./attack-state";
import { stableIdAt, type StableIdState } from "./id";
import { cancelPendingProjectilesBySource, type ProjectileStore } from "./projectiles";
import { clearSpecialAttack, type SpecialAttackState } from "./special-attacks";

export const TARGET_REACTION_NONE = 0;
export const TARGET_REACTION_THROWN = 1;
export type TargetReactionKind = typeof TARGET_REACTION_NONE | typeof TARGET_REACTION_THROWN;

export interface TargetReactionCapabilities {
  readonly blocksOrderExecution: boolean;
  readonly drivesPosition: boolean;
  readonly participatesInGroundSeparation: boolean;
}

const NO_REACTION_CAPABILITIES: TargetReactionCapabilities = {
  blocksOrderExecution: false,
  drivesPosition: false,
  participatesInGroundSeparation: true,
};

const THROWN_REACTION_CAPABILITIES: TargetReactionCapabilities = {
  blocksOrderExecution: true,
  drivesPosition: true,
  participatesInGroundSeparation: false,
};

export interface TargetReactionStore {
  readonly kind: Uint8Array;
  readonly directionX: Float64Array;
  readonly directionZ: Float64Array;
  readonly distance: Float64Array;
  readonly maxVelocity: Float64Array;
  readonly maxHeight: Float64Array;
  readonly numberBounces: Uint8Array;
  readonly numberBouncesDone: Int8Array;
  readonly arcStartX: Float64Array;
  readonly arcStartZ: Float64Array;
  readonly arcStartY: Float64Array;
  readonly arcEndX: Float64Array;
  readonly arcEndZ: Float64Array;
  readonly arcEndY: Float64Array;
  readonly arcElapsed: Float64Array;
  readonly arcDuration: Float64Array;
  readonly arcVerticalVelocity: Float64Array;
  readonly arcGravity: Float64Array;
  readonly elevation: Float64Array;
}

export interface TargetReactionWorld {
  readonly heights: Float32Array;
  readonly walkable: Uint8Array;
  readonly posX: Float64Array;
  readonly posZ: Float64Array;
  readonly targetReactions: TargetReactionStore;
  readonly rng: Pcg32;
  count: number;
}

interface TargetReactionInstallationWorld
  extends TargetReactionWorld, AttackSequenceState, SpecialAttackState, StableIdState {
  readonly projectiles: ProjectileStore;
}

export function createTargetReactionStore(capacity: number): TargetReactionStore {
  return {
    kind: new Uint8Array(capacity),
    directionX: new Float64Array(capacity),
    directionZ: new Float64Array(capacity),
    distance: new Float64Array(capacity),
    maxVelocity: new Float64Array(capacity),
    maxHeight: new Float64Array(capacity),
    numberBounces: new Uint8Array(capacity),
    numberBouncesDone: new Int8Array(capacity),
    arcStartX: new Float64Array(capacity),
    arcStartZ: new Float64Array(capacity),
    arcStartY: new Float64Array(capacity),
    arcEndX: new Float64Array(capacity),
    arcEndZ: new Float64Array(capacity),
    arcEndY: new Float64Array(capacity),
    arcElapsed: new Float64Array(capacity),
    arcDuration: new Float64Array(capacity),
    arcVerticalVelocity: new Float64Array(capacity),
    arcGravity: new Float64Array(capacity),
    elevation: new Float64Array(capacity),
  };
}

function targetReactionKindAt(store: TargetReactionStore, index: number): TargetReactionKind {
  const kind = store.kind[index]!;
  switch (kind) {
    case TARGET_REACTION_NONE:
    case TARGET_REACTION_THROWN:
      return kind;
    default:
      throw new RangeError(`Unsupported authoritative target-reaction kind ${kind}.`);
  }
}

function assertNeverReactionKind(kind: never): never {
  throw new RangeError(`Unsupported authoritative target-reaction kind ${String(kind)}.`);
}

export function targetReactionCapabilitiesAt(
  store: TargetReactionStore,
  index: number,
): TargetReactionCapabilities {
  const kind = targetReactionKindAt(store, index);
  switch (kind) {
    case TARGET_REACTION_NONE:
      return NO_REACTION_CAPABILITIES;
    case TARGET_REACTION_THROWN:
      return THROWN_REACTION_CAPABILITIES;
    default:
      return assertNeverReactionKind(kind);
  }
}

export function isTargetReactionActive(store: TargetReactionStore, index: number): boolean {
  return targetReactionKindAt(store, index) !== TARGET_REACTION_NONE;
}

export function clearTargetReaction(store: TargetReactionStore, index: number): void {
  store.kind[index] = TARGET_REACTION_NONE;
  store.directionX[index] = 0;
  store.directionZ[index] = 0;
  store.distance[index] = 0;
  store.maxVelocity[index] = 0;
  store.maxHeight[index] = 0;
  store.numberBounces[index] = 0;
  store.numberBouncesDone[index] = 0;
  store.arcStartX[index] = 0;
  store.arcStartZ[index] = 0;
  store.arcStartY[index] = 0;
  store.arcEndX[index] = 0;
  store.arcEndZ[index] = 0;
  store.arcEndY[index] = 0;
  store.arcElapsed[index] = 0;
  store.arcDuration[index] = 0;
  store.arcVerticalVelocity[index] = 0;
  store.arcGravity[index] = 0;
  store.elevation[index] = 0;
}

export function copyTargetReaction(
  store: TargetReactionStore,
  destination: number,
  source: number,
): void {
  store.kind[destination] = store.kind[source]!;
  store.directionX[destination] = store.directionX[source]!;
  store.directionZ[destination] = store.directionZ[source]!;
  store.distance[destination] = store.distance[source]!;
  store.maxVelocity[destination] = store.maxVelocity[source]!;
  store.maxHeight[destination] = store.maxHeight[source]!;
  store.numberBounces[destination] = store.numberBounces[source]!;
  store.numberBouncesDone[destination] = store.numberBouncesDone[source]!;
  store.arcStartX[destination] = store.arcStartX[source]!;
  store.arcStartZ[destination] = store.arcStartZ[source]!;
  store.arcStartY[destination] = store.arcStartY[source]!;
  store.arcEndX[destination] = store.arcEndX[source]!;
  store.arcEndZ[destination] = store.arcEndZ[source]!;
  store.arcEndY[destination] = store.arcEndY[source]!;
  store.arcElapsed[destination] = store.arcElapsed[source]!;
  store.arcDuration[destination] = store.arcDuration[source]!;
  store.arcVerticalVelocity[destination] = store.arcVerticalVelocity[source]!;
  store.arcGravity[destination] = store.arcGravity[source]!;
  store.elevation[destination] = store.elevation[source]!;
}

function isValidLanding(world: TargetReactionWorld, x: number, z: number): boolean {
  if (x < 0 || x >= MAP_TILES || z < 0 || z >= MAP_TILES) return false;
  const tileX = Math.floor(x);
  const tileZ = Math.floor(z);
  return world.walkable[tileZ * MAP_TILES + tileX] === 1;
}

function startThrownArc(
  world: TargetReactionWorld,
  index: number,
  distanceDivisor: number,
): boolean {
  const store = world.targetReactions;
  const startX = world.posX[index]!;
  const startZ = world.posZ[index]!;
  const arcDistance = store.distance[index]! / distanceDivisor;
  const endX = startX + store.directionX[index]! * arcDistance;
  const endZ = startZ + store.directionZ[index]! * arcDistance;

  // BUnitThrownAction terminates when the path manager rejects the next
  // landing. Flight may cross blocked terrain; only the landing is queried.
  if (!isValidLanding(world, endX, endZ)) return false;

  const startY = heightAt(world.heights, startX, startZ);
  const endY = heightAt(world.heights, endX, endZ);
  const dx = endX - startX;
  const dz = endZ - startZ;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  if (horizontalDistance <= 1e-6) return false;

  const heightDelta = endY - startY;
  const requestedHeight = store.maxHeight[index]! / distanceDivisor + Math.max(0, heightDelta);
  // Classic computes atan(height / halfDistance), then sin/cos. The equivalent
  // ratio algebra uses only determinism-approved sqrt/arithmetic.
  const tangent = requestedHeight / (horizontalDistance * 0.5);
  const cosine = 1 / Math.sqrt(1 + tangent * tangent);
  const sine = tangent * cosine;
  const horizontalVelocity = store.maxVelocity[index]! * cosine;
  const duration = horizontalDistance / horizontalVelocity;
  const verticalVelocity = store.maxVelocity[index]! * sine;
  const gravity = (2 * (verticalVelocity * duration - heightDelta)) / (duration * duration);

  store.arcStartX[index] = startX;
  store.arcStartZ[index] = startZ;
  store.arcStartY[index] = startY;
  store.arcEndX[index] = endX;
  store.arcEndZ[index] = endZ;
  store.arcEndY[index] = endY;
  store.arcElapsed[index] = 0;
  store.arcDuration[index] = duration;
  store.arcVerticalVelocity[index] = verticalVelocity;
  store.arcGravity[index] = gravity;
  store.elevation[index] = 0;
  return true;
}

function beginThrownTargetReaction(
  world: TargetReactionWorld,
  index: number,
  sourceX: number,
  sourceZ: number,
  reaction: ThrownTargetReaction,
): boolean {
  const store = world.targetReactions;
  // Preserve the executable's synchronized draw order even if the eventual
  // landing is invalid: distance, velocity, height, then integer bounces.
  const distance = reaction.distanceBase + nextFloat(world.rng) * reaction.distanceRandomRange;
  const maxVelocity =
    reaction.maxVelocityBase + nextFloat(world.rng) * reaction.maxVelocityRandomRange;
  const maxHeight = reaction.maxHeightBase + nextFloat(world.rng) * reaction.maxHeightRandomRange;
  const numberBounces = reaction.bounceBase + (nextU32(world.rng) % reaction.bounceRandomRange);
  const dx = world.posX[index]! - sourceX;
  const dz = world.posZ[index]! - sourceZ;
  const directionLength = Math.sqrt(dx * dx + dz * dz);

  clearTargetReaction(store, index);
  store.kind[index] = TARGET_REACTION_THROWN;
  store.directionX[index] = directionLength > 1e-6 ? dx / directionLength : 1;
  store.directionZ[index] = directionLength > 1e-6 ? dz / directionLength : 0;
  store.distance[index] = distance;
  store.maxVelocity[index] = maxVelocity;
  store.maxHeight[index] = maxHeight;
  store.numberBounces[index] = numberBounces;
  store.numberBouncesDone[index] = -1;

  const firstEndX = world.posX[index]! + store.directionX[index]! * distance;
  const firstEndZ = world.posZ[index]! + store.directionZ[index]! * distance;
  if (!isValidLanding(world, firstEndX, firstEndZ)) {
    // The initial BUnitThrownAction setup does not abort on a rejected landing.
    // It replaces the throw with a 0.1-unit horizontal fallback directed away
    // from the x=0 map edge. Later rejected bounce landings do terminate.
    store.directionX[index] = world.posX[index]! > 0.1 ? -1 : 1;
    store.directionZ[index] = 0;
    store.distance[index] = 0.1;
  }

  if (startThrownArc(world, index, 1)) return true;
  clearTargetReaction(store, index);
  return false;
}

function unsupportedTargetReaction(reaction: TargetReaction): never {
  throw new TypeError(`Unsupported target reaction ${JSON.stringify(reaction)}.`);
}

/** Installs one forced target action and atomically interrupts active execution beneath it. */
export function installTargetReaction(
  world: TargetReactionInstallationWorld,
  index: number,
  sourceX: number,
  sourceZ: number,
  reaction: TargetReaction,
): boolean {
  let installed: boolean;
  switch (reaction.kind) {
    case "thrown":
      installed = beginThrownTargetReaction(world, index, sourceX, sourceZ, reaction);
      break;
    default:
      return unsupportedTargetReaction(reaction);
  }

  if (!installed) return false;

  clearSpecialAttack(world, index);
  cancelPendingProjectilesBySource(world.projectiles, stableIdAt(world, index));
  resetAttackSequence(world, index);
  return true;
}

function tickThrownTargetReaction(world: TargetReactionWorld, index: number): void {
  const store = world.targetReactions;
  const duration = store.arcDuration[index]!;
  const elapsed = Math.min(duration, store.arcElapsed[index]! + TICK_S);
  const progress = elapsed / duration;
  const startX = store.arcStartX[index]!;
  const startZ = store.arcStartZ[index]!;
  const x = startX + (store.arcEndX[index]! - startX) * progress;
  const z = startZ + (store.arcEndZ[index]! - startZ) * progress;
  const absoluteY =
    store.arcStartY[index]! +
    store.arcVerticalVelocity[index]! * elapsed -
    0.5 * store.arcGravity[index]! * elapsed * elapsed;

  store.arcElapsed[index] = elapsed;
  world.posX[index] = x;
  world.posZ[index] = z;
  store.elevation[index] = Math.max(0, absoluteY - heightAt(world.heights, x, z));

  if (elapsed < duration) return;

  world.posX[index] = store.arcEndX[index]!;
  world.posZ[index] = store.arcEndZ[index]!;
  store.elevation[index] = 0;

  if (store.numberBouncesDone[index]! >= store.numberBounces[index]!) {
    clearTargetReaction(store, index);
    return;
  }

  store.numberBouncesDone[index] = store.numberBouncesDone[index]! + 1;
  const distanceDivisor = store.numberBouncesDone[index]! + 1;
  if (!startThrownArc(world, index, distanceDivisor)) clearTargetReaction(store, index);
}

export function tickTargetReactions(world: TargetReactionWorld): boolean {
  let hasActiveTargetReactions = false;

  for (let index = 0; index < world.count; index += 1) {
    const kind = targetReactionKindAt(world.targetReactions, index);
    switch (kind) {
      case TARGET_REACTION_NONE:
        break;
      case TARGET_REACTION_THROWN:
        tickThrownTargetReaction(world, index);
        if (world.targetReactions.kind[index] !== TARGET_REACTION_NONE) {
          hasActiveTargetReactions = true;
        }
        break;
      default:
        assertNeverReactionKind(kind);
    }
  }

  return hasActiveTargetReactions;
}
