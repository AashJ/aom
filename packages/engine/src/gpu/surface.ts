export type CanvasResizeCallback = (width: number, height: number) => void;

export function observeCanvasSize(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  onResize?: CanvasResizeCallback,
): () => void {
  const maxDimension = device.limits.maxTextureDimension2D;

  const syncSize = (entry?: ResizeObserverEntry): void => {
    const devicePixelBox = entry?.devicePixelContentBoxSize?.[0];
    const contentBox = entry?.contentBoxSize?.[0];
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    const rect = entry?.contentRect ?? canvas.getBoundingClientRect();
    const physicalWidth =
      devicePixelBox?.inlineSize ?? (contentBox?.inlineSize ?? rect.width) * dpr;
    const physicalHeight =
      devicePixelBox?.blockSize ?? (contentBox?.blockSize ?? rect.height) * dpr;
    const width = clampCanvasDimension(physicalWidth, maxDimension);
    const height = clampCanvasDimension(physicalHeight, maxDimension);

    if (canvas.width === width && canvas.height === height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;

    // WebGPU canvas contexts do not need configure() to be called again on resize:
    // getCurrentTexture() observes the current backing-store size. Future depth
    // textures will need resize handling, and this callback is the hook for that.
    onResize?.(width, height);
  };

  const observer = new ResizeObserver((entries) => {
    syncSize(entries[0]);
  });

  syncSize();

  try {
    observer.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    observer.observe(canvas, { box: "content-box" });
  }

  return () => {
    observer.disconnect();
  };
}

function clampCanvasDimension(value: number, max: number): number {
  const rounded = Number.isFinite(value) ? Math.round(value) : 1;

  return Math.min(max, Math.max(1, rounded));
}
