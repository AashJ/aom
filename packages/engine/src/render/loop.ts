export const TICK_MS = 50;

const MAX_TICKS_PER_FRAME = 5;

export interface FrameCallbacks {
  tick(): void;
  render(alpha: number): void;
  sample?(frameStart: number, cpuMs: number): void;
}

export function createFrameLoop(callbacks: FrameCallbacks): { start(): void; stop(): void } {
  let running = false;
  let rafId = 0;
  let lastTime = 0;
  let accumulator = 0;

  const frame = (now: number): void => {
    if (!running) {
      return;
    }

    accumulator += now - lastTime;
    lastTime = now;

    let ticksThisFrame = 0;

    while (accumulator >= TICK_MS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
      callbacks.tick();
      accumulator -= TICK_MS;
      ticksThisFrame += 1;
    }

    if (ticksThisFrame === MAX_TICKS_PER_FRAME && accumulator >= TICK_MS) {
      // Drop accumulated time under heavy stalls so the tab slows down instead of freezing.
      accumulator = 0;
    }

    callbacks.render(accumulator / TICK_MS);
    // rAF timestamps share performance.now()'s clock; this approximates CPU time spent this frame.
    callbacks.sample?.(now, performance.now() - now);
    rafId = requestAnimationFrame(frame);
  };

  return {
    start(): void {
      if (running) {
        return;
      }

      running = true;
      lastTime = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },

    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
