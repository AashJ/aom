// FNV-1a 32-bit over gameplay state: the future desync detector (M4) and the teeth
// of every determinism test (two worlds, same commands -> equal hashes forever).
// Excludes selectable/selected: per-client UI state, never part of shared lockstep
// state (ARCHITECTURE.md M3 decision). Also excludes the grid/push scratch arrays
// cellCount/cellStart/cellUnits/pushX/pushZ, which are rebuilt from hashed state.
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

  // heights/walkable are static after creation and seed-derived; rehashing constants buys nothing.
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

  return h >>> 0;
}
