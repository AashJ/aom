import { describe, expect, test } from "bun:test";
import {
  createSnapshot,
  createWorld,
  setSelected,
  spawnBuilding,
  spawnUnit,
  TYPE_HOUSE,
  VERTS_PER_ROW,
  type RenderSnapshot,
  writeSnapshot,
} from "@aom/sim";
import { createCamera, updateMatrices } from "../camera/camera";
import type { InputState } from "../input/input";
import type { CommandSink } from "../net/sink";
import { consumeCommandInput, marqueeSelect, pickUnit } from "./pick";

function commandInput(x: number, y: number): InputState {
  return {
    keyPanX: 0,
    keyPanY: 0,
    debugOverlay: false,
    pointerX: 0,
    pointerY: 0,
    pointerInside: false,
    dragging: false,
    minimapDragging: false,
    minimapJumpPending: false,
    minimapJumpX: 0,
    minimapJumpZ: 0,
    wheelDelta: 0,
    dragAnchorX: 0,
    dragAnchorZ: 0,
    hasDragAnchor: false,
    clickPending: false,
    clickX: 0,
    clickY: 0,
    commandPending: true,
    commandX: x,
    commandY: y,
    stopPending: false,
    corruptPending: false,
    escapePending: false,
    marqueePending: false,
    marqueeMinX: 0,
    marqueeMinY: 0,
    marqueeMaxX: 0,
    marqueeMaxY: 0,
    pointerOverMinimap: false,
  };
}

// Records verbs instead of enqueueing; routing tests pin WHICH verb fired, the sim
// pins what the verb does.
function recordingSink(): CommandSink & { calls: string[]; targetIds: number[] } {
  const calls: string[] = [];
  const targetIds: number[] = [];

  return {
    calls,
    targetIds,
    submitMove: () => calls.push("move"),
    submitStop: () => calls.push("stop"),
    submitAttack: (_ids, targetId) => {
      calls.push("attack");
      targetIds.push(targetId);
    },
    submitGather: (_ids, targetId) => {
      calls.push("gather");
      targetIds.push(targetId);
    },
    submitBuild: (_ids, targetId) => {
      calls.push("build");
      targetIds.push(targetId);
    },
    submitPlace: () => calls.push("place"),
    submitTrain: () => calls.push("train"),
  };
}

function snapshot(xs: number[], zs: number[]): RenderSnapshot {
  return {
    tick: 0,
    count: xs.length,
    // Generation-0 packed ids equal their indices.
    ids: Uint32Array.from(xs.map((_, i) => i)),
    posX: new Float32Array(xs),
    posZ: new Float32Array(zs),
    selected: new Uint8Array(xs.length),
    owner: new Uint8Array(xs.length),
    hp: new Uint16Array(xs.length),
    unitType: new Uint8Array(xs.length),
    stockpiles: new Uint32Array(512),
    carried: new Uint16Array(xs.length),
    buildProgress: new Uint16Array(xs.length),
    trainType: new Uint8Array(xs.length),
    trainRemaining: new Uint16Array(xs.length),
    winner: -1,
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

  test("right-click on an own blueprint routes to Build", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);
    const canvas = { clientWidth: 1600, clientHeight: 900 } as HTMLCanvasElement;
    const sink = recordingSink();

    world.walkable.fill(1);
    // House footprint is 2: origin at target-1 centers the blueprint under the cursor.
    const site = spawnBuilding(
      world,
      Math.round(camera.target[0]!) - 1,
      Math.round(camera.target[2]!) - 1,
      0,
      TYPE_HOUSE,
      false,
    );

    spawnUnit(world, camera.target[0]! - 20, camera.target[2]!, 0, 0, 0);
    setSelected(world, 1, true);
    writeSnapshot(world, prev);
    writeSnapshot(world, curr);
    updateMatrices(camera, 16 / 9);

    const issued = consumeCommandInput(
      commandInput(800, 450),
      world,
      sink,
      0,
      camera,
      prev,
      curr,
      0,
      heights,
      canvas,
      new Float32Array(2),
    );

    expect(issued).toBe(4);
    expect(sink.calls).toEqual(["build"]);
    expect(sink.targetIds).toEqual([site]);
  });

  test("right-click on an own COMPLETE building falls through to Move", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);
    const canvas = { clientWidth: 1600, clientHeight: 900 } as HTMLCanvasElement;
    const sink = recordingSink();

    world.walkable.fill(1);
    spawnBuilding(
      world,
      Math.round(camera.target[0]!) - 1,
      Math.round(camera.target[2]!) - 1,
      0,
      TYPE_HOUSE,
      true,
    );
    spawnUnit(world, camera.target[0]! - 20, camera.target[2]!, 0, 0, 0);
    setSelected(world, 1, true);
    writeSnapshot(world, prev);
    writeSnapshot(world, curr);
    updateMatrices(camera, 16 / 9);

    const issued = consumeCommandInput(
      commandInput(800, 450),
      world,
      sink,
      0,
      camera,
      prev,
      curr,
      0,
      heights,
      canvas,
      new Float32Array(2),
    );

    // A finished building is not a Build target; the click is a plain ground order.
    expect(issued).toBe(1);
    expect(sink.calls).toEqual(["move"]);
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
