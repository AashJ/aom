import { pan, screenToGround, updateMatrices, zoom, type Camera } from "../camera/camera";
import * as vec3 from "../math/vec3";
import type { InputState } from "./input";

const EDGE_MARGIN_PX = 24;
const PAN_UNITS_PER_SEC = 1.2;
const ZOOM_RATE = 0.0015;
const MAX_DT_S = 0.1;

const scratchA = vec3.create();
const scratchB = vec3.create();
const savedTarget = vec3.create();
let savedDistance = 0;

export function applyInput(
  input: InputState,
  camera: Camera,
  dtSeconds: number,
  canvas: HTMLCanvasElement,
): void {
  const dt = Math.min(dtSeconds, MAX_DT_S);
  const clientWidth = canvas.clientWidth;
  const clientHeight = canvas.clientHeight;
  let panX = input.keyPanX;
  let panY = input.keyPanY;

  if (input.pointerInside && !input.dragging) {
    if (input.pointerX < EDGE_MARGIN_PX) {
      panX -= 1;
    } else if (input.pointerX > clientWidth - EDGE_MARGIN_PX) {
      panX += 1;
    }

    if (input.pointerY < EDGE_MARGIN_PX) {
      panY += 1;
    } else if (input.pointerY > clientHeight - EDGE_MARGIN_PX) {
      panY -= 1;
    }
  }

  panX = Math.max(-1, Math.min(1, panX));
  panY = Math.max(-1, Math.min(1, panY));

  if (panX !== 0 || panY !== 0) {
    const units = camera.distance * PAN_UNITS_PER_SEC * dt;
    pan(camera, panX * units, panY * units);
  }

  if (input.dragging) {
    // Grab-pan uses the previous frame's matrices; one frame of staleness is imperceptible.
    const ndcX = (input.pointerX / clientWidth) * 2 - 1;
    // Screen y grows down, while NDC y grows up.
    const ndcY = 1 - (input.pointerY / clientHeight) * 2;

    if (screenToGround(camera, ndcX, ndcY, scratchA)) {
      if (!input.hasDragAnchor) {
        input.dragAnchorX = scratchA[0]!;
        input.dragAnchorZ = scratchA[2]!;
        input.hasDragAnchor = true;
      } else {
        camera.goalTarget[0] = camera.goalTarget[0]! + input.dragAnchorX - scratchA[0]!;
        camera.goalTarget[2] = camera.goalTarget[2]! + input.dragAnchorZ - scratchA[2]!;
        // A zero pan reuses the camera bounds clamp without moving in view axes.
        pan(camera, 0, 0);
        // Drag bypasses smoothing because hand motion is already smooth; lag reads as rubber-banding.
        vec3.copy(camera.target, camera.goalTarget);
      }
    }
  }

  if (input.wheelDelta !== 0) {
    const ndcX = input.pointerInside ? (input.pointerX / clientWidth) * 2 - 1 : 0;
    // Screen y grows down, while NDC y grows up.
    const ndcY = input.pointerInside ? 1 - (input.pointerY / clientHeight) * 2 : 0;
    savedDistance = camera.distance;
    vec3.copy(savedTarget, camera.target);

    // Anchor against the goal camera so the cursor point is exact when the glide settles.
    // During the ~100ms glide the point drifts slightly, then lands exactly; anchoring
    // against displayed state would leave permanent error.
    camera.distance = camera.goalDistance;
    vec3.copy(camera.target, camera.goalTarget);
    updateMatrices(camera, clientWidth / clientHeight);
    const before = screenToGround(camera, ndcX, ndcY, scratchA);

    zoom(camera, Math.exp(input.wheelDelta * ZOOM_RATE));
    camera.distance = camera.goalDistance;
    // Matrices must reflect the new goal distance before intersecting the cursor ray again.
    updateMatrices(camera, clientWidth / clientHeight);

    if (before && screenToGround(camera, ndcX, ndcY, scratchB)) {
      camera.goalTarget[0] = camera.goalTarget[0]! + scratchA[0]! - scratchB[0]!;
      camera.goalTarget[2] = camera.goalTarget[2]! + scratchA[2]! - scratchB[2]!;
      // A zero pan reuses the camera bounds clamp without moving in view axes.
      pan(camera, 0, 0);
    }

    camera.distance = savedDistance;
    // Matrices are left goal-flavored here; game.ts recomputes them after applyInput each frame.
    vec3.copy(camera.target, savedTarget);
    input.wheelDelta = 0;
  }
}
