import { heightAt, VERTS_PER_ROW, type RenderSnapshot } from "@aom/sim";
import villagerSpriteUrl from "../assets/villager-walk.png";
import { DEPTH_FORMAT } from "../gpu/device";
import unitsWgsl from "../shaders/units.wgsl?raw";
import { VILLAGER_ATLAS_COLUMNS, villagerAnimationFrame } from "./unit-animation";

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
const SPRITE_HEIGHT = 2.2;

let villagerImage: Promise<ImageBitmap> | undefined;

function loadVillagerImage(): Promise<ImageBitmap> {
  villagerImage ??= fetch(villagerSpriteUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load villager sprite: ${response.status}`);
      }

      return response.blob();
    })
    .then((blob) => createImageBitmap(blob));

  return villagerImage;
}

async function createSpriteTexture(device: GPUDevice): Promise<{
  sampler: GPUSampler;
  texture: GPUTexture;
  width: number;
  height: number;
}> {
  const image = await loadVillagerImage();
  const texture = device.createTexture({
    size: [image.width, image.height],
    format: "rgba8unorm",
    // copyExternalImageToTexture requires RENDER_ATTACHMENT on the destination
    // (the browser may blit through a render pass); without it the copy fails
    // validation and the texture stays zeroed.
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: image },
    { texture },
    { width: image.width, height: image.height },
  );

  return {
    sampler: device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    }),
    texture,
    width: image.width,
    height: image.height,
  };
}

export async function createUnitsRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  heights: Float32Array,
): Promise<UnitsRenderer> {
  const sprite = await createSpriteTexture(device);
  const spriteCellWidth = sprite.width / VILLAGER_ATLAS_COLUMNS;
  const spriteWidth = SPRITE_HEIGHT * (spriteCellWidth / sprite.height);
  const verts = [
    // local xy, uv, part (0 = sprite, 1 = ring)
    -spriteWidth * 0.5,
    0,
    0,
    1,
    0,
    spriteWidth * 0.5,
    0,
    1,
    1,
    0,
    spriteWidth * 0.5,
    SPRITE_HEIGHT,
    1,
    0,
    0,
    -spriteWidth * 0.5,
    SPRITE_HEIGHT,
    0,
    0,
    0,
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  const ringBase = verts.length / 5;

  // The old flat ring quad used the unit-center height; across 0.6 world units of sloped terrain
  // its uphill arc dipped under the ground and depth-failed, so the vertex shader drapes this annulus.
  for (let s = 0; s <= RING_SEGMENTS; s += 1) {
    const angle = (s / RING_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    verts.push(cos * RING_INNER, sin * RING_INNER, 0, 0, 1);
    verts.push(cos * RING_OUTER, sin * RING_OUTER, 0, 0, 1);
  }

  for (let s = 0; s < RING_SEGMENTS; s += 1) {
    const i0 = ringBase + s * 2;
    const o0 = i0 + 1;
    const i1 = i0 + 2;
    const o1 = i0 + 3;

    indices.push(i0, i1, o1, i0, o1, o0);
  }

  const vertexData = new Float32Array(verts);
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
    size: maxInstances * 24,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(maxInstances * 6);
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
  const module = device.createShaderModule({ code: unitsWgsl });
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
          arrayStride: 24,
          // stepMode "instance" advances this buffer once per instance, not per vertex;
          // that is the whole trick of instancing.
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 3 },
            { format: "float32", offset: 12, shaderLocation: 4 },
            { format: "float32", offset: 16, shaderLocation: 5 },
            { format: "float32", offset: 20, shaderLocation: 6 },
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
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: heightTexture.createView() },
      { binding: 2, resource: sprite.sampler },
      { binding: 3, resource: sprite.texture.createView() },
    ],
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
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
        // Swap-remove reorders dense slots when units die. Interpolating across an
        // identity change would smear one unit's position toward another's; snap instead,
        // one imperceptible frame.
        const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
        const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
        // Snapshot interpolation is why the double buffer exists: 20 Hz sim ticks can render
        // smoothly at arbitrary display refresh rates.
        const x = prevX + (curr.posX[i]! - prevX) * alpha;
        const z = prevZ + (curr.posZ[i]! - prevZ) * alpha;
        const offset = i * 6;

        staging[offset] = x;
        staging[offset + 1] = heightAt(heights, x, z);
        staging[offset + 2] = z;
        staging[offset + 3] = curr.selected[i]!;
        staging[offset + 4] = villagerAnimationFrame({
          prevX,
          prevZ,
          currX: curr.posX[i]!,
          currZ: curr.posZ[i]!,
          tick: curr.tick,
          alpha,
          unitIndex: i,
        });
        staging[offset + 5] = curr.owner[i]!;
      }

      queue.writeBuffer(instanceBuffer, 0, staging, 0, curr.count * 6);
      uniformStaging.set(viewProj);
      // Camera basis from the world-to-view matrix, packed as vec3 + padding each.
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
      // The sprite body and draped ring still ride in one instanced draw.
      pass.drawIndexed(indexData.length, curr.count);
      return curr.count;
    },
  };
}
