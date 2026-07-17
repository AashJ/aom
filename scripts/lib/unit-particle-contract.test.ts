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

describe("source-backed unit particle contract", () => {
  test("compiles the complete supported runtime effect from source evidence", () => {
    expect(compileParticleEffectParameters(nemeanParticle(), 60)).toEqual({
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
    });
  });

  test("rejects a source shape the shared renderer has not proven", () => {
    expect(() =>
      compileParticleEffectParameters({ ...nemeanParticle(), offAxisDegrees: 0 }, 60),
    ).toThrow("unsupported source-to-runtime particle mapping");
  });
});
