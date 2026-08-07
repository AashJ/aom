import { describe, expect, test } from "bun:test";
import type {
  ParticleEffectDefinition,
  ProjectileParticleMediaDefinition,
} from "../content/unit-media-schema";
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
  writeProjectileParticleInstances,
} from "./particle-presentation";

const effect: ParticleEffectDefinition = {
  key: "test-sound-wave",
  trigger: "special-attack",
  textureUrl: "/sound-wave.png",
  blend: "additive",
  spreader: "radial-horizontal",
  appearanceWeightStart: 0,
  appearanceWeightEnd: 1,
  emissionMode: "finite",
  maxParticles: 20,
  particleLifetimeSeconds: 0.8,
  emissionStartSeconds: 1.1,
  emissionDurationSeconds: 1,
  emissionRatePerSecond: 8,
  emissionRateVariance: 0.2,
  initialVelocity: 5,
  heightOffset: 1.75,
  baseScale: 6,
  scaleStart: 0,
  scaleEnd: 1,
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

  test("reconstructs the source point emitter as a vertical shrinking column", () => {
    const vertical: ParticleEffectDefinition = {
      ...effect,
      blend: "normal",
      spreader: "vertical",
      emissionStartSeconds: 0,
      emissionDurationSeconds: 1.6,
      emissionRatePerSecond: 6,
      emissionRateVariance: 0,
      initialVelocity: 3,
      baseScale: 5.5,
      scaleStart: 1,
      scaleEnd: 0.2,
    };
    const output = new Float32Array(vertical.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const count = writeParticleEffectInstances(output, 0, vertical, 42, 10, 4, 20, 0.5);

    expect(count).toBeGreaterThan(0);
    expect(output[PARTICLE_INSTANCE_X]).toBe(10);
    expect(output[PARTICLE_INSTANCE_Y]).toBeCloseTo(5.5, 5);
    expect(output[PARTICLE_INSTANCE_Z]).toBe(20);
    expect(output[PARTICLE_INSTANCE_SIZE]).toBeCloseTo(3.3, 5);
  });

  test("advects a source forward emitter along the unit's normalized facing", () => {
    const forward: ParticleEffectDefinition = {
      ...effect,
      spreader: "forward",
      emissionStartSeconds: 0,
      emissionRateVariance: 0,
      initialVelocity: 6,
    };
    const output = new Float32Array(forward.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const count = writeParticleEffectInstances(output, 0, forward, 42, 10, 4, 20, 0.5, 0.6, 0.8);

    expect(count).toBeGreaterThan(0);
    expect(output[PARTICLE_INSTANCE_X]).toBeCloseTo(11.8, 5);
    expect(output[PARTICLE_INSTANCE_Y]).toBe(4);
    expect(output[PARTICLE_INSTANCE_Z]).toBeCloseTo(22.4, 5);
  });

  test("reconstructs a stable source rectangle in unit-local space", () => {
    const rectangle: ParticleEffectDefinition = {
      ...effect,
      spreader: "vertical",
      emissionShape: "rectangle-horizontal",
      emissionRadiusX: 0.25,
      emissionRadiusZ: 0.25,
      emissionStartSeconds: 0,
      emissionRateVariance: 0,
      initialVelocity: 0,
    };
    const output = new Float32Array(rectangle.maxParticles * PARTICLE_INSTANCE_FLOATS);
    const count = writeParticleEffectInstances(output, 0, rectangle, 42, 10, 4, 20, 0.5, 0.6, 0.8);

    expect(count).toBeGreaterThan(0);
    expect(Math.abs(output[PARTICLE_INSTANCE_X]! - 10)).toBeLessThanOrEqual(0.35);
    expect(output[PARTICLE_INSTANCE_Y]).toBe(4);
    expect(Math.abs(output[PARTICLE_INSTANCE_Z]! - 20)).toBeLessThanOrEqual(0.35);
  });

  test("partitions each stable particle ordinal into exactly one texture appearance", () => {
    const base: ParticleEffectDefinition = {
      ...effect,
      emissionStartSeconds: 0,
      emissionRateVariance: 0,
      appearanceWeightStart: 0,
      appearanceWeightEnd: 1,
    };
    const elapsedSeconds = 0.75;
    const whole = activeParticleCount(base, 42, elapsedSeconds);
    const partitions = [
      { ...base, appearanceWeightEnd: 1 / 3 },
      { ...base, appearanceWeightStart: 1 / 3, appearanceWeightEnd: 2 / 3 },
      { ...base, appearanceWeightStart: 2 / 3 },
    ];

    const counts = partitions.map((partition) =>
      activeParticleCount(partition, 42, elapsedSeconds),
    );
    expect(whole).toBeGreaterThan(0);
    expect(counts.filter((count) => count > 0).length).toBeGreaterThan(1);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(whole);
  });

  test("keeps a bounded continuous head glow alive throughout a charged action", () => {
    const glow: ParticleEffectDefinition = {
      ...effect,
      spreader: "vertical",
      emissionMode: "continuous",
      maxParticles: 5,
      particleLifetimeSeconds: 0.5,
      emissionStartSeconds: 0,
      emissionDurationSeconds: 2,
      emissionRatePerSecond: 4,
      emissionRateVariance: 0,
      initialVelocity: 0,
      baseScale: 2,
      scaleStart: 0.8,
      scaleEnd: 1,
      peakOpacity: 0.5,
      opacityVariance: 0,
      opacityFadeInSeconds: 1,
      opacityFadeOutSeconds: 0.1,
    };

    for (const elapsed of [0, 0.75, 1.5, 1.99]) {
      expect(activeParticleCount(glow, 362, elapsed)).toBeGreaterThan(0);
      expect(activeParticleCount(glow, 362, elapsed)).toBeLessThanOrEqual(glow.maxParticles);
    }
  });

  test("reconstructs Wadjet's point-emitter plume along projectile flight", () => {
    const projectile: ProjectileParticleMediaDefinition = {
      type: 3,
      key: "wadjet-spit",
      kind: "particle",
      textureUrl: "/mist.png",
      flightHeight: 1.1,
      arcHeight: 0,
      blend: "normal",
      particleCount: 16,
      trailLength: 5,
      baseScale: 0.9,
      scaleStart: 0.5,
      scaleEnd: 1,
      peakOpacity: 1,
    };
    const output = new Float32Array(projectile.particleCount * PARTICLE_INSTANCE_FLOATS);
    const count = writeProjectileParticleInstances(output, 0, projectile, 10, 4, 20, 1, 0);
    const tail = (count - 1) * PARTICLE_INSTANCE_FLOATS;

    expect(count).toBe(16);
    expect(output[PARTICLE_INSTANCE_X]).toBe(10);
    expect(output[PARTICLE_INSTANCE_SIZE]).toBeCloseTo(0.45, 5);
    expect(output[tail + PARTICLE_INSTANCE_X]).toBe(5);
    expect(output[tail + PARTICLE_INSTANCE_Y]).toBe(4);
    expect(output[tail + PARTICLE_INSTANCE_Z]).toBe(20);
    expect(output[tail + PARTICLE_INSTANCE_SIZE]).toBeCloseTo(0.9, 5);
    expect(output[tail + PARTICLE_INSTANCE_OPACITY]).toBe(0);
  });
});
