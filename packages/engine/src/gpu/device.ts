import { WebGPUUnsupportedError } from "../index";

export const DEPTH_FORMAT: GPUTextureFormat = "depth24plus";

export interface GpuContext {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
  readonly canvas: HTMLCanvasElement;
}

export type DeviceLostCallback = (info: GPUDeviceLostInfo) => void;

export async function initGPU(
  canvas: HTMLCanvasElement,
  onDeviceLost?: DeviceLostCallback,
): Promise<GpuContext> {
  const gpu = getGPU();
  const adapter = await gpu.requestAdapter();

  if (!adapter) {
    throw new WebGPUUnsupportedError();
  }

  // Features must be requested at device creation; they cannot be enabled later.
  const device = await adapter.requestDevice({
    requiredFeatures: adapter.features.has("timestamp-query") ? ["timestamp-query"] : [],
  });
  const context = canvas.getContext("webgpu");

  if (!context) {
    device.destroy();
    throw new WebGPUUnsupportedError();
  }

  const format = gpu.getPreferredCanvasFormat();

  context.configure({
    alphaMode: "opaque",
    device,
    format,
  });

  watchDeviceLost(device, onDeviceLost);

  return {
    adapter,
    canvas,
    context,
    device,
    format,
  };
}

function getGPU(): GPU {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    throw new WebGPUUnsupportedError();
  }

  return navigator.gpu;
}

function watchDeviceLost(device: GPUDevice, onDeviceLost: DeviceLostCallback | undefined): void {
  void device.lost.then((info) => {
    // device.destroy() intentionally resolves device.lost with "destroyed".
    // That is cleanup, not a recoverable device-loss event.
    if (info.reason === "destroyed") {
      return;
    }

    console.warn("WebGPU device lost.", info.reason, info.message);
    onDeviceLost?.(info);
  });
}
