// Frustum planes use (a,b,c,d) with inside test a*x + b*y + c*z + d >= 0.
// Planes stay unnormalized because sign tests do not need metric distances, saving 6 sqrts.
import type { Mat4 } from "./mat4";

export type Frustum = Float32Array;

export function createFrustum(): Frustum {
  return new Float32Array(24);
}

export function frustumFromViewProj(out: Frustum, m: Mat4): Frustum {
  // Column-major matrix storage: row i is (m[i], m[4 + i], m[8 + i], m[12 + i]).
  const r00 = m[0]!;
  const r01 = m[4]!;
  const r02 = m[8]!;
  const r03 = m[12]!;
  const r10 = m[1]!;
  const r11 = m[5]!;
  const r12 = m[9]!;
  const r13 = m[13]!;
  const r20 = m[2]!;
  const r21 = m[6]!;
  const r22 = m[10]!;
  const r23 = m[14]!;
  const r30 = m[3]!;
  const r31 = m[7]!;
  const r32 = m[11]!;
  const r33 = m[15]!;

  out[0] = r30 + r00;
  out[1] = r31 + r01;
  out[2] = r32 + r02;
  out[3] = r33 + r03;
  out[4] = r30 - r00;
  out[5] = r31 - r01;
  out[6] = r32 - r02;
  out[7] = r33 - r03;
  out[8] = r30 + r10;
  out[9] = r31 + r11;
  out[10] = r32 + r12;
  out[11] = r33 + r13;
  out[12] = r30 - r10;
  out[13] = r31 - r11;
  out[14] = r32 - r12;
  out[15] = r33 - r13;
  // WebGPU/D3D clip z is [0,1], so near is row2 alone. The GL row3+row2
  // variant is wrong here; this is the [0,1]-depth cousin of the perspective porting bug.
  out[16] = r20;
  out[17] = r21;
  out[18] = r22;
  out[19] = r23;
  out[20] = r30 - r20;
  out[21] = r31 - r21;
  out[22] = r32 - r22;
  out[23] = r33 - r23;

  return out;
}

export function aabbIntersectsFrustum(
  f: Frustum,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): boolean {
  for (let p = 0; p < 6; p += 1) {
    const offset = p * 4;
    const a = f[offset]!;
    const b = f[offset + 1]!;
    const c = f[offset + 2]!;
    const d = f[offset + 3]!;
    // Pick the AABB corner most along the plane normal; if even that corner is outside
    // one plane, the whole box is outside.
    const px = a >= 0 ? maxX : minX;
    const py = b >= 0 ? maxY : minY;
    const pz = c >= 0 ? maxZ : minZ;

    if (a * px + b * py + c * pz + d < 0) {
      return false;
    }
  }

  // Conservative: a box outside a frustum corner can pass all 6 tests. False positives
  // just draw a chunk needlessly, never the reverse.
  return true;
}
