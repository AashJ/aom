import { DEPTH_FORMAT } from "../gpu/device";
import minimapWgsl from "../shaders/minimap.wgsl?raw";
import { MAP_TILES, VERTS_PER_ROW } from "../terrain/heightmap";

export const MINIMAP_TEX_SIZE = 256;

const SUN_X = 0.466;
const SUN_Y = 0.828;
const SUN_Z = 0.311;

export interface MinimapRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    canvasWidth: number,
    canvasHeight: number,
  ): void;
}

export function buildMinimapTexels(heights: Float32Array): Uint8Array {
  const texels = new Uint8Array(MINIMAP_TEX_SIZE * MINIMAP_TEX_SIZE * 4);

  for (let z = 0; z < MINIMAP_TEX_SIZE; z += 1) {
    for (let x = 0; x < MINIMAP_TEX_SIZE; x += 1) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(MAP_TILES, x + 1);
      const z0 = Math.max(0, z - 1);
      const z1 = Math.min(MAP_TILES, z + 1);
      const y = heights[z * VERTS_PER_ROW + x]!;
      const nx = heights[z * VERTS_PER_ROW + x0]! - heights[z * VERTS_PER_ROW + x1]!;
      const ny = 2;
      const nz = heights[z0 * VERTS_PER_ROW + x]! - heights[z1 * VERTS_PER_ROW + x]!;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const normalX = nx * invLen;
      const normalY = ny * invLen;
      const normalZ = nz * invLen;
      const dry = smoothstep01(2, 6, y);
      const high = smoothstep01(6, 11, y);
      const steep = 1 - smoothstep01(0.65, 0.85, normalY);
      const light = 0.45 + 0.55 * Math.max(normalX * SUN_X + normalY * SUN_Y + normalZ * SUN_Z, 0);
      let r = mix(mix(0.16, 0.24, dry), 0.35, high);
      let g = mix(mix(0.23, 0.27, dry), 0.33, high);
      let b = mix(mix(0.13, 0.15, dry), 0.28, high);

      r = mix(r, 0.35, steep) * light;
      g = mix(g, 0.33, steep) * light;
      b = mix(b, 0.28, steep) * light;

      // Same linear-value convention the terrain fragment writes to the non-srgb swapchain,
      // so the minimap matches the world's look.
      const offset = (z * MINIMAP_TEX_SIZE + x) * 4;
      texels[offset] = Math.round(r * 255);
      texels[offset + 1] = Math.round(g * 255);
      texels[offset + 2] = Math.round(b * 255);
      texels[offset + 3] = 255;
    }
  }

  return texels;
}

export function createMinimapRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  heights: Float32Array,
): MinimapRenderer {
  const module = device.createShaderModule({ code: minimapWgsl });
  const texture = device.createTexture({
    size: [MINIMAP_TEX_SIZE, MINIMAP_TEX_SIZE],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const rect = new Float32Array(4);
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module },
    fragment: { module, targets: [{ format }] },
    primitive: { topology: "triangle-list" },
    // Overlay: always passes depth and draws over the world because it is drawn last.
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
    ],
  });

  device.queue.writeTexture(
    { texture },
    buildMinimapTexels(heights),
    { bytesPerRow: MINIMAP_TEX_SIZE * 4 },
    { width: MINIMAP_TEX_SIZE, height: MINIMAP_TEX_SIZE },
  );

  return {
    draw(pass, queue, canvasWidth, canvasHeight): void {
      const size = Math.round(canvasHeight * 0.32);
      const margin = Math.round(canvasHeight * 0.02);
      const minPxX = canvasWidth - margin - size;
      const maxPxX = canvasWidth - margin;
      const minPxY = canvasHeight - margin;
      const maxPxY = canvasHeight - margin - size;

      rect[0] = (minPxX / canvasWidth) * 2 - 1;
      rect[1] = 1 - (minPxY / canvasHeight) * 2;
      rect[2] = (maxPxX / canvasWidth) * 2 - 1;
      rect[3] = 1 - (maxPxY / canvasHeight) * 2;
      queue.writeBuffer(uniformBuffer, 0, rect);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
    },
  };
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));

  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
