export interface GpuTimer {
  readonly passTimestampWrites: GPURenderPassTimestampWrites | undefined;
  afterPass(encoder: GPUCommandEncoder): void;
  afterSubmit(onSample: (gpuMs: number) => void): void;
}

export function createGpuTimer(device: GPUDevice): GpuTimer {
  if (!device.features.has("timestamp-query")) {
    // Pass descriptors accept undefined timestampWrites, so callers do not branch.
    return {
      passTimestampWrites: undefined,
      afterPass(): void {},
      afterSubmit(): void {},
    };
  }

  const querySet = device.createQuerySet({ type: "timestamp", count: 2 });
  const resolveBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
  const readbackBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const passTimestampWrites: GPURenderPassTimestampWrites = {
    querySet,
    beginningOfPassWriteIndex: 0,
    endOfPassWriteIndex: 1,
  };

  let readbackPending = false;
  let resolvedThisFrame = false;

  return {
    passTimestampWrites,
    afterPass(encoder): void {
      if (readbackPending) {
        // The readback buffer is still mapped or in flight. Skip this frame's resolve; GPU
        // timing samples at async map round-trip cadence, plenty for a 4 Hz HUD.
        return;
      }

      encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
      encoder.copyBufferToBuffer(resolveBuffer, 0, readbackBuffer, 0, 16);
      resolvedThisFrame = true;
    },
    afterSubmit(onSample): void {
      if (!resolvedThisFrame || readbackPending) {
        return;
      }

      readbackPending = true;
      resolvedThisFrame = false;

      void readbackBuffer
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          // Timestamps are u64 nanoseconds, hence BigUint64Array. getMappedRange allocates a
          // fresh ArrayBuffer per map; that API shape is unavoidable and harmless for HUD data.
          const times = new BigUint64Array(readbackBuffer.getMappedRange());
          const deltaNs = Number(times[1]! - times[0]!);

          readbackBuffer.unmap();
          readbackPending = false;
          onSample(Math.max(0, deltaNs) / 1e6);
        })
        .catch(() => {
          // Covers device loss mid-map.
          readbackPending = false;
        });
    },
  };
}
