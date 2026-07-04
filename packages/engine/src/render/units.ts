import { heightAt, VERTS_PER_ROW, type RenderSnapshot } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import unitsWgsl from "../shaders/units.wgsl?raw";

export interface UnitsRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    heights: Float32Array,
  ): number;
}

const RING_SEGMENTS = 32;
const RING_INNER = 0.75;
const RING_OUTER = 1.0;

export function createUnitsRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  heights: Float32Array,
): UnitsRenderer {
  const cubeVerts = [
    // position xyz, normal xyz, part (0 = box, 1 = ring)
    -0.5, 0, 0.5, 0, 0, 1, 0, 0.5, 0, 0.5, 0, 0, 1, 0, 0.5, 1, 0.5, 0, 0, 1, 0, -0.5, 1, 0.5, 0, 0,
    1, 0, 0.5, 0, -0.5, 0, 0, -1, 0, -0.5, 0, -0.5, 0, 0, -1, 0, -0.5, 1, -0.5, 0, 0, -1, 0, 0.5, 1,
    -0.5, 0, 0, -1, 0, -0.5, 0, -0.5, -1, 0, 0, 0, -0.5, 0, 0.5, -1, 0, 0, 0, -0.5, 1, 0.5, -1, 0,
    0, 0, -0.5, 1, -0.5, -1, 0, 0, 0, 0.5, 0, 0.5, 1, 0, 0, 0, 0.5, 0, -0.5, 1, 0, 0, 0, 0.5, 1,
    -0.5, 1, 0, 0, 0, 0.5, 1, 0.5, 1, 0, 0, 0, -0.5, 1, 0.5, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 0, 0,
    0.5, 1, -0.5, 0, 1, 0, 0, -0.5, 1, -0.5, 0, 1, 0, 0, -0.5, 0, -0.5, 0, -1, 0, 0, 0.5, 0, -0.5,
    0, -1, 0, 0, 0.5, 0, 0.5, 0, -1, 0, 0, -0.5, 0, 0.5, 0, -1, 0, 0,
  ];
  const verts = [...cubeVerts];
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16,
    18, 19, 20, 21, 22, 20, 22, 23,
  ];
  const ringBase = cubeVerts.length / 7;

  // The old flat ring quad used the unit-center height; across 0.6 world units of sloped terrain
  // its uphill arc dipped under the ground and depth-failed, so the vertex shader drapes this annulus.
  for (let s = 0; s <= RING_SEGMENTS; s += 1) {
    const angle = (s / RING_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    verts.push(cos * RING_INNER, 0, sin * RING_INNER, 0, 1, 0, 1);
    verts.push(cos * RING_OUTER, 0, sin * RING_OUTER, 0, 1, 0, 1);
  }

  for (let s = 0; s < RING_SEGMENTS; s += 1) {
    const i0 = ringBase + s * 2;
    const o0 = i0 + 1;
    const i1 = i0 + 2;
    const o1 = i0 + 3;

    indices.push(i0, i1, o1, i0, o1, o0);
  }

  const cubeData = new Float32Array(verts);
  const indexData = new Uint16Array(indices);
  const cubeBuffer = device.createBuffer({
    size: cubeData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const instanceBuffer = device.createBuffer({
    size: maxInstances * 16,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(maxInstances * 4);
  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const heightTexture = device.createTexture({
    size: [VERTS_PER_ROW, VERTS_PER_ROW],
    format: "r32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const module = device.createShaderModule({ code: unitsWgsl });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 28,
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 0 },
            { format: "float32x3", offset: 12, shaderLocation: 1 },
            { format: "float32", offset: 24, shaderLocation: 2 },
          ],
        },
        {
          arrayStride: 16,
          // stepMode "instance" advances this buffer once per instance, not per vertex;
          // that is the whole trick of instancing.
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 3 },
            { format: "float32", offset: 12, shaderLocation: 4 },
          ],
        },
      ],
    },
    fragment: { module, targets: [{ format }] },
    primitive: { topology: "triangle-list", cullMode: "back" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: heightTexture.createView() },
    ],
  });

  device.queue.writeBuffer(cubeBuffer, 0, cubeData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);
  // r32float is not filterable, but the shader uses textureLoad + manual bilinear, so no sampler
  // and no float32-filterable feature is needed. writeTexture has no 256-byte row alignment
  // requirement, unlike buffer-to-texture copies.
  device.queue.writeTexture(
    { texture: heightTexture },
    heights,
    { bytesPerRow: VERTS_PER_ROW * 4, rowsPerImage: VERTS_PER_ROW },
    { width: VERTS_PER_ROW, height: VERTS_PER_ROW },
  );

  return {
    draw(pass, queue, viewProj, prev, curr, alpha, heights): number {
      for (let i = 0; i < curr.count; i += 1) {
        // Counts only differ if spawns happened between snapshots. That cannot happen in M1,
        // but this avoids reading garbage.
        const prevX = i < prev.count ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = i < prev.count ? prev.posZ[i]! : curr.posZ[i]!;
        // Snapshot interpolation is why the double buffer exists: 20 Hz sim ticks can render
        // smoothly at arbitrary display refresh rates.
        const x = prevX + (curr.posX[i]! - prevX) * alpha;
        const z = prevZ + (curr.posZ[i]! - prevZ) * alpha;
        const offset = i * 4;

        staging[offset] = x;
        staging[offset + 1] = heightAt(heights, x, z);
        staging[offset + 2] = z;
        staging[offset + 3] = curr.selected[i]!;
      }

      queue.writeBuffer(instanceBuffer, 0, staging, 0, curr.count * 4);
      queue.writeBuffer(uniformBuffer, 0, viewProj);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, cubeBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      // The cube and draped ring still ride in one instanced draw; draw-call count does not change.
      pass.drawIndexed(228, curr.count);
      return curr.count;
    },
  };
}
