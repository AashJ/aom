import { UNIT_TYPES, VERTS_PER_ROW, heightAt, type RenderSnapshot } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import overlaysWgsl from "../shaders/unit-overlays.wgsl?raw";
import { recordDraw, resetRendererStatistics, type RendererStatistics } from "./render-statistics";
import { UNIT_PRESENTATIONS } from "./unit-presentation";

const RING_SEGMENTS = 32;
const RING_INNER = 0.75;
const RING_OUTER = 1;
const INSTANCE_FLOATS = 9;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;

export interface UnitOverlayRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    heights: Float32Array,
  ): RendererStatistics;
}

export function createUnitOverlayRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  heights: Float32Array,
): UnitOverlayRenderer {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let segment = 0; segment <= RING_SEGMENTS; segment += 1) {
    const angle = (segment / RING_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    vertices.push(cos * RING_INNER, sin * RING_INNER, 0, 0, 1);
    vertices.push(cos * RING_OUTER, sin * RING_OUTER, 0, 0, 1);
  }
  for (let segment = 0; segment < RING_SEGMENTS; segment += 1) {
    const inner = segment * 2;
    const outer = inner + 1;
    indices.push(inner, inner + 2, outer + 2, inner, outer + 2, outer);
  }

  const hpBase = vertices.length / 5;
  vertices.push(-0.55, 2.35, 0, 0, 2);
  vertices.push(0.55, 2.35, 1, 0, 2);
  vertices.push(0.55, 2.5, 1, 0, 2);
  vertices.push(-0.55, 2.5, 0, 0, 2);
  indices.push(hpBase, hpBase + 1, hpBase + 2, hpBase, hpBase + 2, hpBase + 3);

  const vertexData = new Float32Array(vertices);
  const indexData = new Uint16Array(indices);
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const instanceBuffer = device.createBuffer({
    size: maxInstances * INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(maxInstances * INSTANCE_FLOATS);
  const uniformStaging = new Float32Array(24);
  const uniformBuffer = device.createBuffer({
    size: uniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const heightTexture = device.createTexture({
    size: [VERTS_PER_ROW, VERTS_PER_ROW],
    format: "r32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const module = device.createShaderModule({ code: overlaysWgsl });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 20,
          attributes: [
            { format: "float32x2", offset: 0, shaderLocation: 0 },
            { format: "float32x2", offset: 8, shaderLocation: 1 },
            { format: "float32", offset: 16, shaderLocation: 2 },
          ],
        },
        {
          arrayStride: INSTANCE_STRIDE,
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 3 },
            { format: "float32", offset: 12, shaderLocation: 4 },
            { format: "float32", offset: 16, shaderLocation: 5 },
            { format: "float32", offset: 20, shaderLocation: 6 },
            { format: "float32", offset: 24, shaderLocation: 7 },
            { format: "float32", offset: 28, shaderLocation: 8 },
            { format: "float32", offset: 32, shaderLocation: 9 },
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [
        {
          format,
          blend: {
            color: { operation: "add", srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { operation: "add", srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: heightTexture.createView() },
    ],
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);
  device.queue.writeTexture(
    { texture: heightTexture },
    heights,
    { bytesPerRow: VERTS_PER_ROW * 4, rowsPerImage: VERTS_PER_ROW },
    { width: VERTS_PER_ROW, height: VERTS_PER_ROW },
  );
  const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };

  return {
    draw(pass, queue, viewProj, prev, curr, alpha, terrainHeights): RendererStatistics {
      resetRendererStatistics(statistics);
      let count = 0;
      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;
        const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
        const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
        const x = prevX + (curr.posX[i]! - prevX) * alpha;
        const z = prevZ + (curr.posZ[i]! - prevZ) * alpha;
        const type = curr.unitType[i]!;
        const stats = UNIT_TYPES[type]!;
        const presentation = UNIT_PRESENTATIONS[type]!;
        const buildFrac =
          stats.buildTicks > 0 ? Math.min(1, curr.buildProgress[i]! / stats.buildTicks) : 1;
        const offset = count * INSTANCE_FLOATS;
        staging[offset] = x;
        staging[offset + 1] = heightAt(terrainHeights, x, z);
        staging[offset + 2] = z;
        staging[offset + 3] = curr.selected[i]!;
        staging[offset + 4] = curr.owner[i]!;
        staging[offset + 5] = curr.hp[i]! / stats.maxHp;
        staging[offset + 6] = buildFrac;
        staging[offset + 7] = presentation.worldHeight - presentation.bottomPadding;
        staging[offset + 8] = stats.footprint > 0 ? 0 : 1;
        count += 1;
      }

      if (count === 0) return statistics;
      queue.writeBuffer(instanceBuffer, 0, staging, 0, count * INSTANCE_FLOATS);
      uniformStaging.set(viewProj);
      uniformStaging[16] = viewProj[0]!;
      uniformStaging[17] = viewProj[4]!;
      uniformStaging[18] = viewProj[8]!;
      uniformStaging[20] = viewProj[1]!;
      uniformStaging[21] = viewProj[5]!;
      uniformStaging[22] = viewProj[9]!;
      queue.writeBuffer(uniformBuffer, 0, uniformStaging);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      pass.drawIndexed(indexData.length, count);
      recordDraw(statistics, count);
      return statistics;
    },
  };
}
