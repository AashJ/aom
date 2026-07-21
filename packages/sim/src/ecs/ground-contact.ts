import { UNIT_TYPES } from "../content/generated/unit-types";
import { MAP_TILES } from "../terrain";
import { circleSweepEntryFraction } from "./circle-collision";
import { resolveStableId, stableIdAt, type StableIdLookupState } from "./id";
import { NO_MELEE_ATTACK_VARIANT } from "./melee-attack-cycles";
import { isWalkableStep, type WalkableGroundState } from "./navigation";
import { targetReactionCapabilitiesAt, type TargetReactionStore } from "./target-reactions";
import { NO_TARGET } from "./unit-tasks";

const CONTACT_EPSILON = 1e-6;
const MAX_CONTACT_ITERATIONS = 64;
// Contact correction is applied in sub-tile increments so terrain checks cannot
// skip an intervening cell when repairing an unusually deep overlap.
const MAX_CONTACT_CORRECTION_STEP = 0.5;

export interface GroundMotionWorld extends StableIdLookupState, WalkableGroundState {
  count: number;
  readonly posX: Float64Array;
  readonly posZ: Float64Array;
  readonly pushX: Float64Array;
  readonly pushZ: Float64Array;
  readonly unitType: Uint16Array;
  readonly containedBy: Uint32Array;
  readonly dying: Uint8Array;
  readonly attackTarget: Uint32Array;
  readonly meleeActionVariant: Uint8Array;
  readonly specialActionRemaining: Uint16Array;
  readonly targetReactions: TargetReactionStore;
}

interface GroundMotionScratch {
  readonly candidateX: Float64Array;
  readonly candidateZ: Float64Array;
  readonly correctionX: Float64Array;
  readonly correctionZ: Float64Array;
  readonly correctionCount: Uint16Array;
  readonly correctedUnits: Int32Array;
  correctedUnitCount: number;
  readonly contactA: Int32Array;
  readonly contactB: Int32Array;
  readonly contactActive: Uint8Array;
  readonly componentParent: Int32Array;
  readonly componentActive: Uint8Array;
}

const scratchByWorld = new WeakMap<object, GroundMotionScratch>();

function scratchCapacity(count: number): number {
  let capacity = 16;
  while (capacity < count) capacity *= 2;
  return capacity;
}

function scratchFor(world: object, count: number): GroundMotionScratch {
  const existing = scratchByWorld.get(world);
  if (existing !== undefined && existing.candidateX.length >= count) return existing;

  const capacity = scratchCapacity(count);
  const scratch: GroundMotionScratch = {
    candidateX: new Float64Array(capacity),
    candidateZ: new Float64Array(capacity),
    correctionX: new Float64Array(capacity),
    correctionZ: new Float64Array(capacity),
    correctionCount: new Uint16Array(capacity),
    correctedUnits: new Int32Array(capacity),
    correctedUnitCount: 0,
    contactA: new Int32Array(capacity),
    contactB: new Int32Array(capacity),
    contactActive: new Uint8Array(capacity),
    componentParent: new Int32Array(capacity),
    componentActive: new Uint8Array(capacity),
  };
  scratchByWorld.set(world, scratch);
  return scratch;
}

function clampPosition(position: number): number {
  return position < 0 ? 0 : position > MAP_TILES ? MAP_TILES : position;
}

function initializeTerrainCandidates(
  world: GroundMotionWorld,
  scratch: GroundMotionScratch | null,
): void {
  const candidateX = scratch === null ? world.posX : scratch.candidateX;
  const candidateZ = scratch === null ? world.posZ : scratch.candidateZ;
  for (let i = 0; i < world.count; i += 1) {
    const oldX = world.posX[i]!;
    const oldZ = world.posZ[i]!;
    if (UNIT_TYPES[world.unitType[i]!]!.isStatic) {
      candidateX[i] = oldX;
      candidateZ[i] = oldZ;
      continue;
    }

    const requestedX = clampPosition(oldX + world.pushX[i]!);
    const requestedZ = clampPosition(oldZ + world.pushZ[i]!);
    if (isWalkableStep(world, oldX, oldZ, requestedX, requestedZ)) {
      candidateX[i] = requestedX;
      candidateZ[i] = requestedZ;
      continue;
    }

    // Preserve the world's deterministic x-then-z terrain-slide preference.
    if (requestedX !== oldX && isWalkableStep(world, oldX, oldZ, requestedX, oldZ)) {
      candidateX[i] = requestedX;
      candidateZ[i] = oldZ;
      continue;
    }
    if (requestedZ !== oldZ && isWalkableStep(world, oldX, oldZ, oldX, requestedZ)) {
      candidateX[i] = oldX;
      candidateZ[i] = requestedZ;
      continue;
    }

    candidateX[i] = oldX;
    candidateZ[i] = oldZ;
  }
}

