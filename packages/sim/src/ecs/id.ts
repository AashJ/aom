// Generational packed ids per ARCHITECTURE.md M5 — id = index | (generation << 16).
// Once units can die, raw indices dangle; the generation counter makes staleness
// detectable. At generation 0 a packed id EQUALS its index, which is why this
// lands before death with zero behavioral change. MAX_UNITS (10_000) fits 16 bits;
// Uint16 generations wrap after 65k reuses of one slot — acceptable by a wide margin.
export function packId(index: number, generation: number): number {
  return (index | (generation << 16)) >>> 0;
}

export function idIndex(id: number): number {
  return id & 0xffff;
}

export function idGeneration(id: number): number {
  return id >>> 16;
}
