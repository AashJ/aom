import { expect, test } from "bun:test";
import { createCamera } from "../camera/camera";
import { applyInput } from "./apply";
import type { InputState } from "./input";
import type { Vec3 } from "../math/vec3";

function createInput(overrides: Partial<InputState> = {}): InputState {
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
    commandPending: false,
    commandX: 0,
    commandY: 0,
    stopPending: false,
    marqueePending: false,
    marqueeMinX: 0,
    marqueeMinY: 0,
    marqueeMaxX: 0,
    marqueeMaxY: 0,
    pointerOverMinimap: false,
    ...overrides,
  };
}

function createCanvas(width = 1600, height = 900): HTMLCanvasElement {
  return {
    clientWidth: width,
    clientHeight: height,
  } as HTMLCanvasElement;
}

test("key pan moves goalTarget but leaves displayed target for smoothing", () => {
  const cam = createCamera();
  const input = createInput({ keyPanY: 1 });
  const canvas = createCanvas();

  const startX = cam.goalTarget[0]!;
  const startZ = cam.goalTarget[2]!;
  const displayedX = cam.target[0]!;
  const displayedZ = cam.target[2]!;

  console.log({ startX, startZ, displayedX, displayedZ });

  // after 1 the goal target should not be close to the startX,Z and should now
  // be a lot clsoer to the displayedX, Z
  applyInput(input, cam, 1 / 60, canvas);

  const newStartX = cam.goalTarget[0]!;
  const newStartZ = cam.goalTarget[2]!;
  const newDisplayedX = cam.target[0]!;
  const newDisplayedZ = cam.target[2]!;

  console.log({ newStartX, newStartZ, newDisplayedX, newDisplayedZ });

  expect(newStartX).not.toBeCloseTo(startX, 5);
  expect(newStartZ).not.toBeCloseTo(startZ, 5);
  expect(newDisplayedX).toBeCloseTo(displayedX, 5);
  expect(newDisplayedZ).toBeCloseTo(displayedZ, 5);
});

test("being on X left edge moves goalTarget but leaves displayed target for smoothing", () => {
  const cam = createCamera();
  // inside, and on the top boundary
  const input = createInput({ pointerInside: true, pointerX: 1, pointerY: 450 });
  const canvas = createCanvas();

  const startX = cam.goalTarget[0]!;
  const startZ = cam.goalTarget[2]!;
  const displayedX = cam.target[0]!;
  const displayedZ = cam.target[2]!;

  console.log({ startX, startZ, displayedX, displayedZ });

  // after 1 the goal target should not be close to the startX,Z and should now
  // be a lot clsoer to the displayedX, Z
  applyInput(input, cam, 1 / 60, canvas);

  const newStartX = cam.goalTarget[0]!;
  const newStartZ = cam.goalTarget[2]!;
  const newDisplayedX = cam.target[0]!;
  const newDisplayedZ = cam.target[2]!;

  console.log({ newStartX, newStartZ, newDisplayedX, newDisplayedZ });

  expect(newStartX).not.toBeCloseTo(startX, 5);
  expect(newStartZ).not.toBeCloseTo(startZ, 5);
  expect(newDisplayedX).toBeCloseTo(displayedX, 5);
  expect(newDisplayedZ).toBeCloseTo(displayedZ, 5);
});

test("being on X right edge moves goalTarget but leaves displayed target for smoothing", () => {
  const cam = createCamera();
  // inside, and on the top boundary
  const input = createInput({ pointerInside: true, pointerX: 1600, pointerY: 450 });
  const canvas = createCanvas();

  const startX = cam.goalTarget[0]!;
  const startZ = cam.goalTarget[2]!;
  const displayedX = cam.target[0]!;
  const displayedZ = cam.target[2]!;

  console.log({ startX, startZ, displayedX, displayedZ });

  // after 1 the goal target should not be close to the startX,Z and should now
  // be a lot clsoer to the displayedX, Z
  applyInput(input, cam, 1 / 60, canvas);

  const newStartX = cam.goalTarget[0]!;
  const newStartZ = cam.goalTarget[2]!;
  const newDisplayedX = cam.target[0]!;
  const newDisplayedZ = cam.target[2]!;

  console.log({ newStartX, newStartZ, newDisplayedX, newDisplayedZ });

  expect(newStartX).not.toBeCloseTo(startX, 5);
  expect(newStartZ).not.toBeCloseTo(startZ, 5);
  expect(newDisplayedX).toBeCloseTo(displayedX, 5);
  expect(newDisplayedZ).toBeCloseTo(displayedZ, 5);
});

