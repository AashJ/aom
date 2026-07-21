/** Returns the first normalized contact along a segment, or -1 when it misses. */
export function circleSweepEntryFraction(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  centerX: number,
  centerZ: number,
  radius: number,
): number {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const relativeX = startX - centerX;
  const relativeZ = startZ - centerZ;
  const c = relativeX * relativeX + relativeZ * relativeZ - radius * radius;
  if (c <= 0) return 0;

  const a = segmentX * segmentX + segmentZ * segmentZ;
  if (a <= 0) return -1;

  const b = 2 * (relativeX * segmentX + relativeZ * segmentZ);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return -1;

  const entryFraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return entryFraction >= 0 && entryFraction <= 1 ? entryFraction : -1;
}
