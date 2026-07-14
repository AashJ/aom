import {
  GATHER_COOLDOWN_TICKS,
  heightAt,
  MODE_GATHERING,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_MILITIA,
  TYPE_VILLAGER,
  UNIT_TYPES,
  VERTS_PER_ROW,
  type RenderSnapshot,
} from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import * as mat4 from "../math/mat4";
import modelsWgsl from "../shaders/models.wgsl?raw";
import unitsWgsl from "../shaders/units.wgsl?raw";
import {
  MODEL_CONFIGS,
  MODEL_MILITIA_IDLE,
  MODEL_MILITIA_WALK,
  MODEL_VILLAGER_HARVEST,
  MODEL_VILLAGER_IDLE,
  MODEL_VILLAGER_MINE,
  MODEL_VILLAGER_WALK,
} from "./model-assets";
import { loadGlbModel, type ModelAsset } from "./glb";
import {
  MAX_MORPH_TARGETS,
  sampleModelAnimation,
  type ModelAnimationState,
} from "./model-animation";
import { SPRITE_CONFIGS, type SpriteConfig } from "./sprites";

export interface UnitsRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    cameraViewDir: Float32Array,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    heights: Float32Array,
    ghostType: number,
    ghostX: number,
    ghostZ: number,
    ghostValid: boolean,
  ): number;
}

const RING_SEGMENTS = 32;
const RING_INNER = 0.75;
const RING_OUTER = 1.0;
const INSTANCE_FLOATS = 15;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;
const MODEL_INSTANCE_FLOATS = 37;
const MODEL_INSTANCE_STRIDE = MODEL_INSTANCE_FLOATS * 4;
const MODEL_VERTEX_FLOATS = 8;
const MODEL_VERTEX_STRIDE = MODEL_VERTEX_FLOATS * 4;
const SIM_TICK_HZ = 20;
const MOVING_EPSILON_SQ = 1e-8;

interface SpriteTextureData {
  sampler: GPUSampler;
  texture: GPUTexture;
  aspect: number;
  uvFrameWidth: number;
  uvFrameHeight: number;
}

interface SpriteResources extends SpriteTextureData {
  bindGroup: GPUBindGroup;
}

interface GpuModelPrimitive {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexFormat: GPUIndexFormat;
  indexCount: number;
  bindGroup: GPUBindGroup;
}

interface GpuModel {
  asset: ModelAsset;
  primitives: readonly GpuModelPrimitive[];
  attachmentTargetIndex: number;
  attachmentInverse: Float32Array | null;
}

const spriteImages = new Map<string, Promise<ImageBitmap>>();

function spriteIndexFor(snapshot: RenderSnapshot, index: number): number {
  return snapshot.unitType[index]!;
}

function modelIndexFor(snapshot: RenderSnapshot, index: number, moved: boolean): number {
  const type = snapshot.unitType[index]!;

  if (type === TYPE_VILLAGER) {
    if (snapshot.mode[index] === MODE_GATHERING && snapshot.moving[index] === 0) {
      if (snapshot.gatherTargetType[index] === TYPE_GOLD_MINE) return MODEL_VILLAGER_MINE;
      if (snapshot.gatherTargetType[index] === TYPE_BERRY) return MODEL_VILLAGER_HARVEST;
    }

    return moved ? MODEL_VILLAGER_WALK : MODEL_VILLAGER_IDLE;
  }

  if (type === TYPE_MILITIA) return moved ? MODEL_MILITIA_WALK : MODEL_MILITIA_IDLE;
  return -1;
}

