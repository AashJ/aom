import { TICK_HZ } from "../../packages/sim/src/clock";
import type { SpecialParticleEvidence } from "../../packages/sim/src/content/unit-reference-schema";
import type { ParticleEffectDefinition } from "../../packages/engine/src/content/unit-media-schema";

export type ParticleEffectParameters = Omit<
  ParticleEffectDefinition,
  "key" | "trigger" | "textureUrl"
>;

/** Compiles the one source-backed presentation shape currently proven by C5. */
export function compileParticleEffectParameters(
  evidence: SpecialParticleEvidence,
  actionTicks: number,
): ParticleEffectParameters {
  const opacityStartStage = evidence.opacityStages[0];
  const opacityPeakStage = evidence.opacityStages[1];
  const scaleStartStage = evidence.scaleStages[0];
  const presentation = evidence.presentation;

  if (
    evidence.spreader !== "point" ||
    evidence.offAxisDegrees !== -45 ||
    evidence.offPlaneDegrees !== 90 ||
    presentation.spreader !== "radial-horizontal" ||
    presentation.scaleFadeInSeconds !== scaleStartStage?.[3] ||
    presentation.peakOpacity !== opacityPeakStage?.[0] ||
    presentation.opacityVariance !== opacityPeakStage?.[1] ||
    presentation.opacityFadeInSeconds !== opacityStartStage?.[3]
  ) {
    throw new Error(`${evidence.key} uses an unsupported source-to-runtime particle mapping.`);
  }

  const parameters: ParticleEffectParameters = {
    blend: evidence.blend,
    spreader: presentation.spreader,
    maxParticles: evidence.maxParticles,
    particleLifetimeSeconds: evidence.particleLifetimeSeconds,
    emissionStartSeconds: evidence.emissionStartSeconds,
    emissionDurationSeconds: evidence.emissionDurationSeconds,
    emissionRatePerSecond: evidence.emissionRatePerSecond,
    emissionRateVariance: evidence.emissionRateVariance,
    initialVelocity: evidence.initialVelocity,
    heightOffset: presentation.heightOffset,
    baseScale: evidence.baseScale,
    scaleFadeInSeconds: presentation.scaleFadeInSeconds,
    peakOpacity: presentation.peakOpacity,
    opacityVariance: presentation.opacityVariance,
    opacityFadeInSeconds: presentation.opacityFadeInSeconds,
    opacityFadeOutSeconds: presentation.opacityFadeOutSeconds,
  };
  const maximumEmissionRate = parameters.emissionRatePerSecond + parameters.emissionRateVariance;
  const actionSeconds = actionTicks / TICK_HZ;
  if (
    parameters.blend !== "additive" ||
    parameters.spreader !== "radial-horizontal" ||
    !Number.isInteger(parameters.maxParticles) ||
    parameters.maxParticles < 1 ||
    parameters.maxParticles > 0xffff ||
    !Number.isFinite(parameters.particleLifetimeSeconds) ||
    parameters.particleLifetimeSeconds <= 0 ||
    !Number.isFinite(parameters.emissionStartSeconds) ||
    parameters.emissionStartSeconds < 0 ||
    !Number.isFinite(parameters.emissionDurationSeconds) ||
    parameters.emissionDurationSeconds <= 0 ||
    !Number.isFinite(parameters.emissionRatePerSecond) ||
    parameters.emissionRatePerSecond <= 0 ||
    !Number.isFinite(parameters.emissionRateVariance) ||
    parameters.emissionRateVariance < 0 ||
    parameters.emissionRateVariance >= parameters.emissionRatePerSecond ||
    Math.ceil(parameters.emissionDurationSeconds * maximumEmissionRate) + 1 >
      parameters.maxParticles ||
    parameters.emissionStartSeconds +
      parameters.emissionDurationSeconds +
      parameters.particleLifetimeSeconds >
      actionSeconds ||
    !Number.isFinite(parameters.initialVelocity) ||
    parameters.initialVelocity < 0 ||
    !Number.isFinite(parameters.heightOffset) ||
    parameters.heightOffset < 0 ||
    !Number.isFinite(parameters.baseScale) ||
    parameters.baseScale <= 0 ||
    !Number.isFinite(parameters.scaleFadeInSeconds) ||
    parameters.scaleFadeInSeconds <= 0 ||
    !Number.isFinite(parameters.peakOpacity) ||
    parameters.peakOpacity <= 0 ||
    parameters.peakOpacity > 1 ||
    !Number.isFinite(parameters.opacityVariance) ||
    parameters.opacityVariance < 0 ||
    parameters.opacityVariance >= parameters.peakOpacity ||
    parameters.peakOpacity + parameters.opacityVariance > 1 ||
    !Number.isFinite(parameters.opacityFadeInSeconds) ||
    parameters.opacityFadeInSeconds <= 0 ||
    !Number.isFinite(parameters.opacityFadeOutSeconds) ||
    parameters.opacityFadeOutSeconds <= 0
  ) {
    throw new Error(`${evidence.key} compiles to an invalid particle effect.`);
  }

  return parameters;
}
