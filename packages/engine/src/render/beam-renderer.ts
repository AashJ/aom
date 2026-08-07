import { NO_TARGET, heightAt, type RenderSnapshot } from "@aom/sim";
import { BEAM_PRESENTATIONS, UNIT_PRESENTATIONS } from "../content/generated/unit-media";
import { DEPTH_FORMAT } from "../gpu/device";
import beamsWgsl from "../shaders/beams.wgsl?raw";
import { recordDraw, resetRendererStatistics, type RendererStatistics } from "./render-statistics";
import {
  UNIT_POSE_ELEVATION,
  UNIT_POSE_FLOATS,
  UNIT_POSE_X,
  UNIT_POSE_Z,
  writeInterpolatedUnitPose,
} from "./unit-pose";
import type { BeamEffectMediaDefinition } from "../content/unit-media-schema";

const INSTANCE_FLOATS = 8;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;

export function beamPresentationActive(
  definition: BeamEffectMediaDefinition,
  remainingTicks: number,
  alpha: number,
): boolean {
  if (remainingTicks <= 0) return false;
  const elapsedTicks = definition.endTicks - remainingTicks + Math.min(1, Math.max(0, alpha));
  return elapsedTicks >= definition.startTicks && elapsedTicks < definition.endTicks;
}

interface BeamResource {
  readonly bindGroup: GPUBindGroup;
}

export interface BeamRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    cameraViewDir: Float32Array,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    heights: Float32Array,
  ): RendererStatistics;
}

