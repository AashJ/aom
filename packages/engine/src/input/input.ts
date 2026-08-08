import {
  isInsideMinimapDiamond,
  minimapRectPx,
  minimapUnitFromPixel,
  minimapUnitToWorld,
} from "../render/minimap";

// Pure geometry only - no GPU coupling.
const minimapRectScratch = new Float32Array(4);
const minimapPairScratch = new Float32Array(2);
const VIRTUAL_POINTER_TARGET_SELECTOR =
  'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[role="button"]:not([aria-disabled="true"])';

export interface InputState {
  keyPanX: number;
  keyPanY: number;
  debugOverlay: boolean;
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
  commandFromMinimap: boolean;
  commandWorldX: number;
  commandWorldZ: number;
  stopPending: boolean;
  corruptPending: boolean;
  escapePending: boolean;
  rotatePlacementPending: boolean;
  primaryDragActive: boolean;
  primaryDragStartX: number;
  primaryDragStartY: number;
  primaryDragEndX: number;
  primaryDragEndY: number;
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
    commandFromMinimap: false,
    commandWorldX: 0,
    commandWorldZ: 0,
    stopPending: false,
    corruptPending: false,
    escapePending: false,
    rotatePlacementPending: false,
    primaryDragActive: false,
    primaryDragStartX: 0,
    primaryDragStartY: 0,
    primaryDragEndX: 0,
    primaryDragEndY: 0,
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
  let dragButtonMask = 0;
  let marqueeActive = false;
  let virtualPointerX = 0;
  let virtualPointerY = 0;
  let virtualPressCaptured = false;
  let virtualPressTarget: HTMLElement | null = null;
  const marquee = document.createElement("div");
  const virtualPointer =
    typeof canvas.requestPointerLock === "function" ? document.createElement("div") : null;

  marquee.style.position = "absolute";
  marquee.style.border = "1px solid rgba(120, 180, 255, 0.9)";
  marquee.style.background = "rgba(120, 180, 255, 0.15)";
  marquee.style.pointerEvents = "none";
  marquee.style.display = "none";
  // The React wrapper ignores imperative children it did not render; the wrapper is
  // position:relative, so absolute coordinates are canvas-relative.
  (canvas.parentElement ?? document.body).appendChild(marquee);

  if (virtualPointer) {
    virtualPointer.setAttribute("aria-hidden", "true");
    virtualPointer.style.position = "fixed";
    virtualPointer.style.zIndex = "2147483647";
    virtualPointer.style.width = "22px";
    virtualPointer.style.height = "29px";
    virtualPointer.style.pointerEvents = "none";
    virtualPointer.style.display = "none";
    virtualPointer.style.transform = "translate(-2px, -2px)";
    virtualPointer.style.clipPath =
      "polygon(8% 0%, 8% 80%, 34% 62%, 58% 100%, 78% 88%, 54% 53%, 92% 51%)";
    virtualPointer.style.background =
      "linear-gradient(135deg, #fff7c7 0%, #e8c868 45%, #8d5e20 100%)";
    virtualPointer.style.filter =
      "drop-shadow(-1px 0 #21160b) drop-shadow(1px 0 #21160b) drop-shadow(0 -1px #21160b) drop-shadow(0 1px #21160b) drop-shadow(1px 2px 1px rgb(0 0 0 / 70%))";
    (canvas.parentElement ?? document.body).appendChild(virtualPointer);
  }

  function recomputeKeyPan(): void {
    state.keyPanX = (d || right ? 1 : 0) - (a || left ? 1 : 0);
    state.keyPanY = (w || up ? 1 : 0) - (s || down ? 1 : 0);
  }

  function resetPointerGesture(): void {
    state.minimapDragging = false;
    leftDown = false;
    rightDown = false;
    dragButtonMask = 0;
    marqueeActive = false;
    state.primaryDragActive = false;
    marquee.style.display = "none";
    state.dragging = false;
    state.hasDragAnchor = false;
    virtualPressCaptured = false;
    virtualPressTarget = null;
  }

  function deactivatePointer(): void {
    resetPointerGesture();
    state.pointerInside = false;
    state.pointerOverMinimap = false;
  }

