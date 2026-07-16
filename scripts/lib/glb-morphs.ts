const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;

interface Accessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
}

interface BufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface Mesh {
  weights?: number[];
  primitives: Array<{ targets?: Array<Record<string, number>> }>;
}

interface Gltf {
  accessors: Accessor[];
  bufferViews: BufferView[];
  buffers: Array<{ byteLength: number }>;
  meshes: Mesh[];
  nodes?: Array<{ mesh?: number }>;
  animations?: Array<{
    channels: Array<{ sampler: number; target: { node: number; path: string } }>;
    samplers: Array<{ input: number; output: number; interpolation?: string }>;
  }>;
}

interface MorphPlan {
  readonly sourceCount: number;
  readonly retained: readonly number[] | null;
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

function retainedTargetIndices(sourceCount: number, targetCount: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    indices.push(Math.round((index * (sourceCount - 1)) / (targetCount - 1)));
  }
  return indices;
}

function planMeshMorphs(mesh: Mesh, maxTargets: number): MorphPlan {
  const targetCounts = mesh.primitives.map((primitive) => primitive.targets?.length ?? 0);
  const sourceCount = targetCounts.find((count) => count > 0) ?? 0;
  if (sourceCount === 0) return { sourceCount: 0, retained: null };
  if (targetCounts.some((count) => count !== sourceCount)) {
    throw new Error("Every primitive in a morph-bearing mesh must share one target count.");
  }
  if (mesh.weights !== undefined && mesh.weights.length !== sourceCount) {
    throw new Error("Mesh weights do not match its morph-target count.");
  }
  return {
    sourceCount,
    retained: sourceCount > maxTargets ? retainedTargetIndices(sourceCount, maxTargets) : null,
  };
}

function accessorFloats(gltf: Gltf, binary: Uint8Array, accessorIndex: number): Float32Array {
  const accessor = gltf.accessors[accessorIndex];
  if (!accessor || accessor.componentType !== FLOAT || accessor.type !== "SCALAR") {
    throw new Error("Morph-weight animation must use a float SCALAR accessor.");
  }
  const bufferView = gltf.bufferViews[accessor.bufferView];
  if (!bufferView || bufferView.buffer !== 0) {
    throw new Error("Morph-weight animation must use the embedded GLB buffer.");
  }

  const values = new Float32Array(accessor.count);
  const source = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const stride = bufferView.byteStride ?? 4;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  for (let index = 0; index < accessor.count; index += 1) {
    values[index] = source.getFloat32(start + index * stride, true);
  }
  return values;
}

function projectWeights(
  source: Float32Array,
  keyframeCount: number,
  sourceCount: number,
  retained: readonly number[],
): Float32Array {
  const projected = new Float32Array(keyframeCount * retained.length);

  for (let keyframe = 0; keyframe < keyframeCount; keyframe += 1) {
    for (let sourceTarget = 0; sourceTarget < sourceCount; sourceTarget += 1) {
      const weight = source[keyframe * sourceCount + sourceTarget]!;
      if (weight === 0) continue;

      let upper = retained.findIndex((target) => target >= sourceTarget);
      if (upper < 0) upper = retained.length - 1;
      const lower = Math.max(0, upper - (retained[upper] === sourceTarget ? 0 : 1));
      const lowerTarget = retained[lower]!;
      const upperTarget = retained[upper]!;
      const alpha =
        upperTarget === lowerTarget
          ? 0
          : (sourceTarget - lowerTarget) / (upperTarget - lowerTarget);
      projected[keyframe * retained.length + lower] += weight * (1 - alpha);
      if (upper !== lower) projected[keyframe * retained.length + upper] += weight * alpha;
    }
  }

  return projected;
}

function encodeGlb(gltf: Gltf, binary: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = align4(json.length);
  const binaryLength = align4(binary.length);
  const output = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, output.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  output.fill(0x20, 20, 20 + jsonLength);
  output.set(json, 20);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, BIN_CHUNK, true);
  output.set(binary, binaryHeader + 8);
  return output;
}

/**
 * Resamples a vertex-frame GLB to the renderer's morph-target budget while
 * preserving the original animation clock and every non-morph node track.
 */
