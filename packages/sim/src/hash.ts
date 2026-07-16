// FNV-1a 32-bit over gameplay state: the future desync detector (M4) and the teeth
// of every determinism test (two worlds, same commands -> equal hashes forever).
// Excludes selectable/selected: per-client UI state, never part of shared lockstep
// state (ARCHITECTURE.md M3 decision). Also excludes the grid/push scratch arrays
// cellCount/cellStart/cellUnits/pushX/pushZ and flow caches unitField/fieldCache,
// which are rebuilt or derived from hashed state (moveTargets + walkable).
import { MAX_TRAIN_QUEUE } from "./ecs/production";
import type { World } from "./ecs/world";
import { AGE_COUNT } from "./ecs/progression";
import { VISIBILITY_TILES } from "./visibility";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashWorld(world: World): number {
  let h = FNV_OFFSET;
  let word = world.tick >>> 0;

  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  word = world.count >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  // Runtime projectile accuracy consumes the shared PCG stream. Both halves of
  // its state and sequence must desync at the draw that diverged, not later.
  const rngWords = [
    Number(world.rng.state & 0xffff_ffffn),
    Number((world.rng.state >> 32n) & 0xffff_ffffn),
    Number(world.rng.inc & 0xffff_ffffn),
    Number((world.rng.inc >> 32n) & 0xffff_ffffn),
  ];
  for (const rngWord of rngWords) {
    word = rngWord >>> 0;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Shared combat state: winner is the in-sim annihilation result, not UI-derived.
  word = world.winner >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  word = world.nextHandle >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  // Visibility is authoritative gameplay state: it gates targeting, placement, and
  // automatic acquisition, so a disagreement must be caught at the revealing tick.
  word = world.playerCount >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  for (let i = 0; i < world.playerCount; i += 1) {
    const playerId = world.playerIds[i]!;

    word = playerId;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    // Progression is owner-id-indexed rather than visibility-slot-indexed. It
    // affects future command legality, so every choice is authoritative state.
    word = world.playerAge[playerId]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    word = world.playerMajorGod[playerId]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    word = world.playerFavorProgress[playerId]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    const minorGodStart = playerId * AGE_COUNT;

    for (let age = 0; age < AGE_COUNT; age += 1) {
      word = world.playerMinorGods[minorGodStart + age]!;
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
    }
  }

  const visibilityLength = world.playerCount * VISIBILITY_TILES;

  for (let i = 0; i < visibilityLength; i += 1) {
    word = world.visibility[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // heights are static after creation and seed-derived; rehashing constants buys nothing.
  const arrays = [
    world.posX,
    world.posZ,
    world.velX,
    world.velZ,
    world.moveTargetX,
    world.moveTargetZ,
    world.facingX,
    world.facingZ,
    world.hp,
  ];

  for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex += 1) {
    const values = arrays[arrayIndex]!;
    // Explicit endianness makes the hash platform-stable; typed-array views would inherit
    // platform byte order. Allocation is fine: hashing is a test/diagnostic path, not per-tick.
    const view = new DataView(
      values.buffer,
      values.byteOffset,
      world.count * Float64Array.BYTES_PER_ELEMENT,
    );

    for (let i = 0; i < world.count; i += 1) {
      const byteOffset = i * Float64Array.BYTES_PER_ELEMENT;

      word = view.getUint32(byteOffset, true);
      h ^= word;
      h = Math.imul(h, FNV_PRIME);

      word = view.getUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, true);
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
    }
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.moving[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Owner is shared gameplay state; a disagreement means different validation outcomes.
  for (let i = 0; i < world.count; i += 1) {
    word = world.owner[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Stockpiles are shared economy state; a one-unit disagreement means different affordability outcomes later.
  for (let i = 0; i < world.stockpiles.length; i += 1) {
    word = world.stockpiles[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // walkability is dynamic state as of M6-2: buildings stamp it. It is technically
  // derivable from hashed entity state, but hashing it surfaces a stamping desync
  // at the edit tick instead of ticks later when pathing diverges - the free-handle-stack
  // argument again.
  for (let i = 0; i < world.walkable.length; i += 1) {
    word = world.walkable[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.unitType[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Relic containment changes targeting, presentation, and future release
  // positions, so the stable container relationship is authoritative state.
  for (let i = 0; i < world.count; i += 1) {
    word = world.containedBy[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Handle wiring determines which commands resolve — clients must agree on it exactly.
  for (let i = 0; i < world.count; i += 1) {
    word = world.handleOf[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Generations are indexed by handle, not dense slot. A client that disagrees about a
  // handle's generation would accept/reject different commands.
  for (let i = 0; i < world.nextHandle; i += 1) {
    word = world.generation[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Shared combat state: cooldowns, targets, and order flags affect future strikes.
  for (let i = 0; i < world.count; i += 1) {
    word = world.attackCooldown[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.attackTarget[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.attackOrdered[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.attackAimTarget[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    word = world.attackAimShots[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // Queued releases and in-flight projectiles determine future damage. Hash the
  // complete lifecycle, including stable identities used by snapshots.
  word = world.projectiles.count >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);
  word = world.projectiles.nextId >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  const projectileIntegerArrays = [
    world.projectiles.ids,
    world.projectiles.owners,
    world.projectiles.sourceTypes,
    world.projectiles.sourceIds,
    world.projectiles.targetIds,
    world.projectiles.priorShots,
    world.projectiles.launchTicks,
    world.projectiles.impactTicks,
    world.projectiles.expiresBeforeImpact,
  ];
  for (const values of projectileIntegerArrays) {
    for (let i = 0; i < world.projectiles.count; i += 1) {
      word = values[i]!;
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
    }
  }

  const projectilePositionArrays = [
    world.projectiles.launchX,
    world.projectiles.launchZ,
    world.projectiles.impactX,
    world.projectiles.impactZ,
  ];
  for (const values of projectilePositionArrays) {
    const view = new DataView(
      values.buffer,
      values.byteOffset,
      world.projectiles.count * Float64Array.BYTES_PER_ELEMENT,
    );
    for (let i = 0; i < world.projectiles.count; i += 1) {
      const byteOffset = i * Float64Array.BYTES_PER_ELEMENT;
      word = view.getUint32(byteOffset, true);
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
      word = view.getUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, true);
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
    }
  }

  // The whole economy state machine is shared state.
  for (let i = 0; i < world.count; i += 1) {
    word = world.mode[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.carried[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.carriedResource[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.taskTarget[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  const gatherPosArrays = [world.gatherPosX, world.gatherPosZ];

  for (let arrayIndex = 0; arrayIndex < gatherPosArrays.length; arrayIndex += 1) {
    const values = gatherPosArrays[arrayIndex]!;
    const view = new DataView(
      values.buffer,
      values.byteOffset,
      world.count * Float64Array.BYTES_PER_ELEMENT,
    );

    for (let i = 0; i < world.count; i += 1) {
      const byteOffset = i * Float64Array.BYTES_PER_ELEMENT;

      word = view.getUint32(byteOffset, true);
      h ^= word;
      h = Math.imul(h, FNV_PRIME);

      word = view.getUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, true);
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
    }
  }

  for (let i = 0; i < world.count; i += 1) {
    word = world.buildProgress[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // In-flight production and every promised queue slot are sim state like any other.
  for (let i = 0; i < world.count; i += 1) {
    word = world.trainRemaining[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    word = world.trainQueueLength[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    const queueStart = i * MAX_TRAIN_QUEUE;
    for (let queueIndex = 0; queueIndex < world.trainQueueLength[i]!; queueIndex += 1) {
      word = world.trainQueueTypes[queueStart + queueIndex]!;
      h ^= word;
      h = Math.imul(h, FNV_PRIME);
    }

    word = world.researchId[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    word = world.researchChoice[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);

    word = world.researchRemaining[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  // The free-handle stack decides which handle the NEXT spawn gets. Without it, a
  // divergence in death bookkeeping could hide until a later spawn surfaces it —
  // fold it so desyncs are detected at the tick they happen, not ticks later.
  word = world.freeHandleCount >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  for (let i = 0; i < world.freeHandleCount; i += 1) {
    word = world.freeHandles[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

  return h >>> 0;
}
