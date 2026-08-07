import { TICK_HZ } from "../../packages/sim/src/clock";
import type { SpecialParticleEvidence } from "../../packages/sim/src/content/unit-reference-schema";
import type { ParticleEffectDefinition } from "../../packages/engine/src/content/unit-media-schema";

export type ParticleEffectParameters = Omit<
  ParticleEffectDefinition,
  "key" | "trigger" | "textureUrl" | "appearanceWeightStart" | "appearanceWeightEnd"
> & { readonly appearanceWeights: readonly number[] };

/** Compiles a source-backed presentation shape proven by a completed unit slice. */
export function compileParticleEffectParameters(
  evidence: SpecialParticleEvidence,
  actionTicks: number,
): ParticleEffectParameters {
  const opacityStartStage = evidence.opacityStages.find(
    (stage) => stage[0] === 0 && stage[3] === evidence.presentation.opacityFadeInSeconds,
  );
  const opacityPeakStage = evidence.opacityStages.find(
    (stage) =>
      stage[0] === evidence.presentation.peakOpacity &&
      stage[1] === evidence.presentation.opacityVariance,
  );
  const scaleStartStage = evidence.scaleStages[0];
  const scaleEndStage = evidence.scaleStages[1];
  const presentation = evidence.presentation;
  const emissionMode = presentation.emissionMode ?? "finite";
  const stationaryBox =
    evidence.spreader === "box" &&
    evidence.initialVelocity === 0 &&
    evidence.offAxisDegrees === 0 &&
    evidence.offPlaneDegrees === 0 &&
    presentation.spreader === "vertical";
  const verticalRectangle =
    evidence.spreader === "rectangle" &&
    evidence.offAxisDegrees === 0 &&
    evidence.offPlaneDegrees === 0 &&
    presentation.spreader === "vertical" &&
    evidence.shapeOuterRadii !== undefined &&
    evidence.shapeOuterRadii[1] === 0;
  const constantScale =
    evidence.scaleStages.length === 0 &&
    presentation.scaleStart === 1 &&
    presentation.scaleEnd === 1;

  if (
    !(
      stationaryBox ||
      verticalRectangle ||
      (evidence.spreader === "point" &&
        ((evidence.offAxisDegrees === -45 &&
          evidence.offPlaneDegrees === 90 &&
          presentation.spreader === "radial-horizontal") ||
          (evidence.offAxisDegrees === 0 &&
            evidence.offPlaneDegrees === 0 &&
            (presentation.spreader === "forward" || presentation.spreader === "vertical"))))
    ) ||
    (!constantScale &&
      (presentation.scaleStart !== scaleStartStage?.[0] ||
        presentation.scaleEnd !== scaleEndStage?.[0] ||
        presentation.scaleFadeInSeconds !== scaleStartStage?.[3])) ||
    presentation.peakOpacity !== opacityPeakStage?.[0] ||
    presentation.opacityVariance !== opacityPeakStage?.[1] ||
    presentation.opacityFadeInSeconds !== opacityStartStage?.[3]
  ) {
    throw new Error(`${evidence.key} uses an unsupported source-to-runtime particle mapping.`);
  }

  const parameters: ParticleEffectParameters = {
    blend: evidence.blend,
    spreader: presentation.spreader,
    ...(verticalRectangle
      ? {
          emissionShape: "rectangle-horizontal" as const,
          emissionRadiusX: evidence.shapeOuterRadii![0],
          emissionRadiusZ: evidence.shapeOuterRadii![2],
        }
      : {}),
    emissionMode,
    maxParticles: evidence.maxParticles,
    particleLifetimeSeconds: evidence.particleLifetimeSeconds,
    emissionStartSeconds: evidence.emissionStartSeconds,
    emissionDurationSeconds: presentation.emissionDurationSeconds,
    emissionRatePerSecond: evidence.emissionRatePerSecond,
    emissionRateVariance: evidence.emissionRateVariance,
    initialVelocity: evidence.initialVelocity,
    heightOffset: presentation.heightOffset,
    baseScale: evidence.baseScale,
    scaleStart: presentation.scaleStart,
    scaleEnd: presentation.scaleEnd,
    scaleFadeInSeconds: presentation.scaleFadeInSeconds,
    peakOpacity: presentation.peakOpacity,
    opacityVariance: presentation.opacityVariance,
    opacityFadeInSeconds: presentation.opacityFadeInSeconds,
    opacityFadeOutSeconds: presentation.opacityFadeOutSeconds,
    appearanceWeights:
      evidence.appearanceWeights ?? Array(1 + (evidence.additionalTextures?.length ?? 0)).fill(1),
  };
  const maximumEmissionRate = parameters.emissionRatePerSecond + parameters.emissionRateVariance;
  const actionSeconds = actionTicks / TICK_HZ;
  const maximumConcurrentParticles =
    Math.ceil(parameters.particleLifetimeSeconds * maximumEmissionRate) + 1;
  if (
    (parameters.blend !== "additive" && parameters.blend !== "normal") ||
    (parameters.spreader !== "forward" &&
      parameters.spreader !== "radial-horizontal" &&
      parameters.spreader !== "vertical") ||
    (parameters.emissionMode !== "finite" && parameters.emissionMode !== "continuous") ||
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
    (parameters.emissionMode === "finite"
      ? Math.ceil(parameters.emissionDurationSeconds * maximumEmissionRate) >
        parameters.maxParticles
      : maximumConcurrentParticles > parameters.maxParticles) ||
    parameters.emissionStartSeconds + parameters.emissionDurationSeconds > actionSeconds ||
    !Number.isFinite(parameters.initialVelocity) ||
    parameters.initialVelocity < 0 ||
    !Number.isFinite(parameters.heightOffset) ||
    parameters.heightOffset < 0 ||
    !Number.isFinite(parameters.baseScale) ||
    parameters.baseScale <= 0 ||
    !Number.isFinite(parameters.scaleStart) ||
    parameters.scaleStart < 0 ||
    !Number.isFinite(parameters.scaleEnd) ||
    parameters.scaleEnd < 0 ||
    !Number.isFinite(parameters.scaleFadeInSeconds) ||
    parameters.scaleFadeInSeconds <= 0 ||
    !Number.isFinite(parameters.peakOpacity) ||
    parameters.peakOpacity <= 0 ||
    parameters.peakOpacity > 1 ||
    !Number.isFinite(parameters.opacityVariance) ||
    parameters.opacityVariance < 0 ||
    parameters.opacityVariance >= parameters.peakOpacity ||
    !Number.isFinite(parameters.opacityFadeInSeconds) ||
    parameters.opacityFadeInSeconds < 0 ||
    !Number.isFinite(parameters.opacityFadeOutSeconds) ||
    parameters.opacityFadeOutSeconds <= 0
  ) {
    throw new Error(`${evidence.key} compiles to an invalid particle effect.`);
  }

  return parameters;
}
