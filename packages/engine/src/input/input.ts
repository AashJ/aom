import {
  isInsideMinimapDiamond,
  minimapRectPx,
  minimapUnitFromPixel,
  minimapUnitToWorld,
} from "../render/minimap";

// Pure geometry only - no GPU coupling.
const minimapRectScratch = new Float32Array(4);
const minimapPairScratch = new Float32Array(2);

export interface InputState {
  keyPanX: number;
  keyPanY: number;
  pointerX: number;
  pointerY: number;
  pointerInside: boolean;
  dragging: boolean;
  minimapDragging: boolean;
  minimapJumpPending: boolean;
  minimapJumpX: number;
  minimapJumpZ: number;
  wheelDelta: number;
  dragAnchorX: number;
  dragAnchorZ: number;
  hasDragAnchor: boolean;
  clickPending: boolean;
  clickX: number;
  clickY: number;
  commandPending: boolean;
  commandX: number;
  commandY: number;
  marqueePending: boolean;
  marqueeMinX: number;
  marqueeMinY: number;
  marqueeMaxX: number;
  marqueeMaxY: number;
  pointerOverMinimap: boolean;
}

export function attachInput(canvas: HTMLCanvasElement): { state: InputState; detach(): void } {
  const controller = new AbortController();
  const { signal } = controller;
  const state: InputState = {
    keyPanX: 0,
    keyPanY: 0,
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
    marqueePending: false,
    marqueeMinX: 0,
    marqueeMinY: 0,
    marqueeMaxX: 0,
    marqueeMaxY: 0,
    pointerOverMinimap: false,
  };
  let w = false;
  let s = false;
  let a = false;
  let d = false;
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let leftDown = false;
  let leftDownX = 0;
  let leftDownY = 0;
  let rightDown = false;
  let rightDownX = 0;
  let rightDownY = 0;
  let marqueeActive = false;
  const marquee = document.createElement("div");

  marquee.style.position = "absolute";
  marquee.style.border = "1px solid rgba(120, 180, 255, 0.9)";
  marquee.style.background = "rgba(120, 180, 255, 0.15)";
  marquee.style.pointerEvents = "none";
  marquee.style.display = "none";
  // The React wrapper ignores imperative children it did not render; the wrapper is
  // position:relative, so absolute coordinates are canvas-relative.
  (canvas.parentElement ?? document.body).appendChild(marquee);

  function recomputeKeyPan(): void {
    state.keyPanX = (d || right ? 1 : 0) - (a || left ? 1 : 0);
    state.keyPanY = (w || up ? 1 : 0) - (s || down ? 1 : 0);
  }

  function setKey(code: string, pressed: boolean): boolean {
    switch (code) {
      case "KeyW":
        w = pressed;
        break;
      case "KeyS":
        s = pressed;
        break;
      case "KeyA":
        a = pressed;
        break;
      case "KeyD":
        d = pressed;
        break;
      case "ArrowUp":
        up = pressed;
        break;
      case "ArrowDown":
        down = pressed;
        break;
      case "ArrowLeft":
        left = pressed;
        break;
      case "ArrowRight":
        right = pressed;
        break;
      default:
        return false;
    }

    return true;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat || !setKey(event.code, true)) {
      return;
    }

    recomputeKeyPan();
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (event.repeat || !setKey(event.code, false)) {
      return;
    }

    recomputeKeyPan();
  }

  function updatePointerOverMinimap(x: number, y: number): void {
    minimapRectPx(canvas.clientWidth, canvas.clientHeight, minimapRectScratch);
    minimapUnitFromPixel(x, y, minimapRectScratch, minimapPairScratch, 0);
    state.pointerOverMinimap = isInsideMinimapDiamond(
      minimapPairScratch[0]!,
      minimapPairScratch[1]!,
    );
  }

  window.addEventListener("keydown", handleKeyDown, { signal });
  window.addEventListener("keyup", handleKeyUp, { signal });
  canvas.addEventListener(
    "pointermove",
    (event) => {
      state.pointerX = event.offsetX;
      state.pointerY = event.offsetY;
      state.pointerInside = true;
      updatePointerOverMinimap(event.offsetX, event.offsetY);

      if (rightDown && !state.dragging) {
        const dx = event.offsetX - rightDownX;
        const dy = event.offsetY - rightDownY;

        // A right press is ambiguous until it moves — under 4 px it's a command click,
        // over it's the M1 grab-pan.
        if (Math.abs(dx) + Math.abs(dy) >= 4) {
          state.dragging = true;
        }
      }

      if (state.minimapDragging) {
        minimapRectPx(canvas.clientWidth, canvas.clientHeight, minimapRectScratch);
        minimapUnitFromPixel(
          event.offsetX,
          event.offsetY,
          minimapRectScratch,
          minimapPairScratch,
          0,
        );
        minimapUnitToWorld(minimapPairScratch[0]!, minimapPairScratch[1]!, minimapPairScratch, 0);
        state.minimapJumpX = minimapPairScratch[0]!;
        state.minimapJumpZ = minimapPairScratch[1]!;
        state.minimapJumpPending = true;
        return;
      }

      if (leftDown) {
        const dx = event.offsetX - leftDownX;
        const dy = event.offsetY - leftDownY;

        if (!marqueeActive && Math.abs(dx) + Math.abs(dy) >= 4) {
          marqueeActive = true;
          marquee.style.display = "block";
        }

        if (marqueeActive) {
          const minX = Math.min(leftDownX, event.offsetX);
          const minY = Math.min(leftDownY, event.offsetY);
          const maxX = Math.max(leftDownX, event.offsetX);
          const maxY = Math.max(leftDownY, event.offsetY);

          marquee.style.left = `${minX}px`;
          marquee.style.top = `${minY}px`;
          marquee.style.width = `${maxX - minX}px`;
          marquee.style.height = `${maxY - minY}px`;
        }
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerleave",
    () => {
      state.pointerInside = false;
      state.pointerOverMinimap = false;
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      state.pointerX = event.offsetX;
      state.pointerY = event.offsetY;
      state.pointerInside = true;
      updatePointerOverMinimap(event.offsetX, event.offsetY);

      if (event.button === 0) {
        if (state.pointerOverMinimap) {
          state.minimapDragging = true;
          canvas.setPointerCapture(event.pointerId);
          minimapUnitToWorld(minimapPairScratch[0]!, minimapPairScratch[1]!, minimapPairScratch, 0);
          state.minimapJumpX = minimapPairScratch[0]!;
          state.minimapJumpZ = minimapPairScratch[1]!;
          state.minimapJumpPending = true;
          event.preventDefault();
          return;
        }

        leftDown = true;
        leftDownX = event.offsetX;
        leftDownY = event.offsetY;
        canvas.setPointerCapture(event.pointerId);
        return;
      }

      if (event.button === 1) {
        state.dragging = true;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      if (event.button === 2) {
        rightDown = true;
        rightDownX = event.offsetX;
        rightDownY = event.offsetY;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (event.button === 0) {
        if (state.minimapDragging) {
          state.minimapDragging = false;
          return;
        }

        const dx = event.offsetX - leftDownX;
        const dy = event.offsetY - leftDownY;

        if (marqueeActive) {
          state.marqueeMinX = Math.min(leftDownX, event.offsetX);
          state.marqueeMinY = Math.min(leftDownY, event.offsetY);
          state.marqueeMaxX = Math.max(leftDownX, event.offsetX);
          state.marqueeMaxY = Math.max(leftDownY, event.offsetY);
          state.marqueePending = true;
          marqueeActive = false;
          marquee.style.display = "none";
        } else if (leftDown && Math.sqrt(dx * dx + dy * dy) < 4) {
          state.clickX = event.offsetX;
          state.clickY = event.offsetY;
          state.clickPending = true;
        }

        leftDown = false;
        return;
      }

      if (event.button === 2) {
        if (rightDown && !state.dragging) {
          state.commandPending = true;
          state.commandX = event.offsetX;
          state.commandY = event.offsetY;
        }

        rightDown = false;
        state.dragging = false;
        state.hasDragAnchor = false;
        return;
      }

      if (event.button === 1) {
        // Left release no longer kills an active middle/right drag.
        state.dragging = false;
        state.hasDragAnchor = false;
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      state.minimapDragging = false;
      leftDown = false;
      rightDown = false;
      marqueeActive = false;
      marquee.style.display = "none";
      state.dragging = false;
      state.hasDragAnchor = false;
      state.pointerOverMinimap = false;
    },
    { signal },
  );
  canvas.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    { signal },
  );
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.wheelDelta += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    },
    { passive: false, signal },
  );

  return {
    state,
    detach(): void {
      controller.abort();
      marquee.remove();
    },
  };
}