test("being on Y top edge moves goalTarget but leaves displayed target for smoothing", () => {
  const cam = createCamera();
  // inside, and on the top boundary
  const input = createInput({ pointerInside: true, pointerX: 800, pointerY: 0 });
  const canvas = createCanvas();

  const startX = cam.goalTarget[0]!;
  const startZ = cam.goalTarget[2]!;
  const displayedX = cam.target[0]!;
  const displayedZ = cam.target[2]!;

  console.log({ startX, startZ, displayedX, displayedZ });

  // after 1 the goal target should not be close to the startX,Z and should now
  // be a lot clsoer to the displayedX, Z
  applyInput(input, cam, 1 / 60, canvas);

  const newStartX = cam.goalTarget[0]!;
  const newStartZ = cam.goalTarget[2]!;
  const newDisplayedX = cam.target[0]!;
  const newDisplayedZ = cam.target[2]!;

  console.log({ newStartX, newStartZ, newDisplayedX, newDisplayedZ });

  expect(newStartX).not.toBeCloseTo(startX, 5);
  expect(newStartZ).not.toBeCloseTo(startZ, 5);
  expect(newDisplayedX).toBeCloseTo(displayedX, 5);
  expect(newDisplayedZ).toBeCloseTo(displayedZ, 5);
});

test("being on Y bottom edge moves goalTarget but leaves displayed target for smoothing", () => {
  const cam = createCamera();
  // inside, and on the top boundary
  const input = createInput({ pointerInside: true, pointerX: 800, pointerY: 900 });
  const canvas = createCanvas();

  const startX = cam.goalTarget[0]!;
  const startZ = cam.goalTarget[2]!;
  const displayedX = cam.target[0]!;
  const displayedZ = cam.target[2]!;

  console.log({ startX, startZ, displayedX, displayedZ });

  // after 1 the goal target should not be close to the startX,Z and should now
  // be a lot clsoer to the displayedX, Z
  applyInput(input, cam, 1 / 60, canvas);

  const newStartX = cam.goalTarget[0]!;
  const newStartZ = cam.goalTarget[2]!;
  const newDisplayedX = cam.target[0]!;
  const newDisplayedZ = cam.target[2]!;

  console.log({ newStartX, newStartZ, newDisplayedX, newDisplayedZ });

  expect(newStartX).not.toBeCloseTo(startX, 5);
  expect(newStartZ).not.toBeCloseTo(startZ, 5);
  expect(newDisplayedX).toBeCloseTo(displayedX, 5);
  expect(newDisplayedZ).toBeCloseTo(displayedZ, 5);
});

function distanceXZ(target: Vec3, startX: number, startZ: number): number {
  const dx = target[0]! - startX;
  const dz = target[2]! - startZ;
  return Math.sqrt(dx * dx + dz * dz);
}

test("edge scrolling should be graded", () => {
  const canvas = createCanvas();
  const cam1 = createCamera();
  const cam2 = createCamera();
  // super close to left edge
  const input1 = createInput({
    pointerInside: true,
    pointerX: 1,
    pointerY: 450,
  });
  // not as close to ledge edge
  const input2 = createInput({
    pointerInside: true,
    pointerX: 22,
    pointerY: 450,
  });

  const cam1StartGoalX = cam1.goalTarget[0]!;
  const cam1StartGoalZ = cam1.goalTarget[2]!;

  const cam2StartGoalX = cam2.goalTarget[0]!;
  const cam2StartGoalZ = cam2.goalTarget[2]!;

  applyInput(input1, cam1, 1 / 60, canvas);
  applyInput(input2, cam2, 1 / 60, canvas);

  // should be a positive distance here
  const cam1GoalDistanceXZ = distanceXZ(cam1.goalTarget, cam1StartGoalX, cam1StartGoalZ);
  expect(cam1GoalDistanceXZ).toBeGreaterThan(0);
  const cam2GoalDistanceXZ = distanceXZ(cam2.goalTarget, cam2StartGoalX, cam2StartGoalZ);
  expect(cam2GoalDistanceXZ).toBeGreaterThan(0);

  expect(cam1GoalDistanceXZ).toBeGreaterThan(cam2GoalDistanceXZ);
});
