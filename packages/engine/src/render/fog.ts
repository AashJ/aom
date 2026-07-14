import { MAP_TILES } from "@aom/sim";
import fogWgsl from "../shaders/fog.wgsl?raw";

export interface FogRenderer {
  update(
    encoder: GPUCommandEncoder,
    queue: GPUQueue,
    fog: Uint8Array,
    tick: number,
  ): GPUTextureView;
}

export function createFogRenderer(device: GPUDevice): FogRenderer {
  const rawTexture = device.createTexture({
    size: [MAP_TILES, MAP_TILES],
    format: "r8uint",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const filteredTexture = device.createTexture({
    size: [MAP_TILES, MAP_TILES],
    format: "rgba8unorm",
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
  });
  const filteredView = filteredTexture.createView();
  const module = device.createShaderModule({ code: fogWgsl });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "cs" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: rawTexture.createView() },
      { binding: 1, resource: filteredView },
    ],
  });
  let lastTick = -1;

  return {
    update(encoder, queue, fog, tick): GPUTextureView {
      if (tick === lastTick) return filteredView;

      queue.writeTexture(
        { texture: rawTexture },
        fog,
        { bytesPerRow: MAP_TILES, rowsPerImage: MAP_TILES },
        { width: MAP_TILES, height: MAP_TILES },
      );

      const pass = encoder.beginComputePass();

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(MAP_TILES / 8), Math.ceil(MAP_TILES / 8));
      pass.end();
      lastTick = tick;

      return filteredView;
    },
  };
}
