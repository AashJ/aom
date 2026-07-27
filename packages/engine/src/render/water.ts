import { MAP_TILES } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import waterWgsl from "../shaders/water.wgsl?raw";

export interface WaterRenderer {
  readonly vertexCount: number;
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    timeSeconds: number,
    fogView: GPUTextureView,
  ): number;
}

export function buildWaterVertices(waterNavigable: Uint8Array): Float32Array {
  if (waterNavigable.length !== MAP_TILES * MAP_TILES) {
    throw new RangeError("Water navigation mask must contain one value per map tile.");
  }

  let waterTileCount = 0;
  for (const value of waterNavigable) {
    if (value === 1) waterTileCount += 1;
  }

  const vertices = new Float32Array(waterTileCount * 6 * 2);
  let offset = 0;

  for (let z = 0; z < MAP_TILES; z += 1) {
    for (let x = 0; x < MAP_TILES; x += 1) {
      if (waterNavigable[z * MAP_TILES + x] !== 1) continue;
      const x1 = x + 1;
      const z1 = z + 1;

      vertices[offset++] = x;
      vertices[offset++] = z;
      vertices[offset++] = x;
      vertices[offset++] = z1;
      vertices[offset++] = x1;
      vertices[offset++] = z;
      vertices[offset++] = x1;
      vertices[offset++] = z;
      vertices[offset++] = x;
      vertices[offset++] = z1;
      vertices[offset++] = x1;
      vertices[offset++] = z1;
    }
  }

  return vertices;
}

export function createWaterRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  waterNavigable: Uint8Array,
  waterLevel: number,
): WaterRenderer {
  const vertices = buildWaterVertices(waterNavigable);
  const vertexBuffer = device.createBuffer({
    size: Math.max(8, vertices.byteLength),
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  if (vertices.byteLength > 0) device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const module = device.createShaderModule({ code: waterWgsl });
  const uniformStaging = new Float32Array(20);
  const uniformBuffer = device.createBuffer({
    size: uniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const fogSampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }],
        },
      ],
    },
    fragment: {
      module,
      targets: [
        {
          format,
          blend: {
            color: {
              operation: "add",
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
            },
            alpha: {
              operation: "add",
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "less" },
  });
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  let boundFogView: GPUTextureView | null = null;
  let bindGroup: GPUBindGroup | null = null;

  return {
    vertexCount: vertices.length / 2,
    draw(pass, queue, viewProj, timeSeconds, fogView): number {
      if (vertices.length === 0) return 0;

      if (boundFogView !== fogView) {
        bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: fogView },
            { binding: 2, resource: fogSampler },
          ],
        });
        boundFogView = fogView;
      }

      uniformStaging.set(viewProj);
      uniformStaging[16] = timeSeconds;
      uniformStaging[17] = waterLevel + 0.03;
      queue.writeBuffer(uniformBuffer, 0, uniformStaging);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(vertices.length / 2);
      return 1;
    },
  };
}
