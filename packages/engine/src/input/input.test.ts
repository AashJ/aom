import { afterEach, beforeEach, expect, test } from "bun:test";
import { attachInput } from "./input";

class FakeElement {
  readonly style: Record<string, string> = {};
  removed = false;

  remove(): void {
    this.removed = true;
  }
}

class FakeCanvas extends EventTarget {
  readonly clientWidth = 1600;
  readonly clientHeight = 900;
  readonly parentElement = {
    appendChild(): void {},
  };
  capturedPointerId: number | undefined;

  setPointerCapture(pointerId: number): void {
    this.capturedPointerId = pointerId;
  }
}

class FakeDocument extends EventTarget {
  hidden = false;
  readonly body = {
    appendChild(): void {},
  };
  readonly marquee = new FakeElement();

  createElement(): FakeElement {
    return this.marquee;
  }
}

const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
let canvas: FakeCanvas;
let fakeDocument: FakeDocument;
let fakeWindow: EventTarget;
let detachInput: (() => void) | undefined;

function replaceGlobal(name: string, value: unknown): void {
  originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function dispatch(
  target: EventTarget,
  type: string,
  properties: Record<string, unknown> = {},
): void {
  const event = new Event(type, { cancelable: true });

  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(event, name, { configurable: true, value });
  }

  target.dispatchEvent(event);
}

function attachTestInput(): ReturnType<typeof attachInput>["state"] {
  const input = attachInput(canvas as unknown as HTMLCanvasElement);
  detachInput = input.detach;
  return input.state;
}

beforeEach(() => {
  canvas = new FakeCanvas();
  fakeDocument = new FakeDocument();
  fakeWindow = new EventTarget();
  replaceGlobal("document", fakeDocument);
  replaceGlobal("window", fakeWindow);
  replaceGlobal("HTMLElement", class HTMLElement {});
});

afterEach(() => {
  detachInput?.();
  detachInput = undefined;

  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
  originalGlobals.clear();
});

test("window blur clears held keys and an active pointer gesture", () => {
  const state = attachTestInput();

  dispatch(fakeWindow, "keydown", { code: "KeyW", repeat: false });
  dispatch(canvas, "pointerdown", {
    button: 2,
    buttons: 2,
    offsetX: 100,
    offsetY: 100,
    pointerId: 7,
  });
  dispatch(canvas, "pointermove", {
    buttons: 2,
    offsetX: 110,
    offsetY: 100,
    pointerId: 7,
  });

  expect(state.keyPanY).toBe(1);
  expect(state.dragging).toBe(true);

  dispatch(fakeWindow, "blur");

  expect(state.keyPanY).toBe(0);
  expect(state.dragging).toBe(false);
  expect(state.pointerInside).toBe(false);
  expect(state.hasDragAnchor).toBe(false);

  dispatch(canvas, "pointerup", {
    button: 2,
    buttons: 0,
    offsetX: 110,
    offsetY: 100,
    pointerId: 7,
  });
  expect(state.commandPending).toBe(false);
});

test("hiding the document clears keyboard and pointer state", () => {
  const state = attachTestInput();

  dispatch(fakeWindow, "keydown", { code: "ArrowLeft", repeat: false });
  dispatch(canvas, "pointerdown", {
    button: 1,
    buttons: 4,
    offsetX: 300,
    offsetY: 300,
    pointerId: 3,
  });
  expect(state.keyPanX).toBe(-1);
  expect(state.dragging).toBe(true);

  fakeDocument.hidden = true;
  dispatch(fakeDocument, "visibilitychange");

  expect(state.keyPanX).toBe(0);
  expect(state.dragging).toBe(false);
  expect(state.pointerInside).toBe(false);
});

test("pointer cancellation clears stale hover and drag state", () => {
  const state = attachTestInput();

  dispatch(canvas, "pointerdown", {
    button: 1,
    buttons: 4,
    offsetX: 200,
    offsetY: 200,
    pointerId: 9,
  });
  expect(state.pointerInside).toBe(true);
  expect(state.dragging).toBe(true);

  dispatch(canvas, "pointercancel", { buttons: 0, pointerId: 9 });

  expect(state.pointerInside).toBe(false);
  expect(state.pointerOverMinimap).toBe(false);
  expect(state.dragging).toBe(false);
});

test("captured pointer movement outside the canvas does not enable edge scrolling", () => {
  const state = attachTestInput();

  dispatch(canvas, "pointerdown", {
    button: 1,
    buttons: 4,
    offsetX: 200,
    offsetY: 200,
    pointerId: 10,
  });
  dispatch(canvas, "pointermove", {
    buttons: 4,
    offsetX: -20,
    offsetY: 200,
    pointerId: 10,
  });

  expect(state.dragging).toBe(true);
  expect(state.pointerInside).toBe(false);
  expect(state.pointerOverMinimap).toBe(false);
});

test("capture loss and a zero button mask repair a missed pointer release", () => {
  const state = attachTestInput();

  dispatch(canvas, "pointerdown", {
    button: 2,
    buttons: 2,
    offsetX: 100,
    offsetY: 100,
    pointerId: 4,
  });
  dispatch(canvas, "lostpointercapture", { buttons: 0, pointerId: 4 });
  dispatch(canvas, "pointerup", {
    button: 2,
    buttons: 0,
    offsetX: 100,
    offsetY: 100,
    pointerId: 4,
  });
  expect(state.commandPending).toBe(false);

  dispatch(canvas, "pointerdown", {
    button: 2,
    buttons: 2,
    offsetX: 120,
    offsetY: 120,
    pointerId: 5,
  });
  dispatch(canvas, "pointermove", {
    buttons: 0,
    offsetX: 130,
    offsetY: 120,
    pointerId: 5,
  });

  expect(state.dragging).toBe(false);

  dispatch(canvas, "pointerup", {
    button: 2,
    buttons: 0,
    offsetX: 130,
    offsetY: 120,
    pointerId: 5,
  });
  expect(state.commandPending).toBe(false);
});
