import { MAX_MODEL_MORPH_TARGETS, type ModelAsset, type ModelKeyframeTrack } from "./glb";

export const MAX_MORPH_TARGETS = MAX_MODEL_MORPH_TARGETS;

export interface ModelAnimationState {
  weights: Float32Array;
  nodeMatrix: Float32Array;
}

const translation = new Float32Array(3);
const rotation = new Float32Array(4);
const scale = new Float32Array(3);

function frameSpan(times: Float32Array, time: number): [number, number, number] {
  if (times.length <= 1 || time <= times[0]!) return [0, 0, 0];
  const last = times.length - 1;
  if (time >= times[last]!) return [last, last, 0];

  let low = 0;
  let high = last;

  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (times[middle]! <= time) low = middle;
    else high = middle;
  }

  const start = times[low]!;
  const end = times[high]!;
  return [low, high, end > start ? (time - start) / (end - start) : 0];
}

function sampleVector(
  track: ModelKeyframeTrack | undefined,
  defaults: Float32Array,
  out: Float32Array,
): void {
  if (!track || track.times.length === 0) {
    out.set(defaults);
    return;
  }

  const [from, to, alpha] = frameSpan(track.times, currentSampleTime);

  for (let component = 0; component < track.components; component += 1) {
    const a = track.values[from * track.components + component]!;
    const b = track.values[to * track.components + component]!;
    out[component] = a + (b - a) * alpha;
  }
}

function sampleRotation(
  track: ModelKeyframeTrack | undefined,
  defaults: Float32Array,
  out: Float32Array,
): void {
  if (!track || track.times.length === 0) {
    out.set(defaults);
    return;
  }

  const [from, to, alpha] = frameSpan(track.times, currentSampleTime);
  const offsetA = from * 4;
  const offsetB = to * 4;
  let ax = track.values[offsetA]!;
  let ay = track.values[offsetA + 1]!;
  let az = track.values[offsetA + 2]!;
  let aw = track.values[offsetA + 3]!;
  let bx = track.values[offsetB]!;
  let by = track.values[offsetB + 1]!;
  let bz = track.values[offsetB + 2]!;
  let bw = track.values[offsetB + 3]!;
  let dot = ax * bx + ay * by + az * bz + aw * bw;

  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  let weightA: number;
  let weightB: number;

  if (dot > 0.9995) {
    weightA = 1 - alpha;
    weightB = alpha;
  } else {
    const theta = Math.acos(Math.min(1, Math.max(-1, dot)));
    const inverseSin = 1 / Math.sin(theta);
    weightA = Math.sin((1 - alpha) * theta) * inverseSin;
    weightB = Math.sin(alpha * theta) * inverseSin;
  }

  ax = ax * weightA + bx * weightB;
  ay = ay * weightA + by * weightB;
  az = az * weightA + bz * weightB;
  aw = aw * weightA + bw * weightB;
  const inverseLength = 1 / Math.sqrt(ax * ax + ay * ay + az * az + aw * aw);
  out[0] = ax * inverseLength;
  out[1] = ay * inverseLength;
  out[2] = az * inverseLength;
  out[3] = aw * inverseLength;
}

let currentSampleTime = 0;

export function sampleModelAnimation(
  asset: ModelAsset,
  time: number,
  nodeIndex: number,
  out: ModelAnimationState,
): void {
  currentSampleTime =
    asset.duration > 0 ? ((time % asset.duration) + asset.duration) % asset.duration : 0;
  out.weights.fill(0);

  const morphTrack = asset.morphTrack;
  if (morphTrack && morphTrack.times.length > 0) {
    const [from, to, alpha] = frameSpan(morphTrack.times, currentSampleTime);
    const count = morphTrack.targetCount;

    for (let target = 0; target < count; target += 1) {
      const a = morphTrack.weights[from * morphTrack.targetCount + target]!;
      const b = morphTrack.weights[to * morphTrack.targetCount + target]!;
      out.weights[target] = a + (b - a) * alpha;
    }
  }

  const matrix = out.nodeMatrix;
  const node = nodeIndex >= 0 ? asset.nodes[nodeIndex] : undefined;

  if (!node) {
    matrix.fill(0);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    return;
  }

  sampleVector(node.translationTrack, node.translation, translation);
  sampleRotation(node.rotationTrack, node.rotation, rotation);
  sampleVector(node.scaleTrack, node.scale, scale);

  const x = rotation[0]!;
  const y = rotation[1]!;
  const z = rotation[2]!;
  const w = rotation[3]!;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = scale[0]!;
  const sy = scale[1]!;
  const sz = scale[2]!;

  matrix[0] = (1 - (yy + zz)) * sx;
  matrix[1] = (xy + wz) * sx;
  matrix[2] = (xz - wy) * sx;
  matrix[3] = 0;
  matrix[4] = (xy - wz) * sy;
  matrix[5] = (1 - (xx + zz)) * sy;
  matrix[6] = (yz + wx) * sy;
  matrix[7] = 0;
  matrix[8] = (xz + wy) * sz;
  matrix[9] = (yz - wx) * sz;
  matrix[10] = (1 - (xx + yy)) * sz;
  matrix[11] = 0;
  matrix[12] = translation[0]!;
  matrix[13] = translation[1]!;
  matrix[14] = translation[2]!;
  matrix[15] = 1;
}
