import { UNIT_TYPES, VERTS_PER_ROW, heightAt, type RenderSnapshot } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import unitsWgsl from "../shaders/units.wgsl?raw";
import { recordDraw, resetRendererStatistics, type RendererStatistics } from "./render-statistics";
import {
  UNIT_POSE_ELEVATION,
  UNIT_POSE_FLOATS,
  UNIT_POSE_X,
  UNIT_POSE_Z,
  writeInterpolatedUnitPose,
} from "./unit-pose";
import {
  resolveStaticSpriteGhostPresentation,
  resolveStaticSpritePresentation,
  resolveStaticSpriteUnitPresentation,
  staticSpriteColumns,
  UNIT_PRESENTATIONS,
  type StaticSpritePresentation,
} from "./unit-presentation";

const INSTANCE_FLOATS = 15;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;

interface SpriteResources {
  bindGroup: GPUBindGroup;
  aspect: number;
  uvFrameWidth: number;
  uvFrameHeight: number;
}

export interface StaticSpriteRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    heights: Float32Array,
    ghostType: number,
    ghostX: number,
    ghostZ: number,
    ghostValid: boolean,
  ): RendererStatistics;
}

const spriteImages = new Map<string, Promise<ImageBitmap>>();

function loadSpriteImage(config: StaticSpritePresentation): Promise<ImageBitmap> {
  let image = spriteImages.get(config.url);
  if (!image) {
    image = fetch(config.url)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Failed to load sprite ${config.url}: ${response.status}`);
        return response.blob();
      })
      .then((blob) => createImageBitmap(blob));
    spriteImages.set(config.url, image);
  }
  return image;
}

export async function createStaticSpriteRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  heights: Float32Array,
): Promise<StaticSpriteRenderer> {
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const images = await Promise.all(
    UNIT_PRESENTATIONS.map((presentation) =>
      presentation.kind === "sprite" ? loadSpriteImage(presentation) : Promise.resolve(null),
    ),
  );
  const vertexData = new Float32Array([
    // local xy, uv, part (0 = sprite)
    -0.5, 0, 0, 1, 0, 0.5, 0, 1, 1, 0, 0.5, 1, 1, 0, 0, -0.5, 1, 0, 0, 0,
  ]);
  const indexData = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const instanceBuffer = device.createBuffer({
    size: (maxInstances + 1) * INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array((maxInstances + 1) * INSTANCE_FLOATS);
  const counts = new Uint32Array(UNIT_PRESENTATIONS.length);
  const firstInstances = new Uint32Array(UNIT_PRESENTATIONS.length);
  const writeOffsets = new Uint32Array(UNIT_PRESENTATIONS.length);
  const unitPose = new Float64Array(UNIT_POSE_FLOATS);
  const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };
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
            color: { operation: "add", srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { operation: "add", srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
  });
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  const heightView = heightTexture.createView();
  const resources = images.map((image, type): SpriteResources | null => {
    const presentation = UNIT_PRESENTATIONS[type]!;
    if (!image || presentation.kind !== "sprite") return null;
    const columns = staticSpriteColumns(presentation);
    const texture = device.createTexture({
      size: [image.width, image.height],
      format: "rgba8unorm",
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
      aspect: image.width / columns / image.height,
      uvFrameWidth: 1 / columns,
      uvFrameHeight: 1,
      bindGroup: device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: heightView },
          { binding: 2, resource: sampler },
          { binding: 3, resource: texture.createView() },
        ],
      }),
    };
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);
  device.queue.writeTexture(
    { texture: heightTexture },
    heights,
    { bytesPerRow: VERTS_PER_ROW * 4, rowsPerImage: VERTS_PER_ROW },
    { width: VERTS_PER_ROW, height: VERTS_PER_ROW },
  );

  function stage(
    instanceIndex: number,
    type: number,
    x: number,
    z: number,
    selected: number,
    owner: number,
    hpFrac: number,
    buildFrac: number,
    frame: number,
    elevation: number,
    terrainHeights: Float32Array,
  ): void {
    const presentation = UNIT_PRESENTATIONS[type]!;
    const sprite = resources[type]!;
    if (presentation.kind !== "sprite" || !sprite) return;
    const offset = instanceIndex * INSTANCE_FLOATS;
    staging[offset] = x;
    staging[offset + 1] = heightAt(terrainHeights, x, z) + elevation;
    staging[offset + 2] = z;
    staging[offset + 3] = selected;
    staging[offset + 4] = owner;
    staging[offset + 5] = hpFrac;
    staging[offset + 6] = frame * sprite.uvFrameWidth;
    staging[offset + 7] = sprite.uvFrameWidth;
    staging[offset + 8] = presentation.worldHeight * sprite.aspect;
    staging[offset + 9] = presentation.worldHeight - presentation.bottomPadding;
    staging[offset + 10] = buildFrac;
    staging[offset + 11] = 0;
    staging[offset + 12] = 1 - presentation.bottomPadding / presentation.worldHeight;
    staging[offset + 13] = 0;
    staging[offset + 14] = sprite.uvFrameHeight;
  }

  return {
    draw(
      pass,
      queue,
      viewProj,
      prev,
      curr,
      alpha,
      terrainHeights,
      ghostType,
      ghostX,
      ghostZ,
      ghostValid,
    ) {
      resetRendererStatistics(statistics);
      counts.fill(0);
      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;
        const type = curr.unitType[i]!;
        if (resolveStaticSpriteUnitPresentation(curr, i)) counts[type] = counts[type]! + 1;
      }

      let totalInstances = 0;
      for (let type = 0; type < counts.length; type += 1) {
        firstInstances[type] = totalInstances;
        writeOffsets[type] = totalInstances;
        totalInstances += counts[type]!;
      }

      for (let i = 0; i < curr.count; i += 1) {
        if (curr.visible[i] === 0) continue;
        const type = curr.unitType[i]!;
        const presentation = resolveStaticSpriteUnitPresentation(curr, i);
        if (!presentation) continue;
        writeInterpolatedUnitPose(unitPose, prev, curr, i, alpha);
        const x = unitPose[UNIT_POSE_X]!;
        const z = unitPose[UNIT_POSE_Z]!;
        const elevation = unitPose[UNIT_POSE_ELEVATION]!;
        const stats = UNIT_TYPES[type]!;
        const buildFrac =
          stats.buildTicks > 0 ? Math.min(1, curr.buildProgress[i]! / stats.buildTicks) : 1;
        const hpFrac = curr.hp[i]! / stats.maxHp;
        const resolved = resolveStaticSpritePresentation(
          presentation,
          curr.ids[i]!,
          hpFrac,
          buildFrac,
        );
        const instanceIndex = writeOffsets[type]!;
        writeOffsets[type] = instanceIndex + 1;
        stage(
          instanceIndex,
          type,
          x,
          z,
          curr.selected[i]!,
          curr.owner[i]!,
          hpFrac,
          resolved.buildFrac,
          resolved.frame,
          elevation,
          terrainHeights,
        );
      }

      let ghostFirstInstance = -1;
      if (ghostType >= 0 && resolveStaticSpriteGhostPresentation(curr, ghostType)) {
        ghostFirstInstance = totalInstances;
        stage(
          ghostFirstInstance,
          ghostType,
          ghostX,
          ghostZ,
          0,
          0,
          ghostValid ? -1 : -2,
          1,
          0,
          0,
          terrainHeights,
        );
        totalInstances += 1;
      }

      if (totalInstances === 0) return statistics;
      queue.writeBuffer(instanceBuffer, 0, staging, 0, totalInstances * INSTANCE_FLOATS);
      uniformStaging.set(viewProj);
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
      for (let type = 0; type < counts.length; type += 1) {
        const count = counts[type]!;
        if (count === 0) continue;
        pass.setBindGroup(0, resources[type]!.bindGroup);
        pass.drawIndexed(indexData.length, count, 0, 0, firstInstances[type]!);
        recordDraw(statistics, count);
      }
      if (ghostFirstInstance >= 0) {
        pass.setBindGroup(0, resources[ghostType]!.bindGroup);
        pass.drawIndexed(indexData.length, 1, 0, 0, ghostFirstInstance);
        recordDraw(statistics, 1);
      }
      return statistics;
    },
  };
}
