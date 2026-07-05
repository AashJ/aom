// CPU picking per ARCHITECTURE.md M1. GPU id-buffer picking is the known upgrade path.
import {
  clearSelection,
  heightAt,
  setSelected,
  SIM_MAP_SIZE,
  unitIdAt,
  type RenderSnapshot,
  type World,
} from "@aom/sim";
import { screenRay, screenToGround, type Camera } from "../camera/camera";
import * as vec3 from "../math/vec3";
import { raycastHeightfield } from "../terrain/raycast";
import type { InputState } from "../input/input";
import type { CommandSink } from "../net/sink";

// Approximates the billboard sprite (2.2 tall, ~1.2 wide) as an upright box.
const HALF_W = 0.5;
const UNIT_H = 2.2;

const rayOrigin = vec3.create();
const rayDir = vec3.create();
const commandTarget = vec3.create();

export function pickUnit(
  camera: Camera,
  ndcX: number,
  ndcY: number,
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  alpha: number,
  heights: Float32Array,
): number {
  screenRay(camera, ndcX, ndcY, rayOrigin, rayDir);

  const ox = rayOrigin[0]!;
  const oy = rayOrigin[1]!;
  const oz = rayOrigin[2]!;
  const dx = rayDir[0]!;
  const dy = rayDir[1]!;
  const dz = rayDir[2]!;
  let bestT = Number.POSITIVE_INFINITY;
  let best = -1;

  for (let i = 0; i < curr.count; i += 1) {
    // Swap-remove reorders dense slots when units die. Interpolating across an
    // identity change would smear one unit's position toward another's; snap instead,
    // one imperceptible frame.
    const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
    const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
    const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
    const x = prevX + (curr.posX[i]! - prevX) * alpha;
    const z = prevZ + (curr.posZ[i]! - prevZ) * alpha;
    const y = heightAt(heights, x, z);
    const minX = x - HALF_W;
    const maxX = x + HALF_W;
    const minY = y;
    const maxY = y + UNIT_H;
    const minZ = z - HALF_W;
    const maxZ = z + HALF_W;
    // IEEE +/-Infinity from 1/0 makes parallel slab tests work without branches.
    const invX = 1 / dx;
    const invY = 1 / dy;
    const invZ = 1 / dz;
    const tx1 = (minX - ox) * invX;
    const tx2 = (maxX - ox) * invX;
    const ty1 = (minY - oy) * invY;
    const ty2 = (maxY - oy) * invY;
    const tz1 = (minZ - oz) * invZ;
    const tz2 = (maxZ - oz) * invZ;
    const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));

    if (tmax < tmin || tmin < 0 || tmin >= bestT) {
      continue;
    }

    // Nearest unit wins; index order would be wrong when units overlap on screen.
    bestT = tmin;
    best = i;
  }

  return best;
}

export function consumeSelectionInput(
  input: InputState,
  world: World,
  camera: Camera,
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  alpha: number,
  heights: Float32Array,
  canvas: HTMLCanvasElement,
): void {
  if (input.marqueePending) {
    input.marqueePending = false;
    marqueeSelect(
      world,
      camera,
      input.marqueeMinX,
      input.marqueeMinY,
      input.marqueeMaxX,
      input.marqueeMaxY,
      prev,
      curr,
      alpha,
      heights,
      canvas,
    );
    return;
  }

  if (!input.clickPending) {
    return;
  }

  input.clickPending = false;

  const ndcX = (input.clickX / canvas.clientWidth) * 2 - 1;
  const ndcY = 1 - (input.clickY / canvas.clientHeight) * 2;
  const hit = pickUnit(camera, ndcX, ndcY, prev, curr, alpha, heights);

  clearSelection(world);

  if (hit >= 0) {
    // Plain click replaces the selection; additive shift-click arrives with real gameplay.
    // The tint appears after the next snapshot write, at most 50 ms later.
    setSelected(world, hit, true);
  }
}

// World stays here for reading selection only. After this chunk, nothing in the engine writes
// gameplay state except through a sink — the M4 invariant.
export function consumeCommandInput(
  input: InputState,
  world: World,
  sink: CommandSink,
  camera: Camera,
  heights: Float32Array,
  canvas: HTMLCanvasElement,
  markerOut: Float32Array,
): boolean {
  if (input.stopPending) {
    input.stopPending = false;
    const unitIds: number[] = [];

    // Allocation is fine at keypress rate; commands are serializable-by-construction plain data.
    for (let i = 0; i < world.count; i += 1) {
      if (world.selected[i] === 1) {
        // Commands carry packed ids from here on.
        unitIds.push(unitIdAt(world, i));
      }
    }

    if (unitIds.length > 0) {
      sink.submitStop(unitIds);
    }
  }

  if (!input.commandPending) {
    return false;
  }

  input.commandPending = false;

  const ndcX = (input.commandX / canvas.clientWidth) * 2 - 1;
  const ndcY = 1 - (input.commandY / canvas.clientHeight) * 2;

  screenRay(camera, ndcX, ndcY, rayOrigin, rayDir);

  if (!raycastHeightfield(heights, rayOrigin, rayDir, commandTarget)) {
    // Off-map clicks still order a move to the map edge - generous, AoM-like.
    if (!screenToGround(camera, ndcX, ndcY, commandTarget)) {
      return false;
    }
  }

  // The sim trusts engine-clamped targets — its movement loop has no bounds check
  // by design.
  const targetX = Math.min(SIM_MAP_SIZE, Math.max(0, commandTarget[0]!));
  const targetZ = Math.min(SIM_MAP_SIZE, Math.max(0, commandTarget[2]!));
  const unitIds: number[] = [];

  // Allocation is fine at click rate; commands are serializable-by-construction plain data.
  for (let i = 0; i < world.count; i += 1) {
    if (world.selected[i] === 1) {
      // Commands carry packed ids from here on.
      unitIds.push(unitIdAt(world, i));
    }
  }

  if (unitIds.length === 0) {
    return false;
  }

  // The marker is the immediate order acknowledgement that absorbs the input delay.
  sink.submitMove(unitIds, targetX, targetZ);
  markerOut[0] = targetX;
  markerOut[1] = targetZ;
  return true;
}

export function marqueeSelect(
  world: World,
  camera: Camera,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  alpha: number,
  heights: Float32Array,
  canvas: HTMLCanvasElement,
): void {
  clearSelection(world);

  const m = camera.viewProj;
  const clientWidth = canvas.clientWidth;
  const clientHeight = canvas.clientHeight;

  for (let i = 0; i < curr.count; i += 1) {
    const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
    const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
    const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
    const x = prevX + (curr.posX[i]! - prevX) * alpha;
    const z = prevZ + (curr.posZ[i]! - prevZ) * alpha;
    const y = heightAt(heights, x, z) + UNIT_H * 0.5;
    const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    const cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    const cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;

    if (cw <= 0) {
      // Behind the near plane; projecting through w <= 0 mirrors coordinates and would
      // select units behind the camera.
      continue;
    }

    const ndcX = cx / cw;
    const ndcY = cy / cw;
    const px = (ndcX * 0.5 + 0.5) * clientWidth;
    const py = (0.5 - ndcY * 0.5) * clientHeight;

    if (minX <= px && px <= maxX && minY <= py && py <= maxY) {
      setSelected(world, i, true);
    }
  }
}
