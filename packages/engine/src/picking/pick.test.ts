import { describe, expect, test } from "bun:test";
import {
  createSnapshot,
  createWorld,
  setSelected,
  spawnUnit,
  VERTS_PER_ROW,
  type RenderSnapshot,
  writeSnapshot,
} from "@aom/sim";
import { createCamera, updateMatrices } from "../camera/camera";
import { marqueeSelect, pickUnit } from "./pick";

function snapshot(xs: number[], zs: number[]): RenderSnapshot {
  return {
    tick: 0,
    count: xs.length,
    // Generation-0 packed ids equal their indices.
    ids: Uint32Array.from(xs.map((_, i) => i)),
    posX: new Float32Array(xs),
    posZ: new Float32Array(zs),
    selected: new Uint8Array(xs.length),
  };
}

describe("pickUnit", () => {
  test("picks a unit under the screen center", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const snap = snapshot([camera.target[0]!], [camera.target[2]!]);

    updateMatrices(camera, 16 / 9);

    expect(pickUnit(camera, 0, 0, snap, snap, 0, heights)).toBe(0);
  });

  test("returns -1 for an empty snapshot", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const snap = snapshot([], []);

    updateMatrices(camera, 16 / 9);

    expect(pickUnit(camera, 0, 0, snap, snap, 0, heights)).toBe(-1);
  });

  test("picks the nearer unit when screen positions overlap", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const vx = camera.viewDir[0]!;
    const vz = camera.viewDir[2]!;
    const len = Math.sqrt(vx * vx + vz * vz);
    const hx = vx / len;
    const hz = vz / len;
    const x = camera.target[0]!;
    const z = camera.target[2]!;
    const snap = snapshot([x - hx * 0.2, x - hx * 0.4], [z - hz * 0.2, z - hz * 0.4]);

    updateMatrices(camera, 16 / 9);

    expect(pickUnit(camera, 0, 0, snap, snap, 0, heights)).toBe(1);
  });

  test("marquee selects all units in the viewport", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);
    const canvas = { clientWidth: 1600, clientHeight: 900 } as HTMLCanvasElement;

    spawnUnit(world, camera.target[0]!, camera.target[2]!, 0, 0);
    spawnUnit(world, camera.target[0]! + 4, camera.target[2]! + 4, 0, 0);
    spawnUnit(world, camera.target[0]! - 4, camera.target[2]! - 4, 0, 0);
    writeSnapshot(world, prev);
    writeSnapshot(world, curr);
    updateMatrices(camera, 16 / 9);

    marqueeSelect(
      world,
      camera,
      0,
      0,
      canvas.clientWidth,
      canvas.clientHeight,
      prev,
      curr,
      0,
      heights,
      canvas,
    );

    expect(world.selected[0]).toBe(1);
    expect(world.selected[1]).toBe(1);
    expect(world.selected[2]).toBe(1);
  });

  test("marquee replaces selection when it hits nothing", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);
    const canvas = { clientWidth: 1600, clientHeight: 900 } as HTMLCanvasElement;

    spawnUnit(world, camera.target[0]!, camera.target[2]!, 0, 0);
    spawnUnit(world, camera.target[0]! + 4, camera.target[2]! + 4, 0, 0);
    setSelected(world, 0, true);
    setSelected(world, 1, true);
    writeSnapshot(world, prev);
    writeSnapshot(world, curr);
    updateMatrices(camera, 16 / 9);

    marqueeSelect(world, camera, 0, 0, 10, 10, prev, curr, 0, heights, canvas);

    expect(world.selected[0]).toBe(0);
    expect(world.selected[1]).toBe(0);
  });
});
