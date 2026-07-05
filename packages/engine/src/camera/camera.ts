import { heightAt } from "@aom/sim";
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

const EYE_CLEARANCE = 2.5;
const HARD_FLOOR_CLEARANCE = 0.75;
const LIFT_RISE_TAU_MS = 60;
const LIFT_FALL_TAU_MS = 300;
// Terrain-follow fades from full effect at FOLLOW_FULL_DIST to none at FOLLOW_ZERO_DIST.
const FOLLOW_FULL_DIST = 20;
const FOLLOW_ZERO_DIST = 55;
const HEIGHT_TAU_MS = 250;
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
  // Render-side anti-clip lift added to the eye's y in updateMatrices; rises instantly
  // because clipping must never win a frame, and decays smoothly (tau 250 ms) so
  // cresting a ridge does not drop the camera like a stone. Lifting only the eye
  // steepens pitch near cliffs deliberately, classic RTS behavior; downstream math
  // derives from the real matrices, so picking, zoom anchors, and frustum stay aligned.
  eyeLift: number;
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
    eyeLift: 0,
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
  camera.eye[1] = camera.eye[1]! + camera.eyeLift;
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

export function applyCameraTerrain(camera: Camera, heights: Float32Array, dtMs: number): void {
  const goalTarget = camera.goalTarget;
  // Terrain-following only helps when zoomed in (that is where the eye can clip);
  // zoomed out it makes the whole view porpoise over every mountain crossing screen
  // center. Fade the follow weight to zero with distance so far zoom is rock-steady.
  let followWeight = Math.min(
    1,
    Math.max(0, (FOLLOW_ZERO_DIST - camera.distance) / (FOLLOW_ZERO_DIST - FOLLOW_FULL_DIST)),
  );
  followWeight = followWeight * followWeight * (3 - 2 * followWeight);

  const sampledY = heightAt(heights, goalTarget[0]!, goalTarget[2]!) * followWeight;
  // Pre-smooth the goal height with its own slower time constant; smoothCamera's
  // 80 ms then stacks on top. Terrain height is a rough signal - a single smoother
  // tuned for pan snappiness is too fast for it.
  goalTarget[1] =
    goalTarget[1]! + (sampledY - goalTarget[1]!) * (1 - Math.exp(-dtMs / HEIGHT_TAU_MS));

  const target = camera.target;
  const viewDir = camera.viewDir;
  const distance = camera.distance;
  const ex = target[0]! - viewDir[0]! * distance;
  const ey = target[1]! - viewDir[1]! * distance;
  const ez = target[2]! - viewDir[2]! * distance;
  const eyeGroundY = heightAt(heights, ex, ez);
  const needEye = eyeGroundY + EYE_CLEARANCE - ey;
  const midX = (ex + target[0]!) * 0.5;
  const midY = (ey + target[1]!) * 0.5;
  const midZ = (ez + target[2]!) * 0.5;
  const needMid = heightAt(heights, midX, midZ) + EYE_CLEARANCE - midY;
  const desired = Math.max(0, needEye, needMid);

  if (desired > camera.eyeLift) {
    // Rise fast but eased - an instant jump reads as a camera glitch when peaks
    // sweep under the view ray during a pan. The clearance budget (2.5) absorbs
    // the brief lag; the hard floor below is the actual never-clip guarantee.
    camera.eyeLift += (desired - camera.eyeLift) * (1 - Math.exp(-dtMs / LIFT_RISE_TAU_MS));

    // Hard floor: if the eye is about to enter actual rock (not just the comfort
    // clearance), snap the remaining distance instantly.
    const hardFloor = eyeGroundY + HARD_FLOOR_CLEARANCE - ey;

    if (camera.eyeLift < hardFloor) {
      camera.eyeLift = hardFloor;
    }

    return;
  }

  camera.eyeLift += (desired - camera.eyeLift) * (1 - Math.exp(-dtMs / LIFT_FALL_TAU_MS));

  if (Math.abs(desired - camera.eyeLift) < 1e-3) {
    camera.eyeLift = desired;
  }
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
