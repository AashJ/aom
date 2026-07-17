// Generational packed ids per ARCHITECTURE.md M5 — id = index | (generation << 16).
// Once units can die, raw indices dangle; the generation counter makes staleness
// detectable. At generation 0 a packed id EQUALS its index, which is why this
// lands before death with zero behavioral change. MAX_UNITS (10_000) fits 16 bits;
// Uint16 generations wrap after 65k reuses of one slot — acceptable by a wide margin.
// Packed id 0 is valid, so an impossible handle is the empty-target sentinel.
export const NO_TARGET = 0xffff_ffff;

export interface StableIdState {
  readonly generation: Uint16Array;
  readonly handleOf: Uint32Array;
}

export interface StableIdLookupState extends StableIdState {
  readonly slotOf: Int32Array;
  readonly nextHandle: number;
}

export function packId(index: number, generation: number): number {
  return (index | (generation << 16)) >>> 0;
}

export function stableIdAt(state: StableIdState, index: number): number {
  const handle = state.handleOf[index]!;
  return packId(handle, state.generation[handle]!);
}

export function resolveStableId(state: StableIdLookupState, id: number): number {
  const handle = idIndex(id);
  if (handle >= state.nextHandle || state.generation[handle] !== idGeneration(id)) return -1;
  return state.slotOf[handle]!;
}

export function idIndex(id: number): number {
  return id & 0xffff;
}

export function idGeneration(id: number): number {
  return id >>> 16;
}