function participatesInContact(
  world: GroundMotionWorld,
  index: number,
  hasActiveTargetReactions: boolean,
): boolean {
  return (
    world.containedBy[index] === NO_TARGET &&
    world.dying[index] === 0 &&
    !UNIT_TYPES[world.unitType[index]!]!.isStatic &&
    (!hasActiveTargetReactions ||
      targetReactionCapabilitiesAt(world.targetReactions, index).participatesInGroundSeparation)
  );
}

function positionIsLocked(
  world: GroundMotionWorld,
  index: number,
  hasActiveTargetReactions: boolean,
): boolean {
  return (
    world.meleeActionVariant[index] !== NO_MELEE_ATTACK_VARIANT ||
    world.specialActionRemaining[index]! > 0 ||
    (hasActiveTargetReactions &&
      targetReactionCapabilitiesAt(world.targetReactions, index).drivesPosition)
  );
}

function componentRoot(parent: Int32Array, index: number): number {
  let root = index;
  while (parent[root] !== root) root = parent[root]!;
  while (parent[index] !== index) {
    const next = parent[index]!;
    parent[index] = root;
    index = next;
  }
  return root;
}

function joinComponents(parent: Int32Array, a: number, b: number): void {
  const aRoot = componentRoot(parent, a);
  const bRoot = componentRoot(parent, b);
  if (aRoot === bRoot) return;
  if (aRoot < bRoot) parent[bRoot] = aRoot;
  else parent[aRoot] = bRoot;
}

function enumerateCombatContacts(
  world: GroundMotionWorld,
  hasActiveTargetReactions: boolean,
  scratch: GroundMotionScratch,
): number {
  let contactCount = 0;
  let activeSeedCount = 0;
  for (let i = 0; i < world.count; i += 1) {
    if (world.attackTarget[i] === NO_TARGET) continue;
    if (!participatesInContact(world, i, hasActiveTargetReactions)) continue;

    const j = resolveStableId(world, world.attackTarget[i]!);
    if (j < 0 || j === i || !participatesInContact(world, j, hasActiveTargetReactions)) {
      continue;
    }

    // Mutual attacks describe one physical contact. Stable IDs make the
    // representative independent of dense-slot compaction.
    if (
      resolveStableId(world, world.attackTarget[j]!) === i &&
      stableIdAt(world, j) < stableIdAt(world, i)
    ) {
      continue;
    }

    // Terrain sliding cannot increase either proposed step's length. This
    // marks the edge that activates its whole connected contact component;
    // inactive incident edges remain constraints because another correction
    // can move their shared unit.
    const dx = world.posX[i]! - world.posX[j]!;
    const dz = world.posZ[i]! - world.posZ[j]!;
    const minimumDistance =
      UNIT_TYPES[world.unitType[i]!]!.bodyRadius + UNIT_TYPES[world.unitType[j]!]!.bodyRadius;
    const startDistanceSq = dx * dx + dz * dz;
    let active = true;
    if (startDistanceSq >= minimumDistance * minimumDistance - CONTACT_EPSILON) {
      // Manhattan length is a cheap conservative bound on Euclidean travel.
      const maximumTravel =
        Math.abs(world.pushX[i]!) +
        Math.abs(world.pushZ[i]!) +
        Math.abs(world.pushX[j]!) +
        Math.abs(world.pushZ[j]!);
      const reachableDistance = minimumDistance + maximumTravel;
      active = startDistanceSq < reachableDistance * reachableDistance;
    }

    scratch.contactA[contactCount] = i;
    scratch.contactB[contactCount] = j;
    scratch.contactActive[contactCount] = active ? 1 : 0;
    if (active) activeSeedCount += 1;
    contactCount += 1;
  }

  if (activeSeedCount === 0) return 0;
  for (let i = 0; i < world.count; i += 1) scratch.componentParent[i] = i;
  for (let contact = 0; contact < contactCount; contact += 1) {
    joinComponents(scratch.componentParent, scratch.contactA[contact]!, scratch.contactB[contact]!);
  }

  scratch.componentActive.fill(0, 0, world.count);
  for (let contact = 0; contact < contactCount; contact += 1) {
    if (scratch.contactActive[contact] === 0) continue;
    const root = componentRoot(scratch.componentParent, scratch.contactA[contact]!);
    scratch.componentActive[root] = 1;
  }

  let activeContactCount = 0;
  for (let contact = 0; contact < contactCount; contact += 1) {
    const a = scratch.contactA[contact]!;
    const root = componentRoot(scratch.componentParent, a);
    if (scratch.componentActive[root] === 0) continue;
    scratch.contactA[activeContactCount] = a;
    scratch.contactB[activeContactCount] = scratch.contactB[contact]!;
    activeContactCount += 1;
  }
  return activeContactCount;
}