export async function createBeamRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
): Promise<BeamRenderer> {
  const definitions = BEAM_PRESENTATIONS.flatMap((definition, type) =>
    definition === undefined ? [] : [{ definition, type }],
  );
  const resourceDefinitions = definitions.flatMap(({ definition, type }) => [
    { textureUrl: definition.beamTextureUrl, type, head: false },
    { textureUrl: definition.headTextureUrl, type, head: true },
  ]);
  const beamResourceByType = new Int32Array(BEAM_PRESENTATIONS.length).fill(-1);
  const headResourceByType = new Int32Array(BEAM_PRESENTATIONS.length).fill(-1);
  for (let index = 0; index < resourceDefinitions.length; index += 1) {
    const resource = resourceDefinitions[index]!;
    (resource.head ? headResourceByType : beamResourceByType)[resource.type] = index;
  }

  const images = await Promise.all(
    resourceDefinitions.map(({ textureUrl }) =>
      fetch(textureUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load beam texture ${textureUrl}.`);
          return response.blob();
        })
        .then((blob) => createImageBitmap(blob)),
    ),
  );
  const sampler = device.createSampler({
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });
  const vertexData = new Float32Array([0, -0.5, 0, 1, 1, -0.5, 1, 1, 1, 0.5, 1, 0, 0, 0.5, 0, 0]);
  const indexData = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const capacity = Math.max(1, maxInstances * 2);
  const instanceBuffer = device.createBuffer({
    size: capacity * INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(capacity * INSTANCE_FLOATS);
  const uniformStaging = new Float32Array(20);
  const uniformBuffer = device.createBuffer({
    size: uniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const module = device.createShaderModule({ code: beamsWgsl });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
    ],
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 16,
          attributes: [
            { format: "float32x2", offset: 0, shaderLocation: 0 },
            { format: "float32x2", offset: 8, shaderLocation: 1 },
          ],
        },
        {
          arrayStride: INSTANCE_STRIDE,
          stepMode: "instance",
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 2 },
            { format: "float32", offset: 12, shaderLocation: 3 },
            { format: "float32x3", offset: 16, shaderLocation: 4 },
            { format: "float32", offset: 28, shaderLocation: 5 },
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
            color: { operation: "add", srcFactor: "one", dstFactor: "one" },
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
    depthStencil: {
      format: DEPTH_FORMAT,
      depthWriteEnabled: false,
      depthCompare: "less",
    },
  });
  const resources: BeamResource[] = images.map((image) => {
    const texture = device.createTexture({
      size: [image.width, image.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.copyExternalImageToTexture(
      { source: image },
      { texture },
      { width: image.width, height: image.height },
    );
    return {
      bindGroup: device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: sampler },
          { binding: 2, resource: texture.createView() },
        ],
      }),
    };
  });
  const counts = new Uint32Array(resources.length);
  const firstInstances = new Uint32Array(resources.length);
  const offsets = new Uint32Array(resources.length);
  const sourcePose = new Float64Array(UNIT_POSE_FLOATS);
  const targetPose = new Float64Array(UNIT_POSE_FLOATS);
  const targetIndices = new Map<number, number>();
  const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  return {
    draw(pass, queue, viewProj, cameraViewDir, prev, curr, alpha, heights) {
      resetRendererStatistics(statistics);
      counts.fill(0);
      targetIndices.clear();
      for (let i = 0; i < curr.count; i += 1) targetIndices.set(curr.ids[i]!, i);

      for (let i = 0; i < curr.count; i += 1) {
        const definition = BEAM_PRESENTATIONS[curr.unitType[i]!];
        if (
          definition === undefined ||
          curr.visible[i] === 0 ||
          curr.beamTargetVisible[i] === 0 ||
          curr.beamTargetId[i] === NO_TARGET ||
          !targetIndices.has(curr.beamTargetId[i]!) ||
          !beamPresentationActive(definition, curr.actionCooldown[i]!, alpha)
        ) {
          continue;
        }
        const beamResource = beamResourceByType[curr.unitType[i]!]!;
        const headResource = headResourceByType[curr.unitType[i]!]!;
        counts[beamResource] = counts[beamResource]! + 1;
        counts[headResource] = counts[headResource]! + 1;
      }

      let total = 0;
      for (let resource = 0; resource < resources.length; resource += 1) {
        firstInstances[resource] = total;
        offsets[resource] = total;
        total += counts[resource]!;
      }
      if (total === 0) return statistics;
      if (total > capacity) throw new RangeError("Beam renderer capacity exceeded.");

      const writeSegment = (
        resource: number,
        startX: number,
        startY: number,
        startZ: number,
        width: number,
        endX: number,
        endY: number,
        endZ: number,
      ) => {
        const instance = offsets[resource]!++;
        const offset = instance * INSTANCE_FLOATS;
        staging.set([startX, startY, startZ, width, endX, endY, endZ, 1], offset);
      };

      for (let i = 0; i < curr.count; i += 1) {
        const type = curr.unitType[i]!;
        const definition = BEAM_PRESENTATIONS[type];
        if (definition === undefined) continue;
        const target = targetIndices.get(curr.beamTargetId[i]!);
        if (
          target === undefined ||
          curr.visible[i] === 0 ||
          curr.beamTargetVisible[i] === 0 ||
          !beamPresentationActive(definition, curr.actionCooldown[i]!, alpha)
        ) {
          continue;
        }
        writeInterpolatedUnitPose(sourcePose, prev, curr, i, alpha);
        writeInterpolatedUnitPose(targetPose, prev, curr, target, alpha);
        const startX = sourcePose[UNIT_POSE_X]!;
        const startZ = sourcePose[UNIT_POSE_Z]!;
        const endX = targetPose[UNIT_POSE_X]!;
        const endZ = targetPose[UNIT_POSE_Z]!;
        const startY =
          heightAt(heights, startX, startZ) +
          sourcePose[UNIT_POSE_ELEVATION]! +
          definition.sourceHeight;
        const targetPresentation = UNIT_PRESENTATIONS[curr.unitType[target]!]!;
        const endY =
          heightAt(heights, endX, endZ) +
          targetPose[UNIT_POSE_ELEVATION]! +
          targetPresentation.worldHeight * definition.targetHeightFactor;
        writeSegment(
          beamResourceByType[type]!,
          startX,
          startY,
          startZ,
          definition.width,
          endX,
          endY,
          endZ,
        );
        const dx = endX - startX;
        const dy = endY - startY;
        const dz = endZ - startZ;
        const length = Math.hypot(dx, dy, dz);
        const headFraction = Math.max(0, 1 - definition.headLength / length);
        writeSegment(
          headResourceByType[type]!,
          startX + dx * headFraction,
          startY + dy * headFraction,
          startZ + dz * headFraction,
          definition.width * 1.5,
          endX,
          endY,
          endZ,
        );
      }

      uniformStaging.set(viewProj, 0);
      uniformStaging.set(cameraViewDir.subarray(0, 3), 16);
      queue.writeBuffer(uniformBuffer, 0, uniformStaging);
      queue.writeBuffer(instanceBuffer, 0, staging, 0, total * INSTANCE_FLOATS);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      for (let resource = 0; resource < resources.length; resource += 1) {
        const count = counts[resource]!;
        if (count === 0) continue;
        pass.setBindGroup(0, resources[resource]!.bindGroup);
        pass.drawIndexed(6, count, 0, 0, firstInstances[resource]!);
        recordDraw(statistics, count);
      }
      return statistics;
    },
  };
}
