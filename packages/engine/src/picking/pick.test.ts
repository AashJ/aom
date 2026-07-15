import { describe, expect, test } from "bun:test";
import {
  AGE_ARCHAIC,
  AGE_COUNT,
  CLASSICAL_AGE_ADVANCE_TICKS,
  createSnapshot,
  createWorld,
  GOD_RA,
  GOD_ZEUS,
  MAP_TILES,
  NO_GOD,
  NO_AGE,
  NO_TARGET,
  registerPlayer,
  RESOURCE_COUNT,
  setSelected,
  spawnBuilding,
  spawnUnit,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TEMPLE,
  TYPE_TOWN_CENTER,
  TYPE_VILLAGER,
  UNIT_TYPES,
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
    submitPray: (_ids, targetId) => {
      calls.push("pray");
      targetIds.push(targetId);
    },
    submitBuild: (_ids, targetId) => {
      calls.push("build");
      targetIds.push(targetId);
    },
    submitPlace: () => calls.push("place"),
    submitTrain: () => calls.push("train"),
    submitAdvanceAge: () => calls.push("advance-age"),
    submitCheat: () => calls.push("cheat"),
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
    facingX: new Float32Array(xs.length),
    facingZ: new Float32Array(xs.length),
    moving: new Uint8Array(xs.length),
    mode: new Uint8Array(xs.length),
    gatherTargetType: new Uint8Array(xs.length).fill(255),
    actionCooldown: new Uint16Array(xs.length),
    visible: new Uint8Array(xs.length).fill(1),
    fog: new Uint8Array(MAP_TILES * MAP_TILES),
    selected: new Uint8Array(xs.length),
    owner: new Uint8Array(xs.length),
    hp: new Uint16Array(xs.length),
    unitType: new Uint8Array(xs.length),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    age: AGE_ARCHAIC,
    majorGod: NO_GOD,
    playerMajorGods: new Uint8Array(256).fill(NO_GOD),
    minorGods: new Uint8Array(AGE_COUNT).fill(NO_GOD),
    ageAdvanceTarget: NO_AGE,
    ageAdvanceGod: NO_GOD,
    ageAdvanceRemaining: 0,
    ageAdvanceTotal: CLASSICAL_AGE_ADVANCE_TICKS,
    ageAdvanceBuilding: NO_TARGET,
    favorRateMilliPerMinute: 0,
    completedBuildings: new Uint8Array(UNIT_TYPES.length),
    carried: new Uint16Array(xs.length),
    buildProgress: new Uint16Array(xs.length),
    trainType: new Uint8Array(xs.length),
    trainRemaining: new Uint16Array(xs.length),
    trainQueueLength: new Uint8Array(xs.length),
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

  test("ignores an entity hidden by the viewer snapshot", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const snap = snapshot([camera.target[0]!], [camera.target[2]!]);

    snap.visible[0] = 0;
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

  test("picks a town center across its visible building bounds", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const x = camera.target[0]!;
    const z = camera.target[2]!;
    const snap = snapshot([x], [z]);

    snap.unitType[0] = TYPE_TOWN_CENTER;
    updateMatrices(camera, 16 / 9);

    // Aim high on the building facade, well outside the old universal 2.2-high pick box.
    const y = 4;
    const m = camera.viewProj;
    const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    const cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    const cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;

    expect(pickUnit(camera, cx / cw, cy / cw, snap, snap, 0, heights)).toBe(0);
  });

  test("marquee selects all units in the viewport", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    registerPlayer(world, 0);
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
    registerPlayer(world, 0);
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

  test("right-click on a completed own Temple routes Villagers to Pray", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    registerPlayer(world, 0);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);
    const canvas = { clientWidth: 1600, clientHeight: 900 } as HTMLCanvasElement;
    const sink = recordingSink();

    world.walkable.fill(1);
    const temple = spawnBuilding(
      world,
      Math.round(camera.target[0]!) - 2,
      Math.round(camera.target[2]!) - 2,
      0,
      TYPE_TEMPLE,
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

    expect(issued).toBe(1);
    expect(sink.calls).toEqual(["pray"]);
    expect(sink.targetIds).toEqual([temple]);
  });

  test.each([
    ["an Egyptian Villager", GOD_RA, TYPE_VILLAGER],
    ["a Greek non-Villager", GOD_ZEUS, TYPE_MILITIA],
  ])("right-click on a completed own Temple with %s falls through to Move", (_, god, type) => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    registerPlayer(world, 0, god);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);
    const canvas = { clientWidth: 1600, clientHeight: 900 } as HTMLCanvasElement;
    const sink = recordingSink();

    world.walkable.fill(1);
    spawnBuilding(
      world,
      Math.round(camera.target[0]!) - 2,
      Math.round(camera.target[2]!) - 2,
      0,
      TYPE_TEMPLE,
      true,
    );
    spawnUnit(world, camera.target[0]! - 20, camera.target[2]!, 0, 0, 0, type);
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

    expect(issued).toBe(1);
    expect(sink.calls).toEqual(["move"]);
    expect(sink.targetIds).toEqual([]);
  });

  test("right-click on an own COMPLETE building falls through to Move", () => {
    const camera = createCamera();
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
    const world = createWorld(42);
    registerPlayer(world, 0);
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
    registerPlayer(world, 0);
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
