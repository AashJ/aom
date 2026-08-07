import { TICK_HZ, UNIT_TYPES, heightAt, type RenderSnapshot } from "@aom/sim";
import {
  MAX_PARTICLES_PER_UNIT,
  PARTICLE_EFFECT_DEFINITIONS,
  POISON_STATUS_PARTICLE_EFFECT_INDICES,
  PROJECTILE_PRESENTATIONS,
  UNIT_PARTICLE_EFFECT_INDICES,
} from "../content/generated/unit-media";
import type { ProjectileParticleMediaDefinition } from "../content/unit-media-schema";
import { DEPTH_FORMAT } from "../gpu/device";
import particlesWgsl from "../shaders/particles.wgsl?raw";
import {
  PARTICLE_INSTANCE_FLOATS,
  activeParticleCount,
  specialActionElapsedSeconds,
  writeParticleEffectInstances,
  writeProjectileParticleInstances,
} from "./particle-presentation";
import {
  PROJECTILE_VISUAL_FACING_X,
  PROJECTILE_VISUAL_FACING_Z,
  PROJECTILE_VISUAL_FLOATS,
  PROJECTILE_VISUAL_PROGRESS,
  PROJECTILE_VISUAL_X,
  PROJECTILE_VISUAL_Z,
  projectileFlightHeight,
  writeProjectileVisualState,
} from "./projectile-presentation";
import { recordDraw, resetRendererStatistics, type RendererStatistics } from "./render-statistics";
import {
  UNIT_POSE_ELEVATION,
  UNIT_POSE_FACING_X,
  UNIT_POSE_FACING_Z,
  UNIT_POSE_FLOATS,
  UNIT_POSE_X,
  UNIT_POSE_Z,
  writeInterpolatedUnitPose,
} from "./unit-pose";

const PARTICLE_INSTANCE_STRIDE = PARTICLE_INSTANCE_FLOATS * 4;

function poisonElapsedSeconds(
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  unitIndex: number,
  alpha: number,
): number {
  const elapsedTicks =
    prev.ids[unitIndex] === curr.ids[unitIndex] && prev.poisoned[unitIndex] === 1
      ? prev.poisonElapsedTicks[unitIndex]! + alpha
      : curr.poisonElapsedTicks[unitIndex]!;
  return elapsedTicks / TICK_HZ;
}

interface ParticleResources {
  readonly bindGroup: GPUBindGroup;
}

