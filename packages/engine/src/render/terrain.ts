import { VERTS_PER_ROW } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import { aabbIntersectsFrustum, type Frustum } from "../math/frustum";
import terrainWgsl from "../shaders/terrain.wgsl?raw";
import { CHUNK_TILES, CHUNKS_PER_ROW } from "../terrain/heightmap";

export interface TerrainChunkBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export interface TerrainRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    frustum: Frustum,
  ): number;
  readonly chunkBounds: readonly TerrainChunkBounds[];
}

const LOCAL_VERTS_PER_ROW = CHUNK_TILES + 1;
const FLOATS_PER_VERTEX = 6;
const INDEX_COUNT = CHUNK_TILES * CHUNK_TILES * 6;

export function createTerrainRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  heights: Float32Array,
): TerrainRenderer {
  const module = device.createShaderModule({ code: terrainWgsl });
  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Every chunk has the same 32x32-quad local topology, so one index buffer is shared.
  const indexData = new Uint16Array(INDEX_COUNT);
  let indexOffset = 0;

  for (let z = 0; z < CHUNK_TILES; z += 1) {
    for (let x = 0; x < CHUNK_TILES; x += 1) {
      const v00 = z * LOCAL_VERTS_PER_ROW + x;
      const v01 = (z + 1) * LOCAL_VERTS_PER_ROW + x;
      const v10 = z * LOCAL_VERTS_PER_ROW + x + 1;
      const v11 = (z + 1) * LOCAL_VERTS_PER_ROW + x + 1;

      indexData[indexOffset++] = v00;
      indexData[indexOffset++] = v01;
      indexData[indexOffset++] = v10;
      indexData[indexOffset++] = v10;
      indexData[indexOffset++] = v01;
      indexData[indexOffset++] = v11;
    }
  }

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  const chunks: { vertexBuffer: GPUBuffer }[] = [];
  const chunkBounds: TerrainChunkBounds[] = [];

  for (let chunkZ = 0; chunkZ < CHUNKS_PER_ROW; chunkZ += 1) {
    for (let chunkX = 0; chunkX < CHUNKS_PER_ROW; chunkX += 1) {
      const vertexData = new Float32Array(
        LOCAL_VERTS_PER_ROW * LOCAL_VERTS_PER_ROW * FLOATS_PER_VERTEX,
      );
      const minX = chunkX * CHUNK_TILES;
      const minZ = chunkZ * CHUNK_TILES;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let offset = 0;

      for (let localZ = 0; localZ < LOCAL_VERTS_PER_ROW; localZ += 1) {
        for (let localX = 0; localX < LOCAL_VERTS_PER_ROW; localX += 1) {
          // World-space vertices keep the shader uniform-free per chunk.
          const x = minX + localX;
          const z = minZ + localZ;
          const y = heights[z * VERTS_PER_ROW + x]!;
          const x0 = Math.max(0, x - 1);
          const x1 = Math.min(VERTS_PER_ROW - 1, x + 1);
          const z0 = Math.max(0, z - 1);
          const z1 = Math.min(VERTS_PER_ROW - 1, z + 1);
          const nx = heights[z * VERTS_PER_ROW + x0]! - heights[z * VERTS_PER_ROW + x1]!;
          const ny = 2;
          const nz = heights[z0 * VERTS_PER_ROW + x]! - heights[z1 * VERTS_PER_ROW + x]!;
          const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);

          vertexData[offset++] = x;
          vertexData[offset++] = y;
          vertexData[offset++] = z;
          vertexData[offset++] = nx * invLen;
          vertexData[offset++] = ny * invLen;
          vertexData[offset++] = nz * invLen;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vertexBuffer, 0, vertexData);
      chunks.push({ vertexBuffer });
      chunkBounds.push({
        minX,
        minZ,
        maxX: minX + CHUNK_TILES,
        maxZ: minZ + CHUNK_TILES,
        minY,
        maxY,
      });
    }
  }

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 24,
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 0 },
            { format: "float32x3", offset: 12, shaderLocation: 1 },
          ],
        },
      ],
    },
    fragment: { module, targets: [{ format }] },
    // CCW-from-above winding plus back-face culling is now owned by the terrain mesh,
    // roughly halving rasterized fragments on hilly ground.
    primitive: { topology: "triangle-list", cullMode: "back" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    chunkBounds,
    draw(pass, queue, viewProj, frustum): number {
      queue.writeBuffer(uniformBuffer, 0, viewProj);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setIndexBuffer(indexBuffer, "uint16");

      let drawn = 0;

      for (let i = 0; i < chunks.length; i += 1) {
        const b = chunkBounds[i]!;

        if (!aabbIntersectsFrustum(frustum, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ)) {
          continue;
        }

        pass.setVertexBuffer(0, chunks[i]!.vertexBuffer);
        pass.drawIndexed(INDEX_COUNT);
        drawn += 1;
      }

      return drawn;
    },
  };
}
