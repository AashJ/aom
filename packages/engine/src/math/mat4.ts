// Render-side math only: plain f32/number ops, not sim-deterministic gameplay math.
// Zero-allocation out-parameter style; only create() allocates.
// Column-major Mat4: element (row r, column c) is c * 4 + r, matching WGSL uploads.

import type { Vec3 } from "./vec3";

export type Mat4 = Float32Array;

export function create(): Mat4 {
  const out = new Float32Array(16);
  return identity(out);
}

export function identity(out: Mat4): Mat4 {
  out[0] = out[5] = out[10] = out[15] = 1;
  out[1] = out[2] = out[3] = out[4] = 0;
  out[6] = out[7] = out[8] = out[9] = 0;
  out[11] = out[12] = out[13] = out[14] = 0;
  return out;
}

export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const a00 = a[0]!,
    a01 = a[1]!,
    a02 = a[2]!,
    a03 = a[3]!;
  const a10 = a[4]!,
    a11 = a[5]!,
    a12 = a[6]!,
    a13 = a[7]!;
  const a20 = a[8]!,
    a21 = a[9]!,
    a22 = a[10]!,
    a23 = a[11]!;
  const a30 = a[12]!,
    a31 = a[13]!,
    a32 = a[14]!,
    a33 = a[15]!;

  let b0 = b[0]!;
  let b1 = b[1]!;
  let b2 = b[2]!;
  let b3 = b[3]!;
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4]!;
  b1 = b[5]!;
  b2 = b[6]!;
  b3 = b[7]!;
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8]!;
  b1 = b[9]!;
  b2 = b[10]!;
  b3 = b[11]!;
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12]!;
  b1 = b[13]!;
  b2 = b[14]!;
  b3 = b[15]!;
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}

export function perspective(
  out: Mat4,
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const f = 1 / Math.tan(fovYRadians / 2);
  const nf = 1 / (near - far);

  out[0] = f / aspect;
  out[1] = out[2] = out[3] = out[4] = 0;
  out[5] = f;
  out[6] = out[7] = out[8] = out[9] = 0;
  // Right-handed WebGPU/D3D depth maps to [0, 1], not WebGL's [-1, 1].
  out[10] = far * nf;
  out[11] = -1;
  out[12] = out[13] = 0;
  out[14] = near * far * nf;
  out[15] = 0;
  return out;
}

export function lookAt(out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const ex = eye[0]!,
    ey = eye[1]!,
    ez = eye[2]!;
  const tx = target[0]!,
    ty = target[1]!,
    tz = target[2]!;
  const ux = up[0]!,
    uy = up[1]!,
    uz = up[2]!;

  let zx = ex - tx;
  let zy = ey - ty;
  let zz = ez - tz;
  let len = Math.sqrt(zx * zx + zy * zy + zz * zz);

  if (len === 0) {
    return identity(out);
  }

  len = 1 / len;
  zx *= len;
  zy *= len;
  zz *= len;

  let xx = uy * zz - uz * zy;
  let xy = uz * zx - ux * zz;
  let xz = ux * zy - uy * zx;
  len = Math.sqrt(xx * xx + xy * xy + xz * xz);

  if (len !== 0) {
    len = 1 / len;
    xx *= len;
    xy *= len;
    xz *= len;
  }

  let yx = zy * xz - zz * xy;
  let yy = zz * xx - zx * xz;
  let yz = zx * xy - zy * xx;
  len = Math.sqrt(yx * yx + yy * yy + yz * yz);

  if (len !== 0) {
    len = 1 / len;
    yx *= len;
    yy *= len;
    yz *= len;
  }

  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

export function invert(out: Mat4, a: Mat4): boolean {
  const a00 = a[0]!,
    a01 = a[1]!,
    a02 = a[2]!,
    a03 = a[3]!;
  const a10 = a[4]!,
    a11 = a[5]!,
    a12 = a[6]!,
    a13 = a[7]!;
  const a20 = a[8]!,
    a21 = a[9]!,
    a22 = a[10]!,
    a23 = a[11]!;
  const a30 = a[12]!,
    a31 = a[13]!,
    a32 = a[14]!,
    a33 = a[15]!;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (Math.abs(det) < 1e-8) {
    return false;
  }

  const invDet = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * invDet;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * invDet;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * invDet;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * invDet;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * invDet;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * invDet;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * invDet;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * invDet;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
  return true;
}

export function transformPoint(out: Vec3, m: Mat4, v: Vec3): Vec3 {
  const x = v[0]!,
    y = v[1]!,
    z = v[2]!;
  const rx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  const ry = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  const rz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  const rw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;

  if (Math.abs(rw) < 1e-8) {
    out[0] = rx;
    out[1] = ry;
    out[2] = rz;
    return out;
  }

  const invW = 1 / rw;
  out[0] = rx * invW;
  out[1] = ry * invW;
  out[2] = rz * invW;
  return out;
}

export function transformDirection(out: Vec3, m: Mat4, v: Vec3): Vec3 {
  const x = v[0]!,
    y = v[1]!,
    z = v[2]!;
  out[0] = m[0]! * x + m[4]! * y + m[8]! * z;
  out[1] = m[1]! * x + m[5]! * y + m[9]! * z;
  out[2] = m[2]! * x + m[6]! * y + m[10]! * z;
  return out;
}
