import { describe, expect, test } from "bun:test";
import type { ParticleEffectDefinition } from "../content/unit-media-schema";
import {
  PARTICLE_INSTANCE_FLOATS,
  PARTICLE_INSTANCE_OPACITY,
  PARTICLE_INSTANCE_SIZE,
  PARTICLE_INSTANCE_X,
  PARTICLE_INSTANCE_Y,
  PARTICLE_INSTANCE_Z,
  activeParticleCount,
  specialActionElapsedSeconds,
  writeParticleEffectInstances,
} from "./particle-presentation";

const effect: ParticleEffectDefinition = {
  key: "test-sound-wave",
  trigger: "special-attack",
  textureUrl: "/sound-wave.png",
  blend: "additive",
  spreader: "radial-horizontal",
  maxParticles: 20,
  particleLifetimeSeconds: 0.8,
  emissionStartSeconds: 1.1,
  emissionDurationSeconds: 1,
  emissionRatePerSecond: 8,
  emissionRateVariance: 0.2,
  initialVelocity: 5,
  heightOffset: 1.75,
  baseScale: 6,
  scaleFadeInSeconds: 1,
  peakOpacity: 0.3,
  opacityVariance: 0.1,
  opacityFadeInSeconds: 0.2,
  opacityFadeOutSeconds: 0.2,
};

describe("particle presentation", () => {
  test("derives presentation time from the authoritative special-action timer", () => {
    expect(specialActionElapsedSeconds(60, 60, 0)).toBe(0);
    expect(specialActionElapsedSeconds(60, 38, 0)).toBe(1.1);
    expect(specialActionElapsedSeconds(60, 38, 0.5)).toBe(1.125);
    expect(specialActionElapsedSeconds(60, 0, 0.5)).toBe(-1);
  });

  test("observes source dormancy, emission, lifetime, and capacity", () => {
    expect(activeParticleCount(effect, 17, 1.099)).toBe(0);
    expect(activeParticleCount(effect, 17, 1.1)).toBe(1);
    expect(activeParticleCount(effect, 17, 1.6)).toBeGreaterThan(1);
    expect(activeParticleCount(effect, 17, 1.6)).toBeLessThanOrEqual(effect.maxParticles);
    expect(activeParticleCount(effect, 17, 2.9)).toBe(0);
  });

  test("reconstructs stable radial particles without mutable renderer state", () => {
    const first = new Float32Array(effect.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const second = new Float32Array(effect.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const firstCount = writeParticleEffectInstances(first, 0, effect, 42, 10, 4, 20, 1.5);
    const secondCount = writeParticleEffectInstances(second, 0, effect, 42, 10, 4, 20, 1.5);

    expect(firstCount).toBe(secondCount);
    expect(first).toEqual(second);
    const dx = first[PARTICLE_INSTANCE_X]! - 10;
    const dz = first[PARTICLE_INSTANCE_Z]! - 20;
    expect(Math.hypot(dx, dz)).toBeCloseTo(2, 5);
    expect(first[PARTICLE_INSTANCE_Y]).toBe(4);
    expect(first[PARTICLE_INSTANCE_SIZE]).toBeCloseTo(2.4, 5);
    expect(first[PARTICLE_INSTANCE_OPACITY]).toBeGreaterThanOrEqual(0.2);
    expect(first[PARTICLE_INSTANCE_OPACITY]).toBeLessThanOrEqual(0.4);
  });

  test("uses stable entity identity only for visual variation", () => {
    const first = new Float32Array(effect.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const second = new Float32Array(effect.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const firstCount = writeParticleEffectInstances(first, 0, effect, 1, 0, 0, 0, 1.5);
    const secondCount = writeParticleEffectInstances(second, 0, effect, 2, 0, 0, 0, 1.5);

    expect(firstCount).toBeGreaterThan(0);
    expect(secondCount).toBeGreaterThan(0);
    expect(first.slice(0, firstCount * PARTICLE_INSTANCE_FLOATS)).not.toEqual(
      second.slice(0, secondCount * PARTICLE_INSTANCE_FLOATS),
    );
  });
});