  function resetAllInput(): void {
    w = false;
    s = false;
    a = false;
    d = false;
    up = false;
    down = false;
    left = false;
    right = false;
    recomputeKeyPan();
    deactivatePointer();
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      resetAllInput();
    }
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
    if (
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement)
    ) {
      return;
    }

    if (event.code === "Backquote" && !event.repeat) {
      // A persistent flag read by the render loop each frame, not a consumed intent --
      // toggles are state, clicks are events.
      state.debugOverlay = !state.debugOverlay;
      return;
    }

    if (event.code === "KeyH" && !event.repeat) {
      // H = halt; S is taken by WASD pan. A consumed intent, unlike the debugOverlay toggle.
      state.stopPending = true;
      return;
    }

    if (event.code === "Escape" && !event.repeat) {
      state.escapePending = true;
      return;
    }

    if (event.code === "KeyR" && !event.repeat) {
      state.rotatePlacementPending = true;
      return;
    }

    if (event.code === "F9" && !event.repeat) {
      // Dev diagnostic — forces a desync in a networked match; see game.ts.
      state.corruptPending = true;
      return;
    }

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
    if (x < 0 || y < 0 || x >= canvas.clientWidth || y >= canvas.clientHeight) {
      state.pointerInside = false;
      state.pointerOverMinimap = false;
      return;
    }

    state.pointerInside = true;
    minimapRectPx(canvas.clientWidth, canvas.clientHeight, minimapRectScratch);
    minimapUnitFromPixel(x, y, minimapRectScratch, minimapPairScratch, 0);
    state.pointerOverMinimap = isInsideMinimapDiamond(
      minimapPairScratch[0]!,
      minimapPairScratch[1]!,
    );
  }

  function isPointerLocked(): boolean {
    return document.pointerLockElement === canvas;
  }

  function pointerCoordinates(event: MouseEvent, applyMovement: boolean): [number, number] {
    if (!isPointerLocked()) {
      return [event.offsetX, event.offsetY];
    }

    if (applyMovement) {
      virtualPointerX = Math.max(
        0,
        Math.min(canvas.clientWidth - 1, virtualPointerX + event.movementX),
      );
      virtualPointerY = Math.max(
        0,
        Math.min(canvas.clientHeight - 1, virtualPointerY + event.movementY),
      );
    }

    return [virtualPointerX, virtualPointerY];
  }

  function updateVirtualPointerTarget(x: number, y: number): Element | null {
    if (!isPointerLocked()) {
      updatePointerOverMinimap(x, y);
      return canvas;
    }

    const rect = canvas.getBoundingClientRect();
    virtualPointer?.style.setProperty("left", `${rect.left + x}px`);
    virtualPointer?.style.setProperty("top", `${rect.top + y}px`);
    const target = document.elementFromPoint(rect.left + x, rect.top + y);

    if (target === canvas) {
      updatePointerOverMinimap(x, y);
    } else {
      state.pointerInside = false;
      state.pointerOverMinimap = false;
    }

    return target;
  }

  function captureVirtualUiPress(target: Element | null, event: MouseEvent): boolean {
    if (!isPointerLocked() || target === canvas) {
      return false;
    }

    const pressTarget =
      event.button === 0 && target instanceof HTMLElement
        ? target.closest<HTMLElement>(VIRTUAL_POINTER_TARGET_SELECTOR)
        : null;
    resetPointerGesture();
    virtualPressCaptured = true;
    virtualPressTarget = pressTarget;
    event.preventDefault();
    return true;
  }

  function releaseVirtualUiPress(target: Element | null, event: MouseEvent): boolean {
    if (!isPointerLocked() || (!virtualPressCaptured && target === canvas)) {
      return false;
    }

    const pressedTarget = virtualPressTarget;
    const shouldClick =
      event.button === 0 &&
      pressedTarget !== null &&
      target instanceof Node &&
      (target === pressedTarget || pressedTarget.contains(target));
    resetPointerGesture();

    if (shouldClick) {
      pressedTarget.focus({ preventScroll: true });
      pressedTarget.click();
    }

    event.preventDefault();
    return true;
  }

  function hasPointerId(event: MouseEvent): event is PointerEvent {
    return "pointerId" in event;
  }

  function setPointerCaptureUnlessLocked(event: MouseEvent): void {
    if (!isPointerLocked() && hasPointerId(event)) {
      canvas.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: MouseEvent): void {
    const [pointerX, pointerY] = pointerCoordinates(event, true);
    state.pointerX = pointerX;
    state.pointerY = pointerY;
    const target = updateVirtualPointerTarget(pointerX, pointerY);

    if (isPointerLocked() && (virtualPressCaptured || target !== canvas)) {
      if (!virtualPressCaptured) {
        resetPointerGesture();
      }
      return;
    }

    // Browsers can lose the corresponding pointerup when focus or capture moves outside the
    // page. The physical button mask lets the next move repair any latched gesture state.
    if (
      (leftDown && (event.buttons & 1) === 0) ||
      (rightDown && (event.buttons & 2) === 0) ||
      (dragButtonMask !== 0 && (event.buttons & dragButtonMask) === 0)
    ) {
      resetPointerGesture();
    }

    if (rightDown && !state.dragging) {
      const dx = pointerX - rightDownX;
      const dy = pointerY - rightDownY;

      // A right press is ambiguous until it moves — under 4 px it's a command click,
      // over it's the M1 grab-pan.
      if (Math.abs(dx) + Math.abs(dy) >= 4) {
        state.dragging = true;
        dragButtonMask = 2;
      }
    }

    if (state.minimapDragging) {
      minimapRectPx(canvas.clientWidth, canvas.clientHeight, minimapRectScratch);
      minimapUnitFromPixel(pointerX, pointerY, minimapRectScratch, minimapPairScratch, 0);
      minimapUnitToWorld(minimapPairScratch[0]!, minimapPairScratch[1]!, minimapPairScratch, 0);
      state.minimapJumpX = minimapPairScratch[0]!;
      state.minimapJumpZ = minimapPairScratch[1]!;
      state.minimapJumpPending = true;
      return;
    }

    if (leftDown) {
      const dx = pointerX - leftDownX;
      const dy = pointerY - leftDownY;

      if (!marqueeActive && Math.abs(dx) + Math.abs(dy) >= 4) {
        marqueeActive = true;
        state.primaryDragActive = true;
        state.primaryDragStartX = leftDownX;
        state.primaryDragStartY = leftDownY;
        marquee.style.display = "block";
      }

      if (marqueeActive) {
        state.primaryDragEndX = pointerX;
        state.primaryDragEndY = pointerY;
        const minX = Math.min(leftDownX, pointerX);
        const minY = Math.min(leftDownY, pointerY);
        const maxX = Math.max(leftDownX, pointerX);
        const maxY = Math.max(leftDownY, pointerY);

        marquee.style.left = `${minX}px`;
        marquee.style.top = `${minY}px`;
        marquee.style.width = `${maxX - minX}px`;
        marquee.style.height = `${maxY - minY}px`;
      }
    }
  }

  function handlePointerDown(event: MouseEvent): void {
    const [pointerX, pointerY] = pointerCoordinates(event, false);
    state.pointerX = pointerX;
    state.pointerY = pointerY;
    const target = updateVirtualPointerTarget(pointerX, pointerY);

    if (captureVirtualUiPress(target, event)) {
      return;
    }

    if (event.button === 0) {
      if (state.pointerOverMinimap) {
        state.minimapDragging = true;
        setPointerCaptureUnlessLocked(event);
        minimapUnitToWorld(minimapPairScratch[0]!, minimapPairScratch[1]!, minimapPairScratch, 0);
        state.minimapJumpX = minimapPairScratch[0]!;
        state.minimapJumpZ = minimapPairScratch[1]!;
        state.minimapJumpPending = true;
        event.preventDefault();
        return;
      }

      leftDown = true;
      leftDownX = pointerX;
      leftDownY = pointerY;
      state.primaryDragStartX = pointerX;
      state.primaryDragStartY = pointerY;
      state.primaryDragEndX = pointerX;
      state.primaryDragEndY = pointerY;
      setPointerCaptureUnlessLocked(event);
      return;
    }

    if (event.button === 1) {
      state.dragging = true;
      dragButtonMask = 4;
      setPointerCaptureUnlessLocked(event);
      event.preventDefault();
      return;
    }

    if (event.button === 2) {
      rightDown = true;
      rightDownX = pointerX;
      rightDownY = pointerY;
      setPointerCaptureUnlessLocked(event);
      event.preventDefault();
    }
  }

  function handlePointerUp(event: MouseEvent): void {
    const [pointerX, pointerY] = pointerCoordinates(event, false);
    state.pointerX = pointerX;
    state.pointerY = pointerY;
    const target = updateVirtualPointerTarget(pointerX, pointerY);

    if (releaseVirtualUiPress(target, event)) {
      return;
    }

    if (event.button === 0) {
      if (state.minimapDragging) {
        state.minimapDragging = false;
        return;
      }

      const dx = pointerX - leftDownX;
      const dy = pointerY - leftDownY;

      if (marqueeActive) {
        state.marqueeMinX = Math.min(leftDownX, pointerX);
        state.marqueeMinY = Math.min(leftDownY, pointerY);
        state.marqueeMaxX = Math.max(leftDownX, pointerX);
        state.marqueeMaxY = Math.max(leftDownY, pointerY);
        state.primaryDragStartX = leftDownX;
        state.primaryDragStartY = leftDownY;
        state.primaryDragEndX = pointerX;
        state.primaryDragEndY = pointerY;
        state.primaryDragActive = false;
        state.marqueePending = true;
        marqueeActive = false;
        marquee.style.display = "none";
      } else if (leftDown && Math.sqrt(dx * dx + dy * dy) < 4) {
        state.clickX = pointerX;
        state.clickY = pointerY;
        state.clickPending = true;
      }

      leftDown = false;
      state.primaryDragActive = false;
      return;
    }

    if (event.button === 2) {
      updatePointerOverMinimap(pointerX, pointerY);

      if (rightDown && !state.dragging) {
        state.commandPending = true;

        if (state.pointerOverMinimap) {
          minimapUnitToWorld(minimapPairScratch[0]!, minimapPairScratch[1]!, minimapPairScratch, 0);
          state.commandFromMinimap = true;
          state.commandWorldX = minimapPairScratch[0]!;
          state.commandWorldZ = minimapPairScratch[1]!;
        } else {
          state.commandFromMinimap = false;
          state.commandX = pointerX;
          state.commandY = pointerY;
        }
      }

      rightDown = false;
      dragButtonMask = 0;
      state.dragging = false;
      state.hasDragAnchor = false;
      return;
    }

    if (event.button === 1) {
      // Left release no longer kills an active middle/right drag.
      dragButtonMask = 0;
      state.dragging = false;
      state.hasDragAnchor = false;
    }
  }

  function handlePointerLockChange(): void {
    if (!virtualPointer) {
      return;
    }

    if (isPointerLocked()) {
      virtualPointerX =
        state.pointerInside && state.pointerX >= 0 && state.pointerX < canvas.clientWidth
          ? state.pointerX
          : canvas.clientWidth / 2;
      virtualPointerY =
        state.pointerInside && state.pointerY >= 0 && state.pointerY < canvas.clientHeight
          ? state.pointerY
          : canvas.clientHeight / 2;
      state.pointerX = virtualPointerX;
      state.pointerY = virtualPointerY;
      virtualPointer.style.display = "block";
      updateVirtualPointerTarget(virtualPointerX, virtualPointerY);
      return;
    }

    virtualPointer.style.display = "none";
    deactivatePointer();
  }

  window.addEventListener("keydown", handleKeyDown, { signal });
  window.addEventListener("keyup", handleKeyUp, { signal });
  window.addEventListener("blur", resetAllInput, { signal });
  document.addEventListener("visibilitychange", handleVisibilityChange, { signal });
  document.addEventListener("pointerlockchange", handlePointerLockChange, { signal });
  handlePointerLockChange();
  // Pointer Events are not consistently delivered to the lock target across browsers. Use
  // mouse events at document scope while locked, and keep Pointer Events for normal play.
  document.addEventListener(
    "mousemove",
    (event) => {
      if (isPointerLocked()) {
        handlePointerMove(event);
      }
    },
    { signal },
  );
  document.addEventListener(
    "mousedown",
    (event) => {
      if (isPointerLocked()) {
        handlePointerDown(event);
      }
    },
    { signal },
  );
  document.addEventListener(
    "mouseup",
    (event) => {
      if (isPointerLocked()) {
        handlePointerUp(event);
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!isPointerLocked()) {
        handlePointerMove(event);
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerleave",
    (event) => {
      if (isPointerLocked()) {
        return;
      }

      state.pointerInside = false;
      state.pointerOverMinimap = false;

      if (event.buttons === 0) {
        resetPointerGesture();
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!isPointerLocked()) {
        handlePointerDown(event);
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!isPointerLocked()) {
        handlePointerUp(event);
      }
    },
    { signal },
  );
  canvas.addEventListener("pointercancel", deactivatePointer, { signal });
  canvas.addEventListener("lostpointercapture", resetPointerGesture, { signal });
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

      if (
        isPointerLocked() &&
        updateVirtualPointerTarget(virtualPointerX, virtualPointerY) !== canvas
      ) {
        return;
      }

      state.wheelDelta += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    },
    { passive: false, signal },
  );

  return {
    state,
    detach(): void {
      controller.abort();
      marquee.remove();
      virtualPointer?.remove();
    },
  };
}