function stableFallbackNormal(
  world: GroundMotionWorld,
  a: number,
  b: number,
): readonly [number, number] {
  const aId = stableIdAt(world, a);
  const bId = stableIdAt(world, b);
  const sign = aId > bId ? 1 : -1;
  const diagonal = (aId + bId) % 2 === 0 ? sign : -sign;
  const inverseLength = 1 / Math.sqrt(2);
  return [sign * inverseLength, diagonal * inverseLength];
}

function accumulateContactCorrections(
  world: GroundMotionWorld,
  hasActiveTargetReactions: boolean,
  scratch: GroundMotionScratch,
  contactCount: number,
): number {
  for (let offset = 0; offset < scratch.correctedUnitCount; offset += 1) {
    const index = scratch.correctedUnits[offset]!;
    scratch.correctionX[index] = 0;
    scratch.correctionZ[index] = 0;
    scratch.correctionCount[index] = 0;
  }
  scratch.correctedUnitCount = 0;
  let maximumViolation = 0;

  for (let contact = 0; contact < contactCount; contact += 1) {
    const a = scratch.contactA[contact]!;
    const b = scratch.contactB[contact]!;
    const startDx = world.posX[a]! - world.posX[b]!;
    const startDz = world.posZ[a]! - world.posZ[b]!;
    const endDx = scratch.candidateX[a]! - scratch.candidateX[b]!;
    const endDz = scratch.candidateZ[a]! - scratch.candidateZ[b]!;
    const minimumDistance =
      UNIT_TYPES[world.unitType[a]!]!.bodyRadius + UNIT_TYPES[world.unitType[b]!]!.bodyRadius;
    const minimumDistanceSq = minimumDistance * minimumDistance;
    const startDistanceSq = startDx * startDx + startDz * startDz;
    const endDistanceSq = endDx * endDx + endDz * endDz;
    let relativeCorrectionX = 0;
    let relativeCorrectionZ = 0;

    if (startDistanceSq < minimumDistanceSq - CONTACT_EPSILON) {
      // Repair authoritative penetration even when an action has already
      // locked both poses. Motion that fully exits the overlap needs no help.
      if (endDistanceSq >= minimumDistanceSq - CONTACT_EPSILON) continue;

      let normalX = endDx;
      let normalZ = endDz;
      let endDistance = Math.sqrt(endDistanceSq);
      if (endDistance < CONTACT_EPSILON) {
        normalX = startDx;
        normalZ = startDz;
        endDistance = Math.sqrt(startDistanceSq);
      }
      if (endDistance < CONTACT_EPSILON) {
        [normalX, normalZ] = stableFallbackNormal(world, a, b);
        endDistance = 1;
      }

      const penetration = minimumDistance - Math.sqrt(endDistanceSq);
      relativeCorrectionX = (normalX / endDistance) * penetration;
      relativeCorrectionZ = (normalZ / endDistance) * penetration;
    } else {
      const relativeDeltaX = endDx - startDx;
      const relativeDeltaZ = endDz - startDz;
      if (
        relativeDeltaX * relativeDeltaX + relativeDeltaZ * relativeDeltaZ <=
        CONTACT_EPSILON * CONTACT_EPSILON
      ) {
        continue;
      }
      const startsAtContact = startDistanceSq <= minimumDistanceSq + CONTACT_EPSILON;

      if (startsAtContact) {
        // Contact may open freely; only inward motion must be clamped.
        if (startDx * relativeDeltaX + startDz * relativeDeltaZ >= 0) continue;
        relativeCorrectionX = startDx - endDx;
        relativeCorrectionZ = startDz - endDz;
      } else {
        const entryFraction = circleSweepEntryFraction(
          startDx,
          startDz,
          endDx,
          endDz,
          0,
          0,
          minimumDistance,
        );
        if (entryFraction < 0 || entryFraction >= 1) continue;

        relativeCorrectionX = startDx + relativeDeltaX * entryFraction - endDx;
        relativeCorrectionZ = startDz + relativeDeltaZ * entryFraction - endDz;
      }
    }

    const violation = Math.hypot(relativeCorrectionX, relativeCorrectionZ);
    if (violation <= CONTACT_EPSILON) continue;
    maximumViolation = Math.max(maximumViolation, violation);

    const aLocked = positionIsLocked(world, a, hasActiveTargetReactions);
    const bLocked = positionIsLocked(world, b, hasActiveTargetReactions);
    const aShare = aLocked && !bLocked ? 0 : !aLocked && bLocked ? 1 : 0.5;
    const bShare = bLocked && !aLocked ? 0 : !bLocked && aLocked ? 1 : 0.5;

    if (aShare > 0) {
      if (scratch.correctionCount[a] === 0) {
        scratch.correctedUnits[scratch.correctedUnitCount] = a;
        scratch.correctedUnitCount += 1;
      }
      scratch.correctionX[a] = scratch.correctionX[a]! + relativeCorrectionX * aShare;
      scratch.correctionZ[a] = scratch.correctionZ[a]! + relativeCorrectionZ * aShare;
      scratch.correctionCount[a] = scratch.correctionCount[a]! + 1;
    }
    if (bShare > 0) {
      if (scratch.correctionCount[b] === 0) {
        scratch.correctedUnits[scratch.correctedUnitCount] = b;
        scratch.correctedUnitCount += 1;
      }
      scratch.correctionX[b] = scratch.correctionX[b]! - relativeCorrectionX * bShare;
      scratch.correctionZ[b] = scratch.correctionZ[b]! - relativeCorrectionZ * bShare;
      scratch.correctionCount[b] = scratch.correctionCount[b]! + 1;
    }
  }

  return maximumViolation;
}

