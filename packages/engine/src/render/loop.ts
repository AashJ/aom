import { TICK_HZ } from "@aom/sim";

export const TICK_MS = 1_000 / TICK_HZ;

const MAX_TICKS_PER_FRAME = 5;

export interface FrameCallbacks {
  // false = this tick is BLOCKED: in a networked game its turn has not arrived,
  // so the loop must not consume the accumulator for it.
  tick(): boolean;
  render(alpha: number, dtMs: number): void;
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

    const dtMs = now - lastTime;
    accumulator += dtMs;
    lastTime = now;

    let ticksThisFrame = 0;

    while (accumulator >= TICK_MS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
      if (!callbacks.tick()) {
        // Keep at most one tick of real-time debt while blocked. Lockstep never skips a TURN,
        // but wall-clock debt is droppable; pacing re-anchors when turns resume.
        accumulator = Math.min(accumulator, TICK_MS);
        break;
      }
      accumulator -= TICK_MS;
      ticksThisFrame += 1;
    }

    if (ticksThisFrame === MAX_TICKS_PER_FRAME && accumulator >= TICK_MS) {
      // Drop accumulated time under heavy stalls so the tab slows down instead of freezing.
      accumulator = 0;
    }

    callbacks.render(accumulator / TICK_MS, dtMs);
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