export function resampleGlbMorphTargets(file: Uint8Array, maxTargets: number): Uint8Array {
  if (maxTargets < 2) throw new RangeError("Morph-target budget must be at least two.");
  const header = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (
    file.byteLength < 28 ||
    header.getUint32(0, true) !== GLB_MAGIC ||
    header.getUint32(4, true) !== GLB_VERSION
  ) {
    throw new Error("Input is not a GLB 2.0 file.");
  }
  const jsonLength = header.getUint32(12, true);
  if (header.getUint32(16, true) !== JSON_CHUNK) throw new Error("GLB JSON chunk is missing.");
  const binaryHeader = 20 + jsonLength;
  if (header.getUint32(binaryHeader + 4, true) !== BIN_CHUNK) {
    throw new Error("GLB binary chunk is missing.");
  }
  const binaryLength = header.getUint32(binaryHeader, true);
  const gltf = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength))) as Gltf;
  const binary = file.slice(binaryHeader + 8, binaryHeader + 8 + binaryLength);
  const morphPlans = gltf.meshes.map((mesh) => planMeshMorphs(mesh, maxTargets));
  if (morphPlans.every((plan) => plan.retained === null)) return file.slice();

  for (let meshIndex = 0; meshIndex < gltf.meshes.length; meshIndex += 1) {
    const mesh = gltf.meshes[meshIndex]!;
    const retained = morphPlans[meshIndex]!.retained;
    if (retained === null) continue;
    for (const primitive of mesh.primitives) {
      primitive.targets = retained.map((index) => primitive.targets![index]!);
    }
    if (mesh.weights) mesh.weights = retained.map((index) => mesh.weights![index] ?? 0);
  }

  let expandedBinary = binary;
  for (const animation of gltf.animations ?? []) {
    const samplerSourceCounts = new Map<number, number>();
    for (const channel of animation.channels) {
      if (channel.target.path !== "weights") continue;
      const node = gltf.nodes?.[channel.target.node];
      if (node?.mesh === undefined) throw new Error("Morph animation target node has no mesh.");
      const plan = morphPlans[node.mesh];
      if (plan === undefined || plan.sourceCount === 0) {
        throw new Error("Morph animation targets a mesh without morph targets.");
      }
      if (animation.samplers[channel.sampler] === undefined) {
        throw new Error("Morph animation sampler is missing.");
      }
      const priorSourceCount = samplerSourceCounts.get(channel.sampler);
      if (priorSourceCount !== undefined && priorSourceCount !== plan.sourceCount) {
        throw new Error("One morph sampler cannot drive meshes with different target counts.");
      }
      samplerSourceCounts.set(channel.sampler, plan.sourceCount);
    }

    const projectedSamplerOutputs = new Map<
      number,
      { readonly sourceCount: number; readonly accessorIndex: number }
    >();
    for (const channel of animation.channels) {
      if (channel.target.path !== "weights") continue;
      const node = gltf.nodes?.[channel.target.node];
      if (node?.mesh === undefined) throw new Error("Morph animation target node has no mesh.");
      const plan = morphPlans[node.mesh];
      if (plan === undefined || plan.sourceCount === 0) {
        throw new Error("Morph animation targets a mesh without morph targets.");
      }
      if (plan.retained === null) continue;

      const priorProjection = projectedSamplerOutputs.get(channel.sampler);
      if (priorProjection !== undefined) {
        if (priorProjection.sourceCount !== plan.sourceCount) {
          throw new Error("One morph sampler cannot drive meshes with different target counts.");
        }
        animation.samplers[channel.sampler]!.output = priorProjection.accessorIndex;
        continue;
      }

      const sampler = animation.samplers[channel.sampler];
      if (!sampler) throw new Error("Morph animation sampler is missing.");
      const input = gltf.accessors[sampler.input];
      const sourceAccessor = gltf.accessors[sampler.output];
      if (!input || !sourceAccessor || sourceAccessor.count !== input.count * plan.sourceCount) {
        throw new Error("Morph-weight animation does not match the source targets.");
      }

      const projected = projectWeights(
        accessorFloats(gltf, binary, sampler.output),
        input.count,
        plan.sourceCount,
        plan.retained,
      );
      const byteOffset = align4(expandedBinary.length);
      const nextBinary = new Uint8Array(byteOffset + projected.byteLength);
      nextBinary.set(expandedBinary);
      nextBinary.set(new Uint8Array(projected.buffer), byteOffset);
      expandedBinary = nextBinary;

      const bufferViewIndex =
        gltf.bufferViews.push({
          buffer: 0,
          byteOffset,
          byteLength: projected.byteLength,
        }) - 1;
      const accessorIndex =
        gltf.accessors.push({
          ...sourceAccessor,
          bufferView: bufferViewIndex,
          byteOffset: 0,
          count: projected.length,
          min: [0],
          max: [1],
        }) - 1;
      sampler.output = accessorIndex;
      projectedSamplerOutputs.set(channel.sampler, {
        sourceCount: plan.sourceCount,
        accessorIndex,
      });
    }
  }

  gltf.buffers[0]!.byteLength = expandedBinary.length;
  return encodeGlb(gltf, expandedBinary);
}
