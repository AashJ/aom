export interface InputState {
  keyPanX: number;
  keyPanY: number;
  pointerX: number;
  pointerY: number;
  pointerInside: boolean;
  dragging: boolean;
  wheelDelta: number;
  dragAnchorX: number;
  dragAnchorZ: number;
  hasDragAnchor: boolean;
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
    wheelDelta: 0,
    dragAnchorX: 0,
    dragAnchorZ: 0,
    hasDragAnchor: false,
  };
  let w = false;
  let s = false;
  let a = false;
  let d = false;
  let up = false;
  let down = false;
  let left = false;
  let right = false;

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

  window.addEventListener("keydown", handleKeyDown, { signal });
  window.addEventListener("keyup", handleKeyUp, { signal });
  canvas.addEventListener(
    "pointermove",
    (event) => {
      state.pointerX = event.offsetX;
      state.pointerY = event.offsetY;
      state.pointerInside = true;
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerleave",
    () => {
      state.pointerInside = false;
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 1 && event.button !== 2) {
        return;
      }

      state.dragging = true;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerup",
    () => {
      state.dragging = false;
      state.hasDragAnchor = false;
    },
    { signal },
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      state.dragging = false;
      state.hasDragAnchor = false;
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
    },
  };
}
