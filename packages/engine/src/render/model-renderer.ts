import { UNIT_TYPES, heightAt, type RenderSnapshot } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import * as mat4 from "../math/mat4";
import modelsWgsl from "../shaders/models.wgsl?raw";
import { loadClassicModelGlb, type ModelAsset } from "./glb";
import {
  MAX_MORPH_TARGETS,
  sampleModelAnimation,
  type ModelAnimationState,
} from "./model-animation";
import { MODEL_CONFIGS } from "./model-assets";
import { recordDraw, resetRendererStatistics, type RendererStatistics } from "./render-statistics";
import { modelAnimationTime, resolveModelPresentation } from "./unit-presentation";

const INSTANCE_FLOATS = 37;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;
const VERTEX_FLOATS = 8;
const VERTEX_STRIDE = VERTEX_FLOATS * 4;
const MATERIAL_ALPHA_MASK = 1 << 0;
const MATERIAL_MULTIPLY_PLAYER_COLOR = 1 << 1;
const MOVING_EPSILON_SQ = 1e-8;

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

export interface ModelRenderer {
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

function uploadModel(
  device: GPUDevice,
  sampler: GPUSampler,
  primitiveBindGroupLayout: GPUBindGroupLayout,
  asset: ModelAsset,
): GpuModel {
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
    const vertexData = new Float32Array(vertexCount * VERTEX_FLOATS);

    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const output = vertex * VERTEX_FLOATS;
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

    for (let targetIndex = 0; targetIndex < morphCount; targetIndex += 1) {
      const positionDelta = primitive.morphPositions[targetIndex]!;
      const normalDelta = primitive.morphNormals[targetIndex]!;

      for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        const output = (targetIndex * vertexCount + vertex) * 4;
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
    const materialFlags =
      (material.alpha.mode === "mask" ? MATERIAL_ALPHA_MASK : 0) |
      (material.pixelTransform === "multiply-player-color"
        ? MATERIAL_MULTIPLY_PLAYER_COLOR
        : 0);
    materialView.setUint32(0, vertexCount, true);
    materialView.setUint32(4, morphCount, true);
    materialView.setUint32(8, materialFlags, true);
    materialView.setFloat32(12, material.alpha.mode === "mask" ? material.alpha.cutoff : 0, true);
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
        layout: primitiveBindGroupLayout,
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

  return { asset, primitives, attachmentTargetIndex: -1, attachmentInverse: null };
}

export async function createModelRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
): Promise<ModelRenderer> {
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const assets = await Promise.all(
    MODEL_CONFIGS.map((config, modelIndex) =>
      loadClassicModelGlb(config.url, {
        requiredNodes: [
          ...(config.attachment ? [config.attachment.targetNode] : []),
          ...MODEL_CONFIGS.flatMap((owner) =>
            owner.attachment?.modelIndex === modelIndex ? [owner.attachment.hotspotNode] : [],
          ),
        ],
      }),
    ),
  );
  const module = device.createShaderModule({ code: modelsWgsl });
  const uniformStaging = new Float32Array(16);
  const uniformBuffer = device.createBuffer({
    size: uniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: VERTEX_STRIDE,
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 0 },
            { format: "float32x3", offset: 12, shaderLocation: 1 },
            { format: "float32x2", offset: 24, shaderLocation: 2 },
          ],
        },
        {
          arrayStride: INSTANCE_STRIDE,
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
  const globalBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const primitiveBindGroupLayout = pipeline.getBindGroupLayout(1);
  const models = assets.map((asset) =>
    uploadModel(device, sampler, primitiveBindGroupLayout, asset),
  );
  const hotspotState: ModelAnimationState = {
    weights: new Float32Array(MAX_MORPH_TARGETS),
    nodeMatrix: mat4.create(),
  };

  for (let modelIndex = 0; modelIndex < MODEL_CONFIGS.length; modelIndex += 1) {
    const attachment = MODEL_CONFIGS[modelIndex]!.attachment;
    if (!attachment) continue;

    const model = models[modelIndex]!;
    const attachmentModel = models[attachment.modelIndex]!;
    model.attachmentTargetIndex = model.asset.nodeIndexByName.get(
      attachment.targetNode.toLowerCase(),
    )!;
    const hotspotIndex = attachmentModel.asset.nodeIndexByName.get(
      attachment.hotspotNode.toLowerCase(),
    )!;
    sampleModelAnimation(attachmentModel.asset, 0, hotspotIndex, hotspotState);
    const inverse = mat4.create();
    if (mat4.invert(inverse, hotspotState.nodeMatrix)) {
      model.attachmentInverse = inverse;
    }
  }

  const instanceCapacity = maxInstances * 2;
  const instanceBuffer = device.createBuffer({
    size: instanceCapacity * INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(instanceCapacity * INSTANCE_FLOATS);
  const counts = new Uint32Array(MODEL_CONFIGS.length);
  const firstInstances = new Uint32Array(MODEL_CONFIGS.length);
  const writeOffsets = new Uint32Array(MODEL_CONFIGS.length);
  const animationState: ModelAnimationState = {
    weights: new Float32Array(MAX_MORPH_TARGETS),
    nodeMatrix: mat4.create(),
  };
  const attachmentAnimationState: ModelAnimationState = {
    weights: new Float32Array(MAX_MORPH_TARGETS),
    nodeMatrix: mat4.create(),
  };
  const attachmentMatrix = mat4.create();
  const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };

  return {
    draw(pass, queue, viewProj, prev, curr, alpha, heights): RendererStatistics {
      resetRendererStatistics(statistics);
      counts.fill(0);

      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;
        const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
        const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
        const dx = curr.posX[i]! - prevX;
        const dz = curr.posZ[i]! - prevZ;
        const presentation = resolveModelPresentation(
          curr,
          i,
          dx * dx + dz * dz > MOVING_EPSILON_SQ,
        );
        if (!presentation) continue;

        counts[presentation.modelIndex] = counts[presentation.modelIndex]! + 1;
        const attachment = MODEL_CONFIGS[presentation.modelIndex]!.attachment;
        if (attachment) counts[attachment.modelIndex] = counts[attachment.modelIndex]! + 1;
      }

      let totalInstances = 0;
      for (let modelIndex = 0; modelIndex < counts.length; modelIndex += 1) {
        firstInstances[modelIndex] = totalInstances;
        writeOffsets[modelIndex] = totalInstances;
        totalInstances += counts[modelIndex]!;
      }

      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;
        const aligned = i < prev.count && prev.ids[i] === curr.ids[i];
        const prevX = aligned ? prev.posX[i]! : curr.posX[i]!;
        const prevZ = aligned ? prev.posZ[i]! : curr.posZ[i]!;
        const dx = curr.posX[i]! - prevX;
        const dz = curr.posZ[i]! - prevZ;
        const presentation = resolveModelPresentation(
          curr,
          i,
          dx * dx + dz * dz > MOVING_EPSILON_SQ,
        );
        if (!presentation) continue;

        const x = prevX + dx * alpha;
        const z = prevZ + dz * alpha;
        const typeStats = UNIT_TYPES[curr.unitType[i]!]!;
        const buildFrac =
          typeStats.buildTicks > 0 ? Math.min(1, curr.buildProgress[i]! / typeStats.buildTicks) : 1;
        const modelIndex = presentation.modelIndex;
        const model = models[modelIndex]!;
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

        const animationTime = modelAnimationTime(
          presentation,
          curr,
          i,
          alpha,
          model.asset.duration,
        );
        sampleModelAnimation(model.asset, animationTime, -1, animationState);
        const instanceIndex = writeOffsets[modelIndex]!;
        const offset = instanceIndex * INSTANCE_FLOATS;
        writeOffsets[modelIndex] = instanceIndex + 1;
        staging[offset] = x;
        staging[offset + 1] =
          heightAt(heights, x, z) + (modelConfig.grounded ? model.asset.groundOffset : 0);
        staging[offset + 2] = z;
        staging[offset + 3] = facingX;
        staging[offset + 4] = facingZ;
        staging[offset + 5] = curr.selected[i]!;
        staging[offset + 6] = curr.owner[i]!;
        staging[offset + 7] = buildFrac;
        staging[offset + 8] = 0;
        staging.set(animationState.weights, offset + 9);
        staging.set(animationState.nodeMatrix, offset + 21);

        const attachment = modelConfig.attachment;
        if (!attachment || model.attachmentTargetIndex < 0 || !model.attachmentInverse) continue;

        sampleModelAnimation(
          model.asset,
          animationTime,
          model.attachmentTargetIndex,
          attachmentAnimationState,
        );
        mat4.multiply(
          attachmentMatrix,
          attachmentAnimationState.nodeMatrix,
          model.attachmentInverse,
        );
        const attachmentIndex = writeOffsets[attachment.modelIndex]!;
        const attachmentOffset = attachmentIndex * INSTANCE_FLOATS;
        writeOffsets[attachment.modelIndex] = attachmentIndex + 1;
        staging[attachmentOffset] = x;
        staging[attachmentOffset + 1] = heightAt(heights, x, z) + model.asset.groundOffset;
        staging[attachmentOffset + 2] = z;
        staging[attachmentOffset + 3] = facingX;
        staging[attachmentOffset + 4] = facingZ;
        staging[attachmentOffset + 5] = curr.selected[i]!;
        staging[attachmentOffset + 6] = curr.owner[i]!;
        staging[attachmentOffset + 7] = buildFrac;
        staging[attachmentOffset + 8] = 0;
        staging.fill(0, attachmentOffset + 9, attachmentOffset + 21);
        staging.set(attachmentMatrix, attachmentOffset + 21);
      }

      if (totalInstances === 0) return statistics;
      queue.writeBuffer(instanceBuffer, 0, staging, 0, totalInstances * INSTANCE_FLOATS);
      uniformStaging.set(viewProj);
      queue.writeBuffer(uniformBuffer, 0, uniformStaging);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, globalBindGroup);
      pass.setVertexBuffer(1, instanceBuffer);

      for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
        const count = counts[modelIndex]!;
        if (count === 0) continue;
        for (const primitive of models[modelIndex]!.primitives) {
          pass.setVertexBuffer(0, primitive.vertexBuffer);
          pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
          pass.setBindGroup(1, primitive.bindGroup);
          pass.drawIndexed(primitive.indexCount, count, 0, 0, firstInstances[modelIndex]!);
          recordDraw(statistics, count);
        }
      }
      return statistics;
    },
  };
}
