// FNV-1a 32-bit over gameplay state: the future desync detector (M4) and the teeth
// of every determinism test (two worlds, same commands -> equal hashes forever).
// Excludes selectable/selected: per-client UI state, never part of shared lockstep
// state (ARCHITECTURE.md M3 decision). Also excludes the grid/push scratch arrays
// cellCount/cellStart/cellUnits/pushX/pushZ and flow caches unitField/fieldCache,
// which are rebuilt or derived from hashed state (moveTargets + walkable).
import type { World } from "./ecs/world";

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

  // Shared combat state: winner is the in-sim annihilation result, not UI-derived.
  word = world.winner >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  word = world.nextHandle >>> 0;
  h ^= word;
  h = Math.imul(h, FNV_PRIME);

  // heights are static after creation and seed-derived; rehashing constants buys nothing.
  const arrays = [
    world.posX,
    world.posZ,
    world.velX,
    world.velZ,
    world.moveTargetX,
    world.moveTargetZ,
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

  // Shared combat state: HP, cooldowns, targets, and order flags affect future strikes.
  for (let i = 0; i < world.count; i += 1) {
    word = world.hp[i]!;
    h ^= word;
    h = Math.imul(h, FNV_PRIME);
  }

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