function applyContactCorrections(world: GroundMotionWorld, scratch: GroundMotionScratch): boolean {
  let changed = false;
  for (let offset = 0; offset < scratch.correctedUnitCount; offset += 1) {
    const i = scratch.correctedUnits[offset]!;
    const correctionCount = scratch.correctionCount[i]!;

    let correctionX = scratch.correctionX[i]! / correctionCount;
    let correctionZ = scratch.correctionZ[i]! / correctionCount;
    const correctionLength = Math.hypot(correctionX, correctionZ);
    if (correctionLength > MAX_CONTACT_CORRECTION_STEP) {
      const scale = MAX_CONTACT_CORRECTION_STEP / correctionLength;
      correctionX *= scale;
      correctionZ *= scale;
    }

    const fromX = scratch.candidateX[i]!;
    const fromZ = scratch.candidateZ[i]!;
    const proposedX = clampPosition(fromX + correctionX);
    const proposedZ = clampPosition(fromZ + correctionZ);
    if (isWalkableStep(world, fromX, fromZ, proposedX, proposedZ)) {
      scratch.candidateX[i] = proposedX;
      scratch.candidateZ[i] = proposedZ;
      changed ||= proposedX !== fromX || proposedZ !== fromZ;
      continue;
    }

    if (proposedX !== fromX && isWalkableStep(world, fromX, fromZ, proposedX, fromZ)) {
      scratch.candidateX[i] = proposedX;
      changed = true;
      continue;
    }
    if (proposedZ !== fromZ && isWalkableStep(world, fromX, fromZ, fromX, proposedZ)) {
      scratch.candidateZ[i] = proposedZ;
      changed = true;
    }
  }
  return changed;
}

/**
 * Integrates terrain and every direct-combat body constraint as one transaction.
 * All contact pairs read one candidate snapshot per iteration; positions commit
 * only after the complete constraint graph has converged.
 */
export function integrateGroundMotion(
  world: GroundMotionWorld,
  hasActiveTargetReactions: boolean,
): void {
  const scratch = scratchFor(world, world.count);
  const contactCount = enumerateCombatContacts(world, hasActiveTargetReactions, scratch);
  if (contactCount === 0) {
    initializeTerrainCandidates(world, null);
    return;
  }
  initializeTerrainCandidates(world, scratch);

  for (let iteration = 0; iteration < MAX_CONTACT_ITERATIONS; iteration += 1) {
    const maximumViolation = accumulateContactCorrections(
      world,
      hasActiveTargetReactions,
      scratch,
      contactCount,
    );
    if (maximumViolation <= CONTACT_EPSILON) break;
    if (!applyContactCorrections(world, scratch)) break;
  }

  for (let i = 0; i < world.count; i += 1) {
    world.posX[i] = scratch.candidateX[i]!;
    world.posZ[i] = scratch.candidateZ[i]!;
  }
}
