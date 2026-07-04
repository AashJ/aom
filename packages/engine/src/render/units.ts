import type { RenderSnapshot } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import unitsWgsl from "../shaders/units.wgsl?raw";
import { heightAt } from "../terrain/heightmap";

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

export function createUnitsRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
): UnitsRenderer {
  const cubeData = new Float32Array([
    -0.5, 0, 0.5, 0, 0, 1, 0.5, 0, 0.5, 0, 0, 1, 0.5, 1, 0.5, 0, 0, 1, -0.5, 1, 0.5, 0, 0, 1, 0.5,
    0, -0.5, 0, 0, -1, -0.5, 0, -0.5, 0, 0, -1, -0.5, 1, -0.5, 0, 0, -1, 0.5, 1, -0.5, 0, 0, -1,
    -0.5, 0, -0.5, -1, 0, 0, -0.5, 0, 0.5, -1, 0, 0, -0.5, 1, 0.5, -1, 0, 0, -0.5, 1, -0.5, -1, 0,
    0, 0.5, 0, 0.5, 1, 0, 0, 0.5, 0, -0.5, 1, 0, 0, 0.5, 1, -0.5, 1, 0, 0, 0.5, 1, 0.5, 1, 0, 0,
    -0.5, 1, 0.5, 0, 1, 0, 0.5, 1, 0.5, 0, 1, 0, 0.5, 1, -0.5, 0, 1, 0, -0.5, 1, -0.5, 0, 1, 0,
    -0.5, 0, -0.5, 0, -1, 0, 0.5, 0, -0.5, 0, -1, 0, 0.5, 0, 0.5, 0, -1, 0, -0.5, 0, 0.5, 0, -1, 0,
  ]);
  const indexData = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16,
    18, 19, 20, 21, 22, 20, 22, 23,
  ]);
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
  const module = device.createShaderModule({ code: unitsWgsl });
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
        {
          arrayStride: 16,
          // stepMode "instance" advances this buffer once per instance, not per vertex;
          // that is the whole trick of instancing.
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 2 },
            { format: "float32", offset: 12, shaderLocation: 3 },
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
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  device.queue.writeBuffer(cubeBuffer, 0, cubeData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);

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
      // One instanced draw renders every visible unit regardless of count.
      pass.drawIndexed(36, curr.count);
      return curr.count;
    },
  };
}
