import { TICK_HZ } from "@aom/sim";
import type { ParticleEffectDefinition } from "../content/unit-media-schema";

export const PARTICLE_INSTANCE_X = 0;
export const PARTICLE_INSTANCE_Y = 1;
export const PARTICLE_INSTANCE_Z = 2;
export const PARTICLE_INSTANCE_SIZE = 3;
export const PARTICLE_INSTANCE_OPACITY = 4;
export const PARTICLE_INSTANCE_FLOATS = 5;

const DIRECTION_SALT = 0x6d2b79f5;
const EMISSION_RATE_SALT = 0x9e3779b9;
const OPACITY_SALT = 0x85ebca6b;

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

  for (let ordinal = 0; ordinal < effect.maxParticles && spawnTime < emissionEnd; ordinal += 1) {
    if (spawnTime > elapsedSeconds) break;
    const ageSeconds = elapsedSeconds - spawnTime;
    if (ageSeconds < effect.particleLifetimeSeconds) visit(ordinal, ageSeconds);

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
): number {
  let count = 0;
  forEachActiveParticle(effect, id, elapsedSeconds, (ordinal, ageSeconds) => {
    const offset = (firstInstance + count) * PARTICLE_INSTANCE_FLOATS;
    if (offset + PARTICLE_INSTANCE_FLOATS > out.length) {
      throw new RangeError("Particle presentation staging capacity exceeded.");
    }

    const angle = unitFloat(id, ordinal, DIRECTION_SALT) * Math.PI * 2;
    const distance = effect.initialVelocity * ageSeconds;
    const lifeRemaining = effect.particleLifetimeSeconds - ageSeconds;
    const opacityEnvelope = Math.min(
      1,
      ageSeconds / effect.opacityFadeInSeconds,
      lifeRemaining / effect.opacityFadeOutSeconds,
    );
    const peakOpacity =
      effect.peakOpacity + centeredUnitFloat(id, ordinal, OPACITY_SALT) * effect.opacityVariance;

    out[offset + PARTICLE_INSTANCE_X] = centerX + Math.cos(angle) * distance;
    out[offset + PARTICLE_INSTANCE_Y] = centerY;
    out[offset + PARTICLE_INSTANCE_Z] = centerZ + Math.sin(angle) * distance;
    out[offset + PARTICLE_INSTANCE_SIZE] =
      effect.baseScale * Math.min(1, ageSeconds / effect.scaleFadeInSeconds);
    out[offset + PARTICLE_INSTANCE_OPACITY] = Math.max(0, peakOpacity * opacityEnvelope);
    count += 1;
  });
  return count;
}
