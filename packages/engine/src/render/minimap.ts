import { MAP_TILES, MAX_UNITS, VERTS_PER_ROW, type RenderSnapshot } from "@aom/sim";
import { screenToGround, type Camera } from "../camera/camera";
import { DEPTH_FORMAT } from "../gpu/device";
import * as vec3 from "../math/vec3";
import minimapWgsl from "../shaders/minimap.wgsl?raw";
import { UNIT_POSE_FLOATS, UNIT_POSE_X, UNIT_POSE_Z, writeInterpolatedUnitPose } from "./unit-pose";

export const MINIMAP_TEX_SIZE = 256;

const SUN_X = 0.466;
const SUN_Y = 0.828;
const SUN_Z = 0.311;
const minimapRectScratch = new Float32Array(4);
const footprintScratch = vec3.create();

export interface MinimapRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    canvasWidth: number,
    canvasHeight: number,
    camera: Camera,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    fogView: GPUTextureView,
  ): void;
}

// Derived from the shader's diamond corner table:
// world(0,0)->unit(0.5,0) bottom, world(256,256)->unit(0.5,1) top,
// world(0,256)->unit(1,0.5) right, world(256,0)->unit(0,0.5) left.
export function worldToMinimapUnit(x: number, z: number, out: Float32Array, offset: number): void {
  const u = x / MAP_TILES;
  const v = z / MAP_TILES;

  out[offset] = 0.5 + (v - u) * 0.5;
  out[offset + 1] = (u + v) * 0.5;
}

export function minimapRectPx(width: number, height: number, out: Float32Array): void {
  // Single source of truth for minimap placement: the renderer feeds it physical pixels, the
  // input hit-test feeds it CSS pixels; the fractions are resolution-independent so both agree
  // geometrically.
  const size = Math.round(height * 0.32);
  const margin = Math.round(height * 0.02);
  const x1 = width - margin;
  const y1 = height - margin;

  out[0] = x1 - size;
  out[1] = y1 - size;
  out[2] = x1;
  out[3] = y1;
}

export function minimapUnitFromPixel(
  px: number,
  py: number,
  rect: Float32Array,
  out: Float32Array,
  offset: number,
): void {
  // Pixel y grows down, diamond unit y grows up - same flip as NDC.
  out[offset] = (px - rect[0]!) / (rect[2]! - rect[0]!);
  out[offset + 1] = 1 - (py - rect[1]!) / (rect[3]! - rect[1]!);
}

export function isInsideMinimapDiamond(ux: number, uy: number): boolean {
  // Manhattan distance from center <= half-extent is the diamond.
  return Math.abs(ux - 0.5) + Math.abs(uy - 0.5) <= 0.5;
}