export interface ParticleRenderer {
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

const particleImages = new Map<string, Promise<ImageBitmap>>();

function loadParticleImage(definition: { readonly textureUrl: string }): Promise<ImageBitmap> {
  let image = particleImages.get(definition.textureUrl);
  if (!image) {
    image = fetch(definition.textureUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load particle texture ${definition.textureUrl}: ${response.status}`,
          );
        }
        return response.blob();
      })
      .then((blob) => createImageBitmap(blob));
    particleImages.set(definition.textureUrl, image);
  }
  return image;
}

function writeCameraBasis(uniforms: Float32Array, cameraViewDir: Float32Array): void {
  const length = Math.hypot(cameraViewDir[0]!, cameraViewDir[1]!, cameraViewDir[2]!);
  const forwardX = length > 0 ? cameraViewDir[0]! / length : 0;
  const forwardY = length > 0 ? cameraViewDir[1]! / length : -1;
  const forwardZ = length > 0 ? cameraViewDir[2]! / length : 0;
  const horizontalLength = Math.hypot(forwardX, forwardZ);

  if (horizontalLength === 0) {
    uniforms[16] = 1;
    uniforms[17] = 0;
    uniforms[18] = 0;
    uniforms[20] = 0;
    uniforms[21] = 1;
    uniforms[22] = 0;
    return;
  }

  const rightX = -forwardZ / horizontalLength;
  const rightZ = forwardX / horizontalLength;
  uniforms[16] = rightX;
  uniforms[17] = 0;
  uniforms[18] = rightZ;
  uniforms[20] = -rightZ * forwardY;
  uniforms[21] = horizontalLength;
  uniforms[22] = rightX * forwardY;
}

export async function createParticleRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  maxProjectiles: number,
): Promise<ParticleRenderer> {
  const projectileParticlePresentations = PROJECTILE_PRESENTATIONS.filter(
    (presentation): presentation is ProjectileParticleMediaDefinition =>
      presentation.kind === "particle",
  );
  const renderEffects = [...PARTICLE_EFFECT_DEFINITIONS, ...projectileParticlePresentations];
  const projectileParticleResourceIndices = new Int32Array(PROJECTILE_PRESENTATIONS.length).fill(
    -1,
  );
  for (let index = 0; index < projectileParticlePresentations.length; index += 1) {
    projectileParticleResourceIndices[projectileParticlePresentations[index]!.type] =
      PARTICLE_EFFECT_DEFINITIONS.length + index;
  }
  const maxParticlesPerProjectile = projectileParticlePresentations.reduce(
    (maximum, presentation) => Math.max(maximum, presentation.particleCount),
    0,
  );
  const images = await Promise.all(renderEffects.map(loadParticleImage));
  const sampler = device.createSampler({
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });
  const vertexData = new Float32Array([
    -0.5, -0.5, 0, 1, 0.5, -0.5, 1, 1, 0.5, 0.5, 1, 0, -0.5, 0.5, 0, 0,
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
  const particleCapacity = Math.max(
    1,
    maxInstances * MAX_PARTICLES_PER_UNIT + maxProjectiles * maxParticlesPerProjectile,
  );
  const instanceBuffer = device.createBuffer({
    size: particleCapacity * PARTICLE_INSTANCE_STRIDE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const staging = new Float32Array(particleCapacity * PARTICLE_INSTANCE_FLOATS);
  const counts = new Uint32Array(renderEffects.length);
  const firstInstances = new Uint32Array(renderEffects.length);
  const writeOffsets = new Uint32Array(renderEffects.length);
  const unitPose = new Float64Array(UNIT_POSE_FLOATS);
  const projectileVisualState = new Float32Array(PROJECTILE_VISUAL_FLOATS);
  const uniformStaging = new Float32Array(24);
  const uniformBuffer = device.createBuffer({
    size: uniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const module = device.createShaderModule({ code: particlesWgsl });
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
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });
  const createPipeline = (blend: "additive" | "normal") =>
    device.createRenderPipeline({
      layout: pipelineLayout,
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
            arrayStride: PARTICLE_INSTANCE_STRIDE,
            stepMode: "instance",
            attributes: [
              { format: "float32x3", offset: 0, shaderLocation: 2 },
              { format: "float32", offset: 12, shaderLocation: 3 },
              { format: "float32", offset: 16, shaderLocation: 4 },
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
                srcFactor: "one",
                dstFactor: blend === "additive" ? "one" : "one-minus-src-alpha",
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
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: "less",
      },
    });
  const pipelines = {
    additive: createPipeline("additive"),
    normal: createPipeline("normal"),
  } as const;
  const resources = images.map((image): ParticleResources => {
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
  const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  return {
    draw(pass, queue, viewProj, cameraViewDir, prev, curr, alpha, heights): RendererStatistics {
      resetRendererStatistics(statistics);
      counts.fill(0);

      for (let unitIndex = 0; unitIndex < curr.count; unitIndex += 1) {
        if (curr.visible[unitIndex] === 0) continue;
        if (curr.actionCooldown[unitIndex] !== 0) {
          const type = curr.unitType[unitIndex]!;
          const attack = UNIT_TYPES[type]!.attack;
          const effectIndices = UNIT_PARTICLE_EFFECT_INDICES[type];
          if (attack?.kind === "beam" && effectIndices !== undefined) {
            const elapsedSeconds = specialActionElapsedSeconds(
              attack.cooldownTicks,
              curr.actionCooldown[unitIndex]!,
              alpha,
            );
            for (const effectIndex of effectIndices) {
              const effect = PARTICLE_EFFECT_DEFINITIONS[effectIndex]!;
              if (effect.trigger !== "beam-attack") continue;
              counts[effectIndex] =
                counts[effectIndex]! +
                activeParticleCount(effect, curr.ids[unitIndex]!, elapsedSeconds);
            }
          }
        }
        if (curr.specialActionRemaining[unitIndex] !== 0) {
          const type = curr.unitType[unitIndex]!;
          const special = UNIT_TYPES[type]!.specialAttack;
          const effectIndices = UNIT_PARTICLE_EFFECT_INDICES[type];
          if (special !== undefined && effectIndices !== undefined) {
            const elapsedSeconds = specialActionElapsedSeconds(
              special.actionTicks,
              curr.specialActionRemaining[unitIndex]!,
              alpha,
            );
            for (const effectIndex of effectIndices) {
              const effect = PARTICLE_EFFECT_DEFINITIONS[effectIndex]!;
              if (effect.trigger !== "special-attack") continue;
              counts[effectIndex] =
                counts[effectIndex]! +
                activeParticleCount(effect, curr.ids[unitIndex]!, elapsedSeconds);
            }
          }
        }
        if (curr.poisoned[unitIndex] === 1) {
          const elapsedSeconds = poisonElapsedSeconds(prev, curr, unitIndex, alpha);
          for (const effectIndex of POISON_STATUS_PARTICLE_EFFECT_INDICES) {
            const effect = PARTICLE_EFFECT_DEFINITIONS[effectIndex]!;
            counts[effectIndex] =
              counts[effectIndex]! +
              activeParticleCount(effect, curr.ids[unitIndex]!, elapsedSeconds);
          }
        }
      }

      for (let projectileIndex = 0; projectileIndex < curr.projectileCount; projectileIndex += 1) {
        if (curr.projectileVisible[projectileIndex] === 0) continue;
        const effectIndex =
          projectileParticleResourceIndices[curr.projectileTypes[projectileIndex]!]!;
        if (effectIndex < 0) continue;
        const effect = renderEffects[effectIndex] as ProjectileParticleMediaDefinition;
        counts[effectIndex] = counts[effectIndex]! + effect.particleCount;
      }

      let totalCount = 0;
      for (let effectIndex = 0; effectIndex < resources.length; effectIndex += 1) {
        firstInstances[effectIndex] = totalCount;
        writeOffsets[effectIndex] = totalCount;
        totalCount += counts[effectIndex]!;
      }
      if (totalCount === 0) return statistics;
      if (totalCount > particleCapacity) {
        throw new RangeError("Particle renderer capacity exceeded.");
      }

      for (let unitIndex = 0; unitIndex < curr.count; unitIndex += 1) {
        if (curr.visible[unitIndex] === 0) continue;
        writeInterpolatedUnitPose(unitPose, prev, curr, unitIndex, alpha);
        const x = unitPose[UNIT_POSE_X]!;
        const z = unitPose[UNIT_POSE_Z]!;
        const terrainY = heightAt(heights, x, z) + unitPose[UNIT_POSE_ELEVATION]!;

        if (curr.actionCooldown[unitIndex] !== 0) {
          const type = curr.unitType[unitIndex]!;
          const attack = UNIT_TYPES[type]!.attack;
          const effectIndices = UNIT_PARTICLE_EFFECT_INDICES[type];
          if (attack?.kind === "beam" && effectIndices !== undefined) {
            const elapsedSeconds = specialActionElapsedSeconds(
              attack.cooldownTicks,
              curr.actionCooldown[unitIndex]!,
              alpha,
            );
            for (const effectIndex of effectIndices) {
              const effect = PARTICLE_EFFECT_DEFINITIONS[effectIndex]!;
              if (effect.trigger !== "beam-attack") continue;
              const written = writeParticleEffectInstances(
                staging,
                writeOffsets[effectIndex]!,
                effect,
                curr.ids[unitIndex]!,
                x,
                terrainY + effect.heightOffset,
                z,
                elapsedSeconds,
                unitPose[UNIT_POSE_FACING_X]!,
                unitPose[UNIT_POSE_FACING_Z]!,
              );
              writeOffsets[effectIndex] = writeOffsets[effectIndex]! + written;
            }
          }
        }

        if (curr.specialActionRemaining[unitIndex] !== 0) {
          const type = curr.unitType[unitIndex]!;
          const special = UNIT_TYPES[type]!.specialAttack;
          const effectIndices = UNIT_PARTICLE_EFFECT_INDICES[type];
          if (special !== undefined && effectIndices !== undefined) {
            const elapsedSeconds = specialActionElapsedSeconds(
              special.actionTicks,
              curr.specialActionRemaining[unitIndex]!,
              alpha,
            );
            for (const effectIndex of effectIndices) {
              const effect = PARTICLE_EFFECT_DEFINITIONS[effectIndex]!;
              if (effect.trigger !== "special-attack") continue;
              const written = writeParticleEffectInstances(
                staging,
                writeOffsets[effectIndex]!,
                effect,
                curr.ids[unitIndex]!,
                x,
                terrainY + effect.heightOffset,
                z,
                elapsedSeconds,
                unitPose[UNIT_POSE_FACING_X]!,
                unitPose[UNIT_POSE_FACING_Z]!,
              );
              writeOffsets[effectIndex] = writeOffsets[effectIndex]! + written;
            }
          }
        }
        if (curr.poisoned[unitIndex] === 1) {
          const elapsedSeconds = poisonElapsedSeconds(prev, curr, unitIndex, alpha);
          for (const effectIndex of POISON_STATUS_PARTICLE_EFFECT_INDICES) {
            const effect = PARTICLE_EFFECT_DEFINITIONS[effectIndex]!;
            const written = writeParticleEffectInstances(
              staging,
              writeOffsets[effectIndex]!,
              effect,
              curr.ids[unitIndex]!,
              x,
              terrainY + effect.heightOffset,
              z,
              elapsedSeconds,
              unitPose[UNIT_POSE_FACING_X]!,
              unitPose[UNIT_POSE_FACING_Z]!,
            );
            writeOffsets[effectIndex] = writeOffsets[effectIndex]! + written;
          }
        }
      }

      for (let projectileIndex = 0; projectileIndex < curr.projectileCount; projectileIndex += 1) {
        if (curr.projectileVisible[projectileIndex] === 0) continue;
        const effectIndex =
          projectileParticleResourceIndices[curr.projectileTypes[projectileIndex]!]!;
        if (effectIndex < 0) continue;
        const effect = renderEffects[effectIndex] as ProjectileParticleMediaDefinition;
        writeProjectileVisualState(projectileVisualState, prev, curr, projectileIndex, alpha);
        const x = projectileVisualState[PROJECTILE_VISUAL_X]!;
        const z = projectileVisualState[PROJECTILE_VISUAL_Z]!;
        const terrainY = heightAt(heights, x, z);
        const written = writeProjectileParticleInstances(
          staging,
          writeOffsets[effectIndex]!,
          effect,
          x,
          terrainY +
            projectileFlightHeight(effect, projectileVisualState[PROJECTILE_VISUAL_PROGRESS]!),
          z,
          projectileVisualState[PROJECTILE_VISUAL_FACING_X]!,
          projectileVisualState[PROJECTILE_VISUAL_FACING_Z]!,
        );
        writeOffsets[effectIndex] = writeOffsets[effectIndex]! + written;
      }

      queue.writeBuffer(instanceBuffer, 0, staging, 0, totalCount * PARTICLE_INSTANCE_FLOATS);
      uniformStaging.set(viewProj);
      writeCameraBasis(uniformStaging, cameraViewDir);
      queue.writeBuffer(uniformBuffer, 0, uniformStaging);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      for (let effectIndex = 0; effectIndex < resources.length; effectIndex += 1) {
        const count = counts[effectIndex]!;
        if (count === 0) continue;
        pass.setPipeline(pipelines[renderEffects[effectIndex]!.blend]);
        pass.setBindGroup(0, resources[effectIndex]!.bindGroup);
        pass.drawIndexed(indexData.length, count, 0, 0, firstInstances[effectIndex]!);
        recordDraw(statistics, count);
      }
      return statistics;
    },
  };
}