function loadSpriteImage(config: SpriteConfig): Promise<ImageBitmap> | null {
  if (config.url === null) return null;

  let image = spriteImages.get(config.url);

  if (!image) {
    image = fetch(config.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load sprite ${config.url}: ${response.status}`);
        }

        return response.blob();
      })
      .then((blob) => createImageBitmap(blob));
    spriteImages.set(config.url, image);
  }

  return image;
}

function createSpriteTexture(
  device: GPUDevice,
  sampler: GPUSampler,
  image: ImageBitmap | null,
  config: SpriteConfig,
): SpriteTextureData {
  const width = image?.width ?? 1;
  const height = image?.height ?? 1;
  const texture = device.createTexture({
    size: [width, height],
    format: "rgba8unorm",
    // copyExternalImageToTexture requires RENDER_ATTACHMENT on the destination
    // (the browser may blit through a render pass); without it the copy fails
    // validation and the texture stays zeroed.
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  if (image) {
    device.queue.copyExternalImageToTexture({ source: image }, { texture }, { width, height });
  } else {
    device.queue.writeTexture(
      { texture },
      new Uint8Array(4),
      { bytesPerRow: 4 },
      { width: 1, height: 1 },
    );
  }

  return {
    sampler,
    texture,
    aspect: image ? image.width / config.columns / (image.height / config.directions) : 1,
    uvFrameWidth: 1 / config.columns,
    uvFrameHeight: 1 / config.directions,
  };
}

async function createSpriteTextures(
  device: GPUDevice,
  sampler: GPUSampler,
): Promise<SpriteTextureData[]> {
  const images = await Promise.all(
    SPRITE_CONFIGS.map((config) => loadSpriteImage(config) ?? Promise.resolve(null)),
  );

  return images.map((image, spriteIndex) =>
    createSpriteTexture(device, sampler, image, SPRITE_CONFIGS[spriteIndex]!),
  );
}

export async function createUnitsRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  heights: Float32Array,
): Promise<UnitsRenderer> {
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const [spriteTextures, modelAssets] = await Promise.all([
    createSpriteTextures(device, sampler),
    Promise.all(MODEL_CONFIGS.map((config) => loadGlbModel(config.url))),
  ]);
  const verts = [
    // local xy, uv, part (0 = sprite, 1 = ring, 2 = hp)
    -0.5, 0, 0, 1, 0, 0.5, 0, 1, 1, 0, 0.5, 1, 1, 0, 0, -0.5, 1, 0, 0, 0,
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

  const hpBase = verts.length / 5;
  verts.push(-0.55, 2.35, 0, 0, 2);
  verts.push(0.55, 2.35, 1, 0, 2);
  verts.push(0.55, 2.5, 1, 0, 2);
  verts.push(-0.55, 2.5, 0, 0, 2);
  indices.push(hpBase, hpBase + 1, hpBase + 2, hpBase, hpBase + 2, hpBase + 3);

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
  const instanceCapacity = maxInstances + 1;
  const instanceBuffer = device.createBuffer({
    size: instanceCapacity * INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(instanceCapacity * INSTANCE_FLOATS);
  const spriteCounts = new Uint32Array(SPRITE_CONFIGS.length);
  const spriteFirstInstances = new Uint32Array(SPRITE_CONFIGS.length);
  const spriteWriteOffsets = new Uint32Array(SPRITE_CONFIGS.length);
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
          arrayStride: INSTANCE_STRIDE,
          // stepMode "instance" advances this buffer once per instance, not per vertex;
          // that is the whole trick of instancing.
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 3 },
            { format: "float32", offset: 12, shaderLocation: 4 },
            { format: "float32", offset: 16, shaderLocation: 5 },
            { format: "float32", offset: 20, shaderLocation: 6 },
            { format: "float32", offset: 24, shaderLocation: 7 },
            { format: "float32", offset: 28, shaderLocation: 8 },
            { format: "float32", offset: 32, shaderLocation: 9 },
            { format: "float32", offset: 36, shaderLocation: 10 },
            { format: "float32", offset: 40, shaderLocation: 11 },
            { format: "float32", offset: 44, shaderLocation: 12 },
            { format: "float32", offset: 48, shaderLocation: 13 },
            { format: "float32", offset: 52, shaderLocation: 14 },
            { format: "float32", offset: 56, shaderLocation: 15 },
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
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  const heightView = heightTexture.createView();
  const spriteResources: SpriteResources[] = spriteTextures.map((sprite) => ({
    ...sprite,
    bindGroup: device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: heightView },
        { binding: 2, resource: sprite.sampler },
        { binding: 3, resource: sprite.texture.createView() },
      ],
    }),
  }));

  const modelModule = device.createShaderModule({ code: modelsWgsl });
  const modelUniformStaging = new Float32Array(16);
  const modelUniformBuffer = device.createBuffer({
    size: modelUniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const modelPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: modelModule,
      buffers: [
        {
          arrayStride: MODEL_VERTEX_STRIDE,
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 0 },
            { format: "float32x3", offset: 12, shaderLocation: 1 },
            { format: "float32x2", offset: 24, shaderLocation: 2 },
          ],
        },
        {
          arrayStride: MODEL_INSTANCE_STRIDE,
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 3 },
            { format: "float32x2", offset: 12, shaderLocation: 4 },
            { format: "float32x4", offset: 20, shaderLocation: 5 },
            { format: "float32x4", offset: 36, shaderLocation: 6 },
            { format: "float32x4", offset: 52, shaderLocation: 7 },
            { format: "float32x4", offset: 68, shaderLocation: 8 },
            { format: "float32x4", offset: 84, shaderLocation: 9 },
            { format: "float32x4", offset: 100, shaderLocation: 10 },
            { format: "float32x4", offset: 116, shaderLocation: 11 },
            { format: "float32x4", offset: 132, shaderLocation: 12 },
          ],
        },
      ],
    },
    fragment: {
      module: modelModule,
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
  const modelGlobalBindGroup = device.createBindGroup({
    layout: modelPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: modelUniformBuffer } }],
  });
  const modelPrimitiveBindGroupLayout = modelPipeline.getBindGroupLayout(1);
  const gpuModels: GpuModel[] = [];

  for (let modelIndex = 0; modelIndex < modelAssets.length; modelIndex += 1) {
    const asset = modelAssets[modelIndex]!;
    const materialTextures = asset.materials.map((material) => {
      const width = material.image?.width ?? 1;
      const height = material.image?.height ?? 1;
      const texture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      if (material.image) {
        device.queue.copyExternalImageToTexture(
          { source: material.image },
          { texture, premultipliedAlpha: false },
          { width, height },
        );
      } else {
        device.queue.writeTexture(
          { texture },
          new Uint8Array([255, 255, 255, 255]),
          { bytesPerRow: 4 },
          { width: 1, height: 1 },
        );
      }

      return texture;
    });
    const primitives: GpuModelPrimitive[] = [];

    for (const primitive of asset.primitives) {
      const vertexCount = primitive.positions.length / 3;
      const vertexData = new Float32Array(vertexCount * MODEL_VERTEX_FLOATS);

      for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        const output = vertex * MODEL_VERTEX_FLOATS;
        vertexData[output] = primitive.positions[vertex * 3]!;
        vertexData[output + 1] = primitive.positions[vertex * 3 + 1]!;
        vertexData[output + 2] = primitive.positions[vertex * 3 + 2]!;
        vertexData[output + 3] = primitive.normals[vertex * 3]!;
        vertexData[output + 4] = primitive.normals[vertex * 3 + 1]!;
        vertexData[output + 5] = primitive.normals[vertex * 3 + 2]!;
        vertexData[output + 6] = primitive.texcoords[vertex * 2]!;
        vertexData[output + 7] = primitive.texcoords[vertex * 2 + 1]!;
      }

      const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      const indexBuffer = device.createBuffer({
        size: primitive.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      const morphCount = primitive.morphPositions.length;
      const morphValueCount = Math.max(1, morphCount * vertexCount);
      const morphPositions = new Float32Array(morphValueCount * 4);
      const morphNormals = new Float32Array(morphValueCount * 4);

      for (let target = 0; target < morphCount; target += 1) {
        const positionDelta = primitive.morphPositions[target]!;
        const normalDelta = primitive.morphNormals[target]!;

        for (let vertex = 0; vertex < vertexCount; vertex += 1) {
          const output = (target * vertexCount + vertex) * 4;
          morphPositions[output] = positionDelta[vertex * 3]!;
          morphPositions[output + 1] = positionDelta[vertex * 3 + 1]!;
          morphPositions[output + 2] = positionDelta[vertex * 3 + 2]!;
          morphNormals[output] = normalDelta[vertex * 3]!;
          morphNormals[output + 1] = normalDelta[vertex * 3 + 1]!;
          morphNormals[output + 2] = normalDelta[vertex * 3 + 2]!;
        }
      }

      const morphPositionBuffer = device.createBuffer({
        size: morphPositions.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      const morphNormalBuffer = device.createBuffer({
        size: morphNormals.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      const material = asset.materials[primitive.materialIndex]!;
      const materialData = new ArrayBuffer(16);
      const materialView = new DataView(materialData);
      materialView.setUint32(0, vertexCount, true);
      materialView.setUint32(4, morphCount, true);
      materialView.setFloat32(8, material.playerColor ? 1 : 0, true);
      materialView.setFloat32(12, material.alphaCutoff, true);
      const materialBuffer = device.createBuffer({
        size: materialData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(vertexBuffer, 0, vertexData);
      device.queue.writeBuffer(indexBuffer, 0, primitive.indices);
      device.queue.writeBuffer(morphPositionBuffer, 0, morphPositions);
      device.queue.writeBuffer(morphNormalBuffer, 0, morphNormals);
      device.queue.writeBuffer(materialBuffer, 0, materialData);
      primitives.push({
        vertexBuffer,
        indexBuffer,
        indexFormat: primitive.indices instanceof Uint32Array ? "uint32" : "uint16",
        indexCount: primitive.indices.length,
        bindGroup: device.createBindGroup({
          layout: modelPrimitiveBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: morphPositionBuffer } },
            { binding: 1, resource: { buffer: morphNormalBuffer } },
            { binding: 2, resource: sampler },
            { binding: 3, resource: materialTextures[primitive.materialIndex]!.createView() },
            { binding: 4, resource: { buffer: materialBuffer } },
          ],
        }),
      });
    }

    gpuModels.push({
      asset,
      primitives,
      attachmentTargetIndex: -1,
      attachmentInverse: null,
    });
  }

  const hotspotState: ModelAnimationState = {
    weights: new Float32Array(MAX_MORPH_TARGETS),
    nodeMatrix: mat4.create(),
  };

  for (let modelIndex = 0; modelIndex < MODEL_CONFIGS.length; modelIndex += 1) {
    const attachment = MODEL_CONFIGS[modelIndex]!.attachment;
    if (!attachment) continue;

    const model = gpuModels[modelIndex]!;
    const attachmentModel = gpuModels[attachment.modelIndex]!;
    model.attachmentTargetIndex =
      model.asset.nodeIndexByName.get(attachment.targetNode.toLowerCase()) ?? -1;
    const hotspotIndex =
      attachmentModel.asset.nodeIndexByName.get(attachment.hotspotNode.toLowerCase()) ?? -1;
    sampleModelAnimation(attachmentModel.asset, 0, hotspotIndex, hotspotState);
    const inverse = mat4.create();

    if (hotspotIndex >= 0 && mat4.invert(inverse, hotspotState.nodeMatrix)) {
      model.attachmentInverse = inverse;
    }
  }

  const modelInstanceCapacity = maxInstances * 2;
  const modelInstanceBuffer = device.createBuffer({
    size: modelInstanceCapacity * MODEL_INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const modelStaging = new Float32Array(modelInstanceCapacity * MODEL_INSTANCE_FLOATS);
  const modelCounts = new Uint32Array(MODEL_CONFIGS.length);
  const modelFirstInstances = new Uint32Array(MODEL_CONFIGS.length);
  const modelWriteOffsets = new Uint32Array(MODEL_CONFIGS.length);
  const modelAnimationState: ModelAnimationState = {
    weights: new Float32Array(MAX_MORPH_TARGETS),
    nodeMatrix: mat4.create(),
  };
  const attachmentAnimationState: ModelAnimationState = {
    weights: new Float32Array(MAX_MORPH_TARGETS),
    nodeMatrix: mat4.create(),
  };
  const attachmentMatrix = mat4.create();

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
    draw(
      pass,
      queue,
      viewProj,
      _cameraViewDir,
      prev,
      curr,
      alpha,
      heights,
      ghostType,
      ghostX,
      ghostZ,
      ghostValid,
    ): number {
      spriteCounts.fill(0);
      modelCounts.fill(0);

      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;
        const spriteIndex = spriteIndexFor(curr, i);
        spriteCounts[spriteIndex] = spriteCounts[spriteIndex]! + 1;

        const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
        const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
        const dx = curr.posX[i]! - prevX;
        const dz = curr.posZ[i]! - prevZ;
        const modelIndex = modelIndexFor(curr, i, dx * dx + dz * dz > MOVING_EPSILON_SQ);

        if (modelIndex >= 0) {
          modelCounts[modelIndex] = modelCounts[modelIndex]! + 1;
          const attachment = MODEL_CONFIGS[modelIndex]!.attachment;
          if (attachment) {
            modelCounts[attachment.modelIndex] = modelCounts[attachment.modelIndex]! + 1;
          }
        }
      }

      // Counting sort like the sim's grid build: count per asset, prefix, then scatter.
      let totalInstances = 0;
      for (let spriteIndex = 0; spriteIndex < spriteCounts.length; spriteIndex += 1) {
        spriteFirstInstances[spriteIndex] = totalInstances;
        spriteWriteOffsets[spriteIndex] = totalInstances;
        totalInstances += spriteCounts[spriteIndex]!;
      }

      let totalModelInstances = 0;
      for (let modelIndex = 0; modelIndex < modelCounts.length; modelIndex += 1) {
        modelFirstInstances[modelIndex] = totalModelInstances;
        modelWriteOffsets[modelIndex] = totalModelInstances;
        totalModelInstances += modelCounts[modelIndex]!;
      }

      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;

        // Swap-remove reorders dense slots when units die. Interpolating across an
        // identity change would smear one unit's position toward another's; snap instead.
        const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
        const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
        const x = prevX + (curr.posX[i]! - prevX) * alpha;
        const z = prevZ + (curr.posZ[i]! - prevZ) * alpha;
        const type = curr.unitType[i]!;
        const ts = UNIT_TYPES[type]!;
        const spriteIndex = spriteIndexFor(curr, i);
        const config = SPRITE_CONFIGS[spriteIndex]!;
        const sprite = spriteResources[spriteIndex]!;
        const instanceIndex = spriteWriteOffsets[spriteIndex]!;
        const offset = instanceIndex * INSTANCE_FLOATS;
        const buildFrac =
          ts.buildTicks > 0 ? Math.min(1, curr.buildProgress[i]! / ts.buildTicks) : 1;
        let frame = config.idleFrame;

        if (config.staticFrames === "variation") {
          frame = curr.ids[i]! % config.columns;
        } else if (config.staticFrames === "depletion") {
          const depletionFrame = Math.floor((1 - curr.hp[i]! / ts.maxHp) * config.columns);
          frame = Math.min(config.columns - 1, Math.max(0, depletionFrame));
        }

        spriteWriteOffsets[spriteIndex] = instanceIndex + 1;
        staging[offset] = x;
        staging[offset + 1] = heightAt(heights, x, z);
        staging[offset + 2] = z;
        staging[offset + 3] = curr.selected[i]!;
        staging[offset + 4] = curr.owner[i]!;
        staging[offset + 5] = curr.hp[i]! / ts.maxHp;
        staging[offset + 6] = frame * sprite.uvFrameWidth;
        staging[offset + 7] = sprite.uvFrameWidth;
        staging[offset + 8] = config.worldHeight * sprite.aspect;
        staging[offset + 9] = config.worldHeight - config.bottomPadding;
        staging[offset + 10] = buildFrac;
        staging[offset + 11] = ts.footprint > 0 ? 0 : 1;
        staging[offset + 12] = 1 - config.bottomPadding / config.worldHeight;
        staging[offset + 13] = 0;
        staging[offset + 14] = sprite.uvFrameHeight;

        const dx = curr.posX[i]! - prevX;
        const dz = curr.posZ[i]! - prevZ;
        const modelIndex = modelIndexFor(curr, i, dx * dx + dz * dz > MOVING_EPSILON_SQ);
        if (modelIndex < 0) continue;

        const gpuModel = gpuModels[modelIndex]!;
        const modelConfig = MODEL_CONFIGS[modelIndex]!;
        const prevFacingX = aligned ? prev.facingX[i]! : curr.facingX[i]!;
        const prevFacingZ = aligned ? prev.facingZ[i]! : curr.facingZ[i]!;
        let facingX = prevFacingX + (curr.facingX[i]! - prevFacingX) * alpha;
        let facingZ = prevFacingZ + (curr.facingZ[i]! - prevFacingZ) * alpha;
        const facingLength = Math.sqrt(facingX * facingX + facingZ * facingZ);

        if (facingLength > 1e-6) {
          facingX /= facingLength;
          facingZ /= facingLength;
        } else {
          facingX = curr.facingX[i]!;
          facingZ = curr.facingZ[i]!;
        }

        let animationTime: number;
        if (modelIndex === MODEL_VILLAGER_MINE || modelIndex === MODEL_VILLAGER_HARVEST) {
          const elapsedTicks = Math.min(
            GATHER_COOLDOWN_TICKS,
            Math.max(0, GATHER_COOLDOWN_TICKS - curr.actionCooldown[i]! + alpha),
          );
          animationTime =
            gpuModel.asset.duration * (elapsedTicks / Math.max(1, GATHER_COOLDOWN_TICKS));
        } else {
          animationTime = (curr.tick + alpha) / SIM_TICK_HZ + (curr.ids[i]! % 17) * 0.037;
        }

        sampleModelAnimation(gpuModel.asset, animationTime, -1, modelAnimationState);
        const modelInstanceIndex = modelWriteOffsets[modelIndex]!;
        const modelOffset = modelInstanceIndex * MODEL_INSTANCE_FLOATS;
        modelWriteOffsets[modelIndex] = modelInstanceIndex + 1;
        modelStaging[modelOffset] = x;
        modelStaging[modelOffset + 1] =
          heightAt(heights, x, z) + (modelConfig.grounded ? gpuModel.asset.groundOffset : 0);
        modelStaging[modelOffset + 2] = z;
        modelStaging[modelOffset + 3] = facingX;
        modelStaging[modelOffset + 4] = facingZ;
        modelStaging[modelOffset + 5] = curr.selected[i]!;
        modelStaging[modelOffset + 6] = curr.owner[i]!;
        modelStaging[modelOffset + 7] = buildFrac;
        modelStaging[modelOffset + 8] = 0;
        modelStaging.set(modelAnimationState.weights, modelOffset + 9);
        modelStaging.set(modelAnimationState.nodeMatrix, modelOffset + 21);

        const attachment = modelConfig.attachment;
        if (!attachment || gpuModel.attachmentTargetIndex < 0 || !gpuModel.attachmentInverse) {
          continue;
        }

        sampleModelAnimation(
          gpuModel.asset,
          animationTime,
          gpuModel.attachmentTargetIndex,
          attachmentAnimationState,
        );
        mat4.multiply(
          attachmentMatrix,
          attachmentAnimationState.nodeMatrix,
          gpuModel.attachmentInverse,
        );
        const attachmentInstanceIndex = modelWriteOffsets[attachment.modelIndex]!;
        const attachmentOffset = attachmentInstanceIndex * MODEL_INSTANCE_FLOATS;
        modelWriteOffsets[attachment.modelIndex] = attachmentInstanceIndex + 1;
        modelStaging[attachmentOffset] = x;
        modelStaging[attachmentOffset + 1] = heightAt(heights, x, z) + gpuModel.asset.groundOffset;
        modelStaging[attachmentOffset + 2] = z;
        modelStaging[attachmentOffset + 3] = facingX;
        modelStaging[attachmentOffset + 4] = facingZ;
        modelStaging[attachmentOffset + 5] = curr.selected[i]!;
        modelStaging[attachmentOffset + 6] = curr.owner[i]!;
        modelStaging[attachmentOffset + 7] = buildFrac;
        modelStaging[attachmentOffset + 8] = 0;
        modelStaging.fill(0, attachmentOffset + 9, attachmentOffset + 21);
        modelStaging.set(attachmentMatrix, attachmentOffset + 21);
      }

      let ghostFirstInstance = -1;

      if (ghostType >= 0) {
        const config = SPRITE_CONFIGS[ghostType];
        const sprite = spriteResources[ghostType];

        if (config && sprite) {
          ghostFirstInstance = totalInstances;

          const offset = ghostFirstInstance * INSTANCE_FLOATS;

          staging[offset] = ghostX;
          staging[offset + 1] = heightAt(heights, ghostX, ghostZ);
          staging[offset + 2] = ghostZ;
          staging[offset + 3] = 0;
          // Ghost tint is neutral; the owner slot is unused for negative hpFrac instances.
          staging[offset + 4] = 0;
          // Negative hpFrac is the ghost sentinel — one overloaded channel instead of a new attribute.
          staging[offset + 5] = ghostValid ? -1 : -2;
          staging[offset + 6] = 0;
          staging[offset + 7] = sprite.uvFrameWidth;
          staging[offset + 8] = config.worldHeight * sprite.aspect;
          staging[offset + 9] = config.worldHeight - config.bottomPadding;
          staging[offset + 10] = 1;
          staging[offset + 11] = UNIT_TYPES[ghostType]!.footprint > 0 ? 0 : 1;
          staging[offset + 12] = 1 - config.bottomPadding / config.worldHeight;
          staging[offset + 13] = 0;
          staging[offset + 14] = sprite.uvFrameHeight;
          totalInstances += 1;
        }
      }

      if (totalModelInstances > 0) {
        queue.writeBuffer(
          modelInstanceBuffer,
          0,
          modelStaging,
          0,
          totalModelInstances * MODEL_INSTANCE_FLOATS,
        );
        modelUniformStaging.set(viewProj);
        queue.writeBuffer(modelUniformBuffer, 0, modelUniformStaging);
        pass.setPipeline(modelPipeline);
        pass.setBindGroup(0, modelGlobalBindGroup);
        pass.setVertexBuffer(1, modelInstanceBuffer);

        for (let modelIndex = 0; modelIndex < gpuModels.length; modelIndex += 1) {
          const modelCount = modelCounts[modelIndex]!;
          if (modelCount === 0) continue;

          for (const primitive of gpuModels[modelIndex]!.primitives) {
            pass.setVertexBuffer(0, primitive.vertexBuffer);
            pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
            pass.setBindGroup(1, primitive.bindGroup);
            pass.drawIndexed(
              primitive.indexCount,
              modelCount,
              0,
              0,
              modelFirstInstances[modelIndex]!,
            );
          }
        }
      }

      queue.writeBuffer(instanceBuffer, 0, staging, 0, totalInstances * INSTANCE_FLOATS);
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
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      for (let spriteIndex = 0; spriteIndex < spriteCounts.length; spriteIndex += 1) {
        const spriteCount = spriteCounts[spriteIndex]!;

        if (spriteCount === 0) {
          continue;
        }

        pass.setBindGroup(0, spriteResources[spriteIndex]!.bindGroup);
        pass.drawIndexed(indexData.length, spriteCount, 0, 0, spriteFirstInstances[spriteIndex]!);
      }

      if (ghostFirstInstance >= 0) {
        pass.setBindGroup(0, spriteResources[ghostType]!.bindGroup);
        // Ghosts render with indices 0-5 only, so the negative hpFrac sentinel cannot reach ring/hp-bar geometry.
        pass.drawIndexed(6, 1, 0, 0, ghostFirstInstance);
      }

      return totalInstances;
    },
  };
}
