import { describe, expect, test } from "bun:test";
import { unitReferenceEntry } from "../../packages/sim/src/content/unit-references";
import { compileParticleEffectParameters } from "./unit-particle-contract";

function nemeanParticle() {
  const reference = unitReferenceEntry("greek-nemean-lion");
  if (reference?.family !== "myth") throw new Error("Nemean Lion myth reference is missing.");
  const evidence = reference.source.assetInventory.specialParticles?.[0];
  if (evidence === undefined) throw new Error("Nemean Lion particle evidence is missing.");
  return evidence;
}

function sphinxParticle() {
  const reference = unitReferenceEntry("egyptian-sphinx");
  if (reference?.family !== "myth") throw new Error("Sphinx myth reference is missing.");
  const evidence = reference.source.assetInventory.specialParticles?.[0];
  if (evidence === undefined) throw new Error("Sphinx particle evidence is missing.");
  return evidence;
}

function medusaParticle() {
  const reference = unitReferenceEntry("greek-medusa");
  if (reference?.family !== "myth") throw new Error("Medusa myth reference is missing.");
  const evidence = reference.source.assetInventory.specialParticles?.[0];
  if (evidence === undefined) throw new Error("Medusa particle evidence is missing.");
  return evidence;
}

function avengerParticle() {
  const reference = unitReferenceEntry("egyptian-avenger");
  if (reference?.family !== "myth") throw new Error("Avenger myth reference is missing.");
  const evidence = reference.source.assetInventory.specialParticles?.[0];
  if (evidence === undefined) throw new Error("Avenger particle evidence is missing.");
  return evidence;
}

function scorpionPoisonParticle() {
  const reference = unitReferenceEntry("egyptian-scorpion-man");
  if (reference?.family !== "myth") throw new Error("Scorpion Man myth reference is missing.");
  const evidence = reference.source.assetInventory.specialParticles?.[0];
  if (evidence === undefined) throw new Error("Scorpion Man poison evidence is missing.");
  return evidence;
}

function petsuchosBallGlow() {
  const reference = unitReferenceEntry("egyptian-petsuchos");
  if (reference?.family !== "myth") throw new Error("Petsuchos myth reference is missing.");
  const evidence = reference.source.assetInventory.beamParticles?.[0];
  if (evidence === undefined) throw new Error("Petsuchos ball-glow evidence is missing.");
  return evidence;
}

describe("source-backed unit particle contract", () => {
  test("compiles the complete supported runtime effect from source evidence", () => {
    expect(compileParticleEffectParameters(nemeanParticle(), 60)).toEqual({
      blend: "additive",
      spreader: "radial-horizontal",
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
      appearanceWeights: [1],
    });
  });

  test("rejects a source shape the shared renderer has not proven", () => {
    expect(() =>
      compileParticleEffectParameters({ ...nemeanParticle(), offAxisDegrees: 0 }, 60),
    ).toThrow("unsupported source-to-runtime particle mapping");
  });

  test("maps the looping zero-duration Sphinx source to its synchronized action window", () => {
    expect(compileParticleEffectParameters(sphinxParticle(), 32)).toMatchObject({
      blend: "normal",
      spreader: "vertical",
      particleLifetimeSeconds: 2,
      emissionDurationSeconds: 1.6,
      initialVelocity: 3,
      baseScale: 5.5,
      scaleStart: 1,
      scaleEnd: 0.2,
    });
  });

  test("maps Medusa's unsynchronized box emitter to a bounded continuous head glow", () => {
    expect(compileParticleEffectParameters(medusaParticle(), 40)).toMatchObject({
      blend: "additive",
      spreader: "vertical",
      emissionMode: "continuous",
      maxParticles: 5,
      particleLifetimeSeconds: 0.5,
      emissionDurationSeconds: 2,
      emissionRatePerSecond: 4,
      initialVelocity: 0,
      heightOffset: 2.1,
      baseScale: 2,
    });
  });

  test("maps Avenger's non-looping rectangle emitter and constant source scale", () => {
    expect(compileParticleEffectParameters(avengerParticle(), 30)).toMatchObject({
      blend: "additive",
      spreader: "vertical",
      emissionShape: "rectangle-horizontal",
      emissionRadiusX: 0.25,
      emissionRadiusZ: 0.25,
      emissionMode: "finite",
      maxParticles: 3,
      particleLifetimeSeconds: 1,
      emissionStartSeconds: 0.4,
      emissionDurationSeconds: 0.5,
      initialVelocity: 0,
      heightOffset: 1,
      baseScale: 3.5,
      scaleStart: 1,
      scaleEnd: 1,
    });
  });

  test("maps Scorpion Man's target-side poison plume across its status lifetime", () => {
    expect(compileParticleEffectParameters(scorpionPoisonParticle(), 300)).toMatchObject({
      blend: "additive",
      spreader: "vertical",
      emissionShape: "rectangle-horizontal",
      emissionRadiusX: 0.2,
      emissionRadiusZ: 0.2,
      emissionMode: "continuous",
      maxParticles: 5,
      particleLifetimeSeconds: 2,
      emissionDurationSeconds: 15,
      emissionRatePerSecond: 2,
      initialVelocity: 0.5,
      heightOffset: 0,
      baseScale: 1.5,
      scaleStart: 0.8,
      scaleEnd: 1,
    });
  });

  test("maps Petsuchos' unsynchronized ball glow across its beam action", () => {
    expect(compileParticleEffectParameters(petsuchosBallGlow(), 60)).toMatchObject({
      blend: "additive",
      spreader: "vertical",
      emissionMode: "continuous",
      maxParticles: 5,
      particleLifetimeSeconds: 2,
      emissionDurationSeconds: 3,
      emissionRatePerSecond: 1,
      initialVelocity: 0,
      heightOffset: 1.3,
      baseScale: 1,
      scaleStart: 0.5,
      scaleEnd: 1,
    });
  });
});
