import { TICK_HZ } from "@aom/sim";
import type {
  ParticleEffectDefinition,
  ProjectileParticleMediaDefinition,
} from "../content/unit-media-schema";

export const PARTICLE_INSTANCE_X = 0;
export const PARTICLE_INSTANCE_Y = 1;
export const PARTICLE_INSTANCE_Z = 2;
export const PARTICLE_INSTANCE_SIZE = 3;
export const PARTICLE_INSTANCE_OPACITY = 4;
export const PARTICLE_INSTANCE_FLOATS = 5;

const DIRECTION_SALT = 0x6d2b79f5;
const EMISSION_RATE_SALT = 0x9e3779b9;
const OPACITY_SALT = 0x85ebca6b;
const APPEARANCE_SALT = 0xc2b2ae35;
const EMISSION_X_SALT = 0x165667b1;
const EMISSION_Z_SALT = 0xd3a2646c;

function unitFloat(id: number, ordinal: number, salt: number): number {
  let value = (id ^ Math.imul(ordinal + 1, 0x27d4eb2d) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d) >>> 0;
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39) >>> 0;
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}

function centeredUnitFloat(id: number, ordinal: number, salt: number): number {
  return unitFloat(id, ordinal, salt) * 2 - 1;
}

function forEachActiveParticle(
  effect: ParticleEffectDefinition,
  id: number,
  elapsedSeconds: number,
  visit: (ordinal: number, ageSeconds: number) => void,
): void {
  const emissionEnd = effect.emissionStartSeconds + effect.emissionDurationSeconds;
  let spawnTime = effect.emissionStartSeconds;
  const maximumEmissionRate = effect.emissionRatePerSecond + effect.emissionRateVariance;
  const ordinalLimit =
    effect.emissionMode === "finite"
      ? effect.maxParticles
      : Math.ceil(effect.emissionDurationSeconds * maximumEmissionRate) + 1;

  for (let ordinal = 0; ordinal < ordinalLimit && spawnTime < emissionEnd; ordinal += 1) {
    if (spawnTime > elapsedSeconds) break;
    const ageSeconds = elapsedSeconds - spawnTime;
    const appearance = unitFloat(id, ordinal, APPEARANCE_SALT);
    if (
      ageSeconds < effect.particleLifetimeSeconds &&
      appearance >= effect.appearanceWeightStart &&
      appearance < effect.appearanceWeightEnd
    ) {
      visit(ordinal, ageSeconds);
    }

    const rate =
      effect.emissionRatePerSecond +
      centeredUnitFloat(id, ordinal, EMISSION_RATE_SALT) * effect.emissionRateVariance;
    spawnTime += 1 / rate;
  }
}

/**
 * Presentation time derived from the authoritative action timer. A negative
 * result means the action is inactive and no triggered effect may be shown.
 */
export function specialActionElapsedSeconds(
  actionTicks: number,
  remainingTicks: number,
  alpha: number,
): number {
  if (remainingTicks <= 0) return -1;
  const elapsedTicks = Math.min(
    actionTicks,
    Math.max(0, actionTicks - remainingTicks + Math.min(1, Math.max(0, alpha))),
  );
  return elapsedTicks / TICK_HZ;
}

export function activeParticleCount(
  effect: ParticleEffectDefinition,
  id: number,
  elapsedSeconds: number,
): number {
  let count = 0;
  forEachActiveParticle(effect, id, elapsedSeconds, () => {
    count += 1;
  });
  return count;
}

export function writeParticleEffectInstances(
  out: Float32Array,
  firstInstance: number,
  effect: ParticleEffectDefinition,
  id: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  elapsedSeconds: number,
  facingX = 0,
  facingZ = 1,
): number {
  let count = 0;
  forEachActiveParticle(effect, id, elapsedSeconds, (ordinal, ageSeconds) => {
    const offset = (firstInstance + count) * PARTICLE_INSTANCE_FLOATS;
    if (offset + PARTICLE_INSTANCE_FLOATS > out.length) {
      throw new RangeError("Particle presentation staging capacity exceeded.");
    }

    const distance = effect.initialVelocity * ageSeconds;
    const lifeRemaining = effect.particleLifetimeSeconds - ageSeconds;
    const fadeIn = effect.opacityFadeInSeconds === 0 ? 1 : ageSeconds / effect.opacityFadeInSeconds;
    const opacityEnvelope = Math.min(1, fadeIn, lifeRemaining / effect.opacityFadeOutSeconds);
    const peakOpacity =
      effect.peakOpacity + centeredUnitFloat(id, ordinal, OPACITY_SALT) * effect.opacityVariance;

    const angle = unitFloat(id, ordinal, DIRECTION_SALT) * Math.PI * 2;
    const radial = effect.spreader === "radial-horizontal";
    const forward = effect.spreader === "forward";
    const localEmissionX =
      effect.emissionShape === "rectangle-horizontal"
        ? centeredUnitFloat(id, ordinal, EMISSION_X_SALT) * (effect.emissionRadiusX ?? 0)
        : 0;
    const localEmissionZ =
      effect.emissionShape === "rectangle-horizontal"
        ? centeredUnitFloat(id, ordinal, EMISSION_Z_SALT) * (effect.emissionRadiusZ ?? 0)
        : 0;
    out[offset + PARTICLE_INSTANCE_X] =
      centerX +
      facingZ * localEmissionX +
      facingX * localEmissionZ +
      (radial ? Math.cos(angle) * distance : forward ? facingX * distance : 0);
    out[offset + PARTICLE_INSTANCE_Y] = centerY + (radial || forward ? 0 : distance);
    out[offset + PARTICLE_INSTANCE_Z] =
      centerZ -
      facingX * localEmissionX +
      facingZ * localEmissionZ +
      (radial ? Math.sin(angle) * distance : forward ? facingZ * distance : 0);
    const scaleProgress = Math.min(1, ageSeconds / effect.scaleFadeInSeconds);
    out[offset + PARTICLE_INSTANCE_SIZE] =
      effect.baseScale *
      (effect.scaleStart + (effect.scaleEnd - effect.scaleStart) * scaleProgress);
    out[offset + PARTICLE_INSTANCE_OPACITY] = Math.min(
      1,
      Math.max(0, peakOpacity * opacityEnvelope),
    );
    count += 1;
  });
  return count;
}

export function writeProjectileParticleInstances(
  out: Float32Array,
  firstInstance: number,
  effect: ProjectileParticleMediaDefinition,
  centerX: number,
  centerY: number,
  centerZ: number,
  facingX: number,
  facingZ: number,
): number {
  for (let ordinal = 0; ordinal < effect.particleCount; ordinal += 1) {
    const offset = (firstInstance + ordinal) * PARTICLE_INSTANCE_FLOATS;
    if (offset + PARTICLE_INSTANCE_FLOATS > out.length) {
      throw new RangeError("Particle presentation staging capacity exceeded.");
    }
    const progress = effect.particleCount === 1 ? 0 : ordinal / (effect.particleCount - 1);
    const distance = progress * effect.trailLength;
    out[offset + PARTICLE_INSTANCE_X] = centerX - facingX * distance;
    out[offset + PARTICLE_INSTANCE_Y] = centerY;
    out[offset + PARTICLE_INSTANCE_Z] = centerZ - facingZ * distance;
    out[offset + PARTICLE_INSTANCE_SIZE] =
      effect.baseScale * (effect.scaleStart + (effect.scaleEnd - effect.scaleStart) * progress);
    out[offset + PARTICLE_INSTANCE_OPACITY] = effect.peakOpacity * (1 - progress);
  }
  return effect.particleCount;
}
