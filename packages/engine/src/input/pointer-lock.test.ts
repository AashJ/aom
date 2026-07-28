import { afterEach, beforeEach, expect, test } from "bun:test";
import { attachInput } from "./input";

class FakeStyle {
  [key: string]: string | ((name: string, value: string) => void);

  setProperty(name: string, value: string): void {
    this[name] = value;
  }
}

class FakeElement extends EventTarget {
  readonly style = new FakeStyle();
  parentElement: { appendChild(element: FakeElement): void } | null = null;
  removed = false;
  clicked = 0;
  focused = false;
  interactive = false;

  setAttribute(): void {}

  closest(): FakeElement | null {
    return this.interactive ? this : null;
  }

  contains(target: unknown): boolean {
    return target === this;
  }

  focus(): void {
    this.focused = true;
  }

  click(): void {
    this.clicked += 1;
  }

  remove(): void {
    this.removed = true;
  }
}

class FakeCanvas extends FakeElement {
  readonly clientWidth = 1600;
  readonly clientHeight = 900;

  requestPointerLock(): Promise<void> {
    return Promise.resolve();
  }

  setPointerCapture(): void {}

  getBoundingClientRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      right: 1600,
      bottom: 900,
      width: 1600,
      height: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }
}

class FakeDocument extends EventTarget {
  hidden = false;
  pointerLockElement: FakeElement | null = null;
  hitTarget: FakeElement | null = null;
  readonly created: FakeElement[] = [];
  readonly body = {
    appendChild(): void {},
  };

  createElement(): FakeElement {
    const element = new FakeElement();
    this.created.push(element);
    return element;
  }

  elementFromPoint(): FakeElement | null {
    return this.hitTarget;
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

beforeEach(() => {
  canvas = new FakeCanvas();
  fakeDocument = new FakeDocument();
  fakeWindow = new EventTarget();
  canvas.parentElement = {
    appendChild(): void {},
  };
  fakeDocument.hitTarget = canvas;
  replaceGlobal("document", fakeDocument);
  replaceGlobal("window", fakeWindow);
  replaceGlobal("HTMLElement", FakeElement);
  replaceGlobal("Node", FakeElement);
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

test("pointer lock drives the custom cursor and routes canvas and HUD clicks", () => {
  const input = attachInput(canvas as unknown as HTMLCanvasElement);
  detachInput = input.detach;
  const cursor = fakeDocument.created[1]!;

  fakeDocument.pointerLockElement = canvas;
  dispatch(fakeDocument, "pointerlockchange");

  expect(cursor.style.display).toBe("block");
  expect(cursor.style.left).toBe("800px");
  expect(cursor.style.top).toBe("450px");

  dispatch(canvas, "pointermove", {
    buttons: 0,
    movementX: 120,
    movementY: -80,
    offsetX: 0,
    offsetY: 0,
  });
  expect(input.state.pointerX).toBe(920);
  expect(input.state.pointerY).toBe(370);
  expect(cursor.style.left).toBe("920px");
  expect(cursor.style.top).toBe("370px");

  dispatch(canvas, "pointerdown", {
    button: 0,
    buttons: 1,
    offsetX: 0,
    offsetY: 0,
    pointerId: 1,
  });
  dispatch(canvas, "pointerup", {
    button: 0,
    buttons: 0,
    offsetX: 0,
    offsetY: 0,
    pointerId: 1,
  });
  expect(input.state.clickPending).toBe(true);
  expect(input.state.clickX).toBe(920);
  expect(input.state.clickY).toBe(370);

  input.state.clickPending = false;
  const hudButton = new FakeElement();
  hudButton.interactive = true;
  fakeDocument.hitTarget = hudButton;

  dispatch(canvas, "pointerdown", {
    button: 0,
    buttons: 1,
    offsetX: 0,
    offsetY: 0,
    pointerId: 2,
  });
  dispatch(canvas, "pointerup", {
    button: 0,
    buttons: 0,
    offsetX: 0,
    offsetY: 0,
    pointerId: 2,
  });
  expect(hudButton.clicked).toBe(1);
  expect(hudButton.focused).toBe(true);
  expect(input.state.clickPending).toBe(false);

  fakeDocument.pointerLockElement = null;
  dispatch(fakeDocument, "pointerlockchange");
  expect(cursor.style.display).toBe("none");
  expect(input.state.pointerInside).toBe(false);
});
