// Render-side math only: plain f32/number ops, not sim-deterministic gameplay math.
// Zero-allocation out-parameter style; only create() allocates.
// Imported namespace-style, so names are short and unprefixed.

export type Vec3 = Float32Array;

export function create(x = 0, y = 0, z = 0): Vec3 {
  const out = new Float32Array(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function copy(out: Vec3, a: Vec3): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  out[0] = ax;
  out[1] = ay;
  out[2] = az;
  return out;
}

export function add(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  const bx = b[0]!,
    by = b[1]!,
    bz = b[2]!;
  out[0] = ax + bx;
  out[1] = ay + by;
  out[2] = az + bz;
  return out;
}

export function sub(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  const bx = b[0]!,
    by = b[1]!,
    bz = b[2]!;
  out[0] = ax - bx;
  out[1] = ay - by;
  out[2] = az - bz;
  return out;
}

export function scale(out: Vec3, a: Vec3, s: number): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  out[0] = ax * s;
  out[1] = ay * s;
  out[2] = az * s;
  return out;
}

export function addScaled(out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  const bx = b[0]!,
    by = b[1]!,
    bz = b[2]!;
  out[0] = ax + bx * s;
  out[1] = ay + by * s;
  out[2] = az + bz * s;
  return out;
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

export function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  const bx = b[0]!,
    by = b[1]!,
    bz = b[2]!;
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

export function length(a: Vec3): number {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

export function normalize(out: Vec3, a: Vec3): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  const len = Math.sqrt(ax * ax + ay * ay + az * az);

  if (len === 0) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
  }

  const invLen = 1 / len;
  out[0] = ax * invLen;
  out[1] = ay * invLen;
  out[2] = az * invLen;
  return out;
}

export function lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  const ax = a[0]!,
    ay = a[1]!,
    az = a[2]!;
  const bx = b[0]!,
    by = b[1]!,
    bz = b[2]!;
  out[0] = ax + (bx - ax) * t;
  out[1] = ay + (by - ay) * t;
  out[2] = az + (bz - az) * t;
  return out;
}