export function minimapUnitToWorld(
  ux: number,
  uy: number,
  out: Float32Array,
  offset: number,
): void {
  const u = uy - ux + 0.5;
  const v = uy + ux - 0.5;

  // Clamp so drags that wander off the diamond pin to the map edge.
  out[offset] = Math.max(0, Math.min(1, u)) * MAP_TILES;
  out[offset + 1] = Math.max(0, Math.min(1, v)) * MAP_TILES;
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
      // The classic minimap exaggerates terrain families so the map reads at a glance:
      // deep olive lowlands, ochre dry ground, and warm stone on high or steep terrain.
      let r = mix(mix(0.12, 0.3, dry), 0.42, high);
      let g = mix(mix(0.25, 0.32, dry), 0.37, high);
      let b = mix(mix(0.08, 0.12, dry), 0.25, high);

      r = mix(r, 0.42, steep) * light;
      g = mix(g, 0.37, steep) * light;
      b = mix(b, 0.25, steep) * light;

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
  const footprintStaging = new Float32Array(10);
  const footprintBuffer = device.createBuffer({
    size: 40,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const dotStaging = new Float32Array(MAX_UNITS * 4);
  const unitPose = new Float64Array(UNIT_POSE_FLOATS);
  const dotBuffer = device.createBuffer({
    size: dotStaging.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const dotUniform = new Float32Array(4);
  const dotUniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // Base pipeline: textured diamond terrain overview.
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
    // Overlay: always passes depth and draws over the world because it is drawn last.
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
  });
  // Classic AOM sets the map into a broad, beveled stone-and-bronze diamond. The frame
  // extends beyond the interactive terrain rect, so input mapping remains unchanged.
  const framePipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs_frame" },
    fragment: { module, entryPoint: "fs_frame", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
  });
  // Footprint pipeline: camera frustum outline in minimap NDC space.
  const footprintPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vs_line",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }],
        },
      ],
    },
    fragment: { module, entryPoint: "fs_line", targets: [{ format }] },
    primitive: { topology: "line-strip" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
  });
  // Dots pipeline: one instanced quad per unit position on the minimap.
  const dotPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vs_dot",
      buffers: [
        {
          arrayStride: 16,
          stepMode: "instance",
          attributes: [
            { format: "float32x2", offset: 0, shaderLocation: 0 },
            { format: "float32", offset: 8, shaderLocation: 1 },
            { format: "float32", offset: 12, shaderLocation: 2 },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: "fs_dot", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
  });
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  const terrainView = texture.createView();
  let boundFogView: GPUTextureView | null = null;
  let bindGroup: GPUBindGroup | null = null;
  const dotBindGroup = device.createBindGroup({
    layout: dotPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: dotUniformBuffer } }],
  });
  const frameBindGroup = device.createBindGroup({
    layout: framePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  device.queue.writeTexture(
    { texture },
    buildMinimapTexels(heights),
    { bytesPerRow: MINIMAP_TEX_SIZE * 4 },
    { width: MINIMAP_TEX_SIZE, height: MINIMAP_TEX_SIZE },
  );

  return {
    draw(pass, queue, canvasWidth, canvasHeight, camera, prev, curr, alpha, fogView): void {
      if (fogView !== boundFogView) {
        bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: terrainView },
            { binding: 3, resource: fogView },
          ],
        });
        boundFogView = fogView;
      }

      minimapRectPx(canvasWidth, canvasHeight, minimapRectScratch);
      const minPxX = minimapRectScratch[0]!;
      const minPxY = minimapRectScratch[3]!;
      const maxPxX = minimapRectScratch[2]!;
      const maxPxY = minimapRectScratch[1]!;

      rect[0] = (minPxX / canvasWidth) * 2 - 1;
      rect[1] = 1 - (minPxY / canvasHeight) * 2;
      rect[2] = (maxPxX / canvasWidth) * 2 - 1;
      rect[3] = 1 - (maxPxY / canvasHeight) * 2;
      const rectMinX = rect[0]!;
      const rectMinY = rect[1]!;
      const rectMaxX = rect[2]!;
      const rectMaxY = rect[3]!;
      const rectWidth = rectMaxX - rectMinX;
      const rectHeight = rectMaxY - rectMinY;

      queue.writeBuffer(uniformBuffer, 0, rect);
      pass.setPipeline(framePipeline);
      pass.setBindGroup(0, frameBindGroup);
      pass.draw(6);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);

      let drawFootprint = true;

      for (let i = 0; i < 4; i += 1) {
        const ndcX = i === 0 || i === 3 ? -1 : 1;
        const ndcY = i < 2 ? -1 : 1;

        if (!screenToGround(camera, ndcX, ndcY, footprintScratch)) {
          drawFootprint = false;
          break;
        }

        const worldX = Math.min(MAP_TILES, Math.max(0, footprintScratch[0]!));
        const worldZ = Math.min(MAP_TILES, Math.max(0, footprintScratch[2]!));
        const offset = i * 2;

        worldToMinimapUnit(worldX, worldZ, footprintStaging, offset);
        footprintStaging[offset] = rectMinX + footprintStaging[offset]! * rectWidth;
        footprintStaging[offset + 1] = rectMinY + footprintStaging[offset + 1]! * rectHeight;
      }

      if (drawFootprint) {
        footprintStaging[8] = footprintStaging[0]!;
        footprintStaging[9] = footprintStaging[1]!;
        queue.writeBuffer(footprintBuffer, 0, footprintStaging);
        pass.setPipeline(footprintPipeline);
        pass.setVertexBuffer(0, footprintBuffer);
        pass.draw(5);
      }

      let dotCount = 0;

      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;

        // Swap-remove reorders dense slots when units die. Interpolating across an
        // identity change would smear one unit's position toward another's; snap instead,
        // one imperceptible frame.
        writeInterpolatedUnitPose(unitPose, prev, curr, i, alpha);
        const x = unitPose[UNIT_POSE_X]!;
        const z = unitPose[UNIT_POSE_Z]!;
        const offset = dotCount * 4;

        worldToMinimapUnit(x, z, dotStaging, offset);
        dotStaging[offset] = rectMinX + dotStaging[offset]! * rectWidth;
        dotStaging[offset + 1] = rectMinY + dotStaging[offset + 1]! * rectHeight;
        dotStaging[offset + 2] = curr.selected[i]!;
        // Neutral resource nodes keep owner 255 so the shader paints them as map features.
        dotStaging[offset + 3] = curr.owner[i]!;
        dotCount += 1;
      }

      // Scale pips with the minimap instead of physical pixels. This preserves the chunky
      // classic look on both standard and high-density displays.
      const dotHalfSizePx = (maxPxX - minPxX) * 0.01;
      dotUniform[0] = (dotHalfSizePx * 2) / canvasWidth;
      dotUniform[1] = (dotHalfSizePx * 2) / canvasHeight;
      queue.writeBuffer(dotBuffer, 0, dotStaging, 0, dotCount * 4);
      queue.writeBuffer(dotUniformBuffer, 0, dotUniform);
      pass.setPipeline(dotPipeline);
      pass.setBindGroup(0, dotBindGroup);
      pass.setVertexBuffer(0, dotBuffer);
      pass.draw(6, dotCount);
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
