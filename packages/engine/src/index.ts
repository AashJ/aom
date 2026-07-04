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
