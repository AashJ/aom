interface ClassicBarEntry {
  readonly name: string;
  readonly fileOffset: number;
  readonly compressedLength: number;
  readonly uncompressedLength: number;
}

export interface ClassicParticleSource {
  readonly version: number;
  readonly loop: boolean;
  readonly syncWithAttackAnimation: boolean;
  readonly maxParticles: number;
  readonly particleLifetimeSeconds: number;
  readonly emissionStartSeconds: number;
  readonly emissionDurationSeconds: number;
  readonly emissionRatePerSecond: number;
  readonly emissionRateVariance: number;
  readonly initialVelocity: number;
  readonly usesSpreader: boolean;
  readonly shapeType: number;
  readonly offAxisDegrees: number;
  readonly offPlaneDegrees: number;
  readonly materialType: number;
  readonly baseScale: number;
  readonly scaleCycleSeconds: number;
  readonly opacityStages: readonly (readonly [number, number, number, number])[];
  readonly scaleStages: readonly (readonly [number, number, number, number])[];
  readonly appearanceFiles: readonly string[];
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function barEntries(bytes: Uint8Array): readonly ClassicBarEntry[] {
  const view = dataView(bytes);
  if (bytes.byteLength < 28 || view.getBigUint64(0, true) !== 0n) {
    throw new Error("Not a Classic AoM BAR archive.");
  }
  const fileCount = view.getUint32(12, true);
  const directorySize = view.getUint32(16, true);
  const directoryOffset = view.getUint32(20, true);
  const entriesOffset = directoryOffset + fileCount * 4;
  if (directoryOffset + directorySize > bytes.byteLength || entriesOffset > bytes.byteLength) {
    throw new Error("Classic BAR directory is out of bounds.");
  }

  const decoder = new TextDecoder();
  const entries: ClassicBarEntry[] = [];
  for (let index = 0; index < fileCount; index += 1) {
    const relativeOffset = view.getUint32(directoryOffset + index * 4, true);
    const entryOffset = entriesOffset + relativeOffset;
    if (entryOffset + 20 > bytes.byteLength) {
      throw new Error(`Classic BAR entry ${index} is out of bounds.`);
    }
    const fileOffset = view.getUint32(entryOffset, true);
    const compressedLength = view.getUint32(entryOffset + 4, true);
    const uncompressedLength = view.getUint32(entryOffset + 8, true);
    const nameStart = entryOffset + 20;
    let nameEnd = nameStart;
    while (nameEnd < bytes.byteLength && bytes[nameEnd] !== 0) nameEnd += 1;
    if (nameEnd === bytes.byteLength || fileOffset + compressedLength > directoryOffset) {
      throw new Error(`Classic BAR entry ${index} has invalid payload bounds.`);
    }
    entries.push({
      name: decoder.decode(bytes.subarray(nameStart, nameEnd)),
      fileOffset,
      compressedLength,
      uncompressedLength,
    });
  }
  return entries;
}

export function readClassicBarEntry(bytes: Uint8Array, requestedName: string): Uint8Array {
  const normalizedName = requestedName.toLowerCase();
  const entry = barEntries(bytes).find(
    (candidate) => candidate.name.toLowerCase() === normalizedName,
  );
  if (entry === undefined) throw new Error(`Classic BAR has no entry ${requestedName}.`);
  if (entry.compressedLength !== entry.uncompressedLength) {
    throw new Error(`Compressed Classic BAR entry is unsupported: ${entry.name}.`);
  }
  return bytes.subarray(entry.fileOffset, entry.fileOffset + entry.compressedLength);
}

class ParticleReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    this.view = dataView(bytes);
  }

  private ensure(size: number): void {
    if (this.offset + size > this.bytes.byteLength) {
      throw new Error("Classic PRT ended before its declared fields.");
    }
  }

  byte(): number {
    this.ensure(1);
    return this.view.getUint8(this.offset++);
  }

  int32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  float32(): number {
    this.ensure(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  skip(size: number): void {
    this.ensure(size);
    this.offset += size;
  }

  floats(count: number): number[] {
    return Array.from({ length: count }, () => this.float32());
  }

  string(): string {
    const length = this.int32();
    if (length < 0) throw new Error("Classic PRT has a negative string length.");
    const byteLength = length * 2;
    this.ensure(byteLength);
    const value = new TextDecoder("utf-16le").decode(
      this.bytes.subarray(this.offset, this.offset + byteLength),
    );
    this.offset += byteLength;
    return value;
  }

  atEnd(): boolean {
    return this.offset === this.bytes.byteLength;
  }
}

function stages(
  reader: ParticleReader,
  count: number,
): readonly (readonly [number, number, number, number])[] {
  return Array.from({ length: count }, () => reader.floats(4) as [number, number, number, number]);
}

export function readClassicParticleSource(bytes: Uint8Array): ClassicParticleSource {
  const reader = new ParticleReader(bytes);
  const version = reader.int32();
  if (version !== 12) throw new Error(`Unsupported Classic PRT version ${version}.`);

  const emitterFlags = Array.from({ length: 8 }, () => reader.byte());
  const syncWithAttackAnimation = reader.byte() !== 0;
  reader.skip(3);
  const maxParticles = reader.int32();
  reader.int32(); // appearance type
  const emitter = reader.floats(32);

  const shapeFlags = Array.from({ length: 3 }, () => reader.byte());
  reader.skip(1);
  const shapeType = reader.int32();
  const shape = reader.floats(12);

  reader.byte(); // orient by motion
  reader.skip(3);
  const appearanceFileCount = reader.int32();
  reader.int32(); // frame count
  reader.int32(); // frame width
  reader.int32(); // frame height
  const materialType = reader.int32();
  reader.skip(8); // emissive and specular texels
  reader.floats(4);

  reader.byte(); // opacity cycle loop
  reader.skip(3);
  const opacityStageCount = reader.int32();
  reader.floats(4);

  reader.byte(); // scale cycle loop
  reader.skip(3);
  const scaleStageCount = reader.int32();
  const scale = reader.floats(10);

  reader.byte(); // use color palette
  reader.byte(); // color cycle loop
  reader.skip(2);
  const paletteCount = reader.int32();
  const colorStageCount = reader.int32();
  reader.floats(3);
  reader.skip(4); // base color texel

  reader.skip(4); // force flags
  reader.floats(20);
  const collisionCount = reader.int32();
  reader.int32(); // terrain interaction type
  reader.floats(2);
  reader.string(); // BRG filename
  reader.skip(paletteCount * 4);
  reader.floats(appearanceFileCount); // appearance weights
  const appearanceFiles = Array.from({ length: appearanceFileCount }, () => reader.string());
  const opacityStages = stages(reader, opacityStageCount);
  const scaleStages = stages(reader, scaleStageCount);
  // Color and collision records are not used by the source sound-wave effect.
  if (colorStageCount !== 0 || collisionCount !== 0 || !reader.atEnd()) {
    throw new Error("Unsupported Classic PRT color or collision records.");
  }

  return {
    version,
    loop: emitterFlags[3] === 1,
    syncWithAttackAnimation,
    maxParticles,
    particleLifetimeSeconds: emitter[2]!,
    emissionStartSeconds: emitter[12]!,
    emissionDurationSeconds: emitter[16]!,
    emissionRatePerSecond: emitter[10]!,
    emissionRateVariance: emitter[11]!,
    initialVelocity: emitter[22]!,
    usesSpreader: shapeFlags[2] === 1,
    shapeType,
    offAxisDegrees: shape[7]!,
    offPlaneDegrees: shape[9]!,
    materialType,
    baseScale: scale[0]!,
    scaleCycleSeconds: scale[8]!,
    opacityStages,
    scaleStages,
    appearanceFiles,
  };
}

export function classicDdtDimensions(bytes: Uint8Array): readonly [width: number, height: number] {
  if (bytes.byteLength < 16 || new TextDecoder().decode(bytes.subarray(0, 4)) !== "RTS3") {
    throw new Error("Not a Classic AoM DDT texture.");
  }
  const view = dataView(bytes);
  return [view.getUint32(8, true), view.getUint32(12, true)];
}
