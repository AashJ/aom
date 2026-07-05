export class WebGPUUnsupportedError extends Error {
  constructor() {
    super(
      "WebGPU is not supported in this browser. Use Chrome/Edge, Safari 26+, or a recent Firefox release.",
    );
    this.name = "WebGPUUnsupportedError";
  }
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && navigator.gpu !== undefined;
}

export { initGPU, type DeviceLostCallback, type GpuContext } from "./gpu/device";
export { observeCanvasSize, type CanvasResizeCallback } from "./gpu/surface";
export { createGame, type GameHandle, type GameOptions } from "./game";
export { connectToRelay } from "./net/relay";
export type { BeginInfo, NetEvent, NetSession } from "./net/relay";
// The web app consumes the engine's API surface only — it re-exports the wire
// types it needs so apps/web never depends on @aom/relay directly.
export type { PlayerInfo } from "@aom/relay";
export type { GameStats, StatsCallback } from "./render/stats";
