import * as mat4 from "../math/mat4";
import type { Mat4 } from "../math/mat4";
import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";

const PITCH_RAD = (-55 * Math.PI) / 180;
const YAW_RAD = Math.PI / 4;
const FOV_Y_RAD = Math.PI / 4;
const NEAR = 0.5;
const FAR = 600;

export const MIN_DISTANCE = 12;
export const MAX_DISTANCE = 80;

const UP = vec3.create(0, 1, 0);
const nearPoint = vec3.create();
const farPoint = vec3.create();

export interface Camera {
  target: Vec3;
  distance: number;
  bounds: Float32Array;
  viewDir: Vec3;
  eye: Vec3;
  view: Mat4;
  proj: Mat4;
  viewProj: Mat4;
  invViewProj: Mat4;
}

export function createCamera(): Camera {
  return {
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
  };
}

export function updateMatrices(camera: Camera, aspect: number): void {
  vec3.addScaled(camera.eye, camera.target, camera.viewDir, -camera.distance);
  mat4.lookAt(camera.view, camera.eye, camera.target, UP);
  mat4.perspective(camera.proj, FOV_Y_RAD, aspect, NEAR, FAR);
  mat4.multiply(camera.viewProj, camera.proj, camera.view);
  mat4.invert(camera.invViewProj, camera.viewProj);
}

export function pan(camera: Camera, rightUnits: number, forwardUnits: number): void {
  const vx = camera.viewDir[0]!;
  const vz = camera.viewDir[2]!;
  const len = Math.sqrt(vx * vx + vz * vz);
  const fx = len === 0 ? 0 : vx / len;
  const fz = len === 0 ? 0 : vz / len;
  const rx = -fz;
  const rz = fx;
  const target = camera.target;
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
  camera.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, camera.distance * factor));
}

// Requires updateMatrices() after the last camera mutation. Depth 0/1 are near/far in WebGPU NDC.
export function screenToGround(camera: Camera, ndcX: number, ndcY: number, out: Vec3): boolean {
  vec3.set(nearPoint, ndcX, ndcY, 0);
  vec3.set(farPoint, ndcX, ndcY, 1);
  mat4.transformPoint(nearPoint, camera.invViewProj, nearPoint);
  mat4.transformPoint(farPoint, camera.invViewProj, farPoint);

  const nx = nearPoint[0]!;
  const ny = nearPoint[1]!;
  const nz = nearPoint[2]!;
  const dx = farPoint[0]! - nx;
  const dy = farPoint[1]! - ny;
  const dz = farPoint[2]! - nz;

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
