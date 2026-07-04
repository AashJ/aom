import * as mat4 from "../math/mat4";
import type { Mat4 } from "../math/mat4";
import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";
import { createFrustum, frustumFromViewProj, type Frustum } from "../math/frustum";

const PITCH_RAD = (-55 * Math.PI) / 180;
const YAW_RAD = Math.PI / 4;
const FOV_Y_RAD = Math.PI / 4;
const NEAR = 0.5;
const FAR = 600;

export const MIN_DISTANCE = 12;
export const MAX_DISTANCE = 80;

const SMOOTH_TAU_MS = 80;

const UP = vec3.create(0, 1, 0);
const nearPoint = vec3.create();
const farPoint = vec3.create();

export interface Camera {
  // Input writes goals; smoothCamera eases displayed target/distance toward them; matrices derive from displayed.
  goalTarget: Vec3;
  goalDistance: number;
  target: Vec3;
  distance: number;
  bounds: Float32Array;
  viewDir: Vec3;
  eye: Vec3;
  view: Mat4;
  proj: Mat4;
  viewProj: Mat4;
  invViewProj: Mat4;
  frustum: Frustum;
}

export function createCamera(): Camera {
  return {
    goalTarget: vec3.create(128, 0, 128),
    goalDistance: 40,
    target: vec3.create(128, 0, 128),
    distance: 40,
    bounds: new Float32Array([0, 0, 256, 256]),
    viewDir: vec3.create(
      Math.cos(PITCH_RAD) * Math.sin(YAW_RAD),
      Math.sin(PITCH_RAD),
      Math.cos(PITCH_RAD) * Math.cos(YAW_RAD),
    ),
    eye: vec3.create(),
    view: mat4.create(),
    proj: mat4.create(),
    viewProj: mat4.create(),
    invViewProj: mat4.create(),
    frustum: createFrustum(),
  };
}

export function updateMatrices(camera: Camera, aspect: number): void {
  vec3.addScaled(camera.eye, camera.target, camera.viewDir, -camera.distance);
  mat4.lookAt(camera.view, camera.eye, camera.target, UP);
  mat4.perspective(camera.proj, FOV_Y_RAD, aspect, NEAR, FAR);
  mat4.multiply(camera.viewProj, camera.proj, camera.view);
  mat4.invert(camera.invViewProj, camera.viewProj);
  // Derived with the matrices so it can never be stale relative to them.
  frustumFromViewProj(camera.frustum, camera.viewProj);
}

export function pan(camera: Camera, rightUnits: number, forwardUnits: number): void {
  const vx = camera.viewDir[0]!;
  const vz = camera.viewDir[2]!;
  const len = Math.sqrt(vx * vx + vz * vz);
  const fx = len === 0 ? 0 : vx / len;
  const fz = len === 0 ? 0 : vz / len;
  const rx = -fz;
  const rz = fx;
  const target = camera.goalTarget;
  const bounds = camera.bounds;

  target[0] = Math.min(
    bounds[2]!,
    Math.max(bounds[0]!, target[0]! + rx * rightUnits + fx * forwardUnits),
  );
  target[2] = Math.min(
    bounds[3]!,
    Math.max(bounds[1]!, target[2]! + rz * rightUnits + fz * forwardUnits),
  );
}

export function zoom(camera: Camera, factor: number): void {
  camera.goalDistance = Math.min(
    MAX_DISTANCE,
    Math.max(MIN_DISTANCE, camera.goalDistance * factor),
  );
}

export function smoothCamera(camera: Camera, dtMs: number): void {
  // A time-based decay constant makes the glide frame-rate independent: 144 Hz and 60 Hz
  // settle identically, and about 63% of the gap closes per 80 ms.
  const k = 1 - Math.exp(-dtMs / SMOOTH_TAU_MS);

  vec3.lerp(camera.target, camera.target, camera.goalTarget, k);
  camera.distance += (camera.goalDistance - camera.distance) * k;

  const dx = camera.goalTarget[0]! - camera.target[0]!;
  const dy = camera.goalTarget[1]! - camera.target[1]!;
  const dz = camera.goalTarget[2]! - camera.target[2]!;

  if (dx * dx + dy * dy + dz * dz < 1e-8) {
    vec3.copy(camera.target, camera.goalTarget);
  }

  if (Math.abs(camera.goalDistance - camera.distance) < 1e-5) {
    camera.distance = camera.goalDistance;
  }
}

// Requires updateMatrices() after the last camera mutation. Depth 0/1 are near/far in WebGPU NDC.
export function screenRay(
  camera: Camera,
  ndcX: number,
  ndcY: number,
  outOrigin: Vec3,
  outDir: Vec3,
): void {
  vec3.set(outOrigin, ndcX, ndcY, 0);
  vec3.set(farPoint, ndcX, ndcY, 1);
  mat4.transformPoint(outOrigin, camera.invViewProj, outOrigin);
  mat4.transformPoint(farPoint, camera.invViewProj, farPoint);

  const fx = farPoint[0]!;
  const fy = farPoint[1]!;
  const fz = farPoint[2]!;

  // Callers use parametric t in [0,1] across the whole depth range; normalization is wasted.
  outDir[0] = fx - outOrigin[0]!;
  outDir[1] = fy - outOrigin[1]!;
  outDir[2] = fz - outOrigin[2]!;
}

// Requires updateMatrices() after the last camera mutation. Depth 0/1 are near/far in WebGPU NDC.
export function screenToGround(camera: Camera, ndcX: number, ndcY: number, out: Vec3): boolean {
  screenRay(camera, ndcX, ndcY, nearPoint, farPoint);

  const nx = nearPoint[0]!;
  const ny = nearPoint[1]!;
  const nz = nearPoint[2]!;
  const dx = farPoint[0]!;
  const dy = farPoint[1]!;
  const dz = farPoint[2]!;

  if (Math.abs(dy) < 1e-8) {
    return false;
  }

  const t = -ny / dy;

  if (t < 0) {
    return false;
  }

  out[0] = nx + dx * t;
  out[1] = ny + dy * t;
  out[2] = nz + dz * t;
  return true;
}
