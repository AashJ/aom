import { describe, expect, test } from "bun:test";
import {
  PROJECTILE_TYPE_COUNT,
  PROJECTILE_MANTICORE_BARB,
  PROJECTILE_WADJET_SPIT,
  UNIT_CLASS_RESOURCE,
  UNIT_ROSTER,
  UNIT_TYPE_DEFINITIONS,
} from "@aom/sim";
import { TYPE_ICONS } from "../assets/icons";
import {
  BEAM_PRESENTATIONS,
  MAX_PARTICLES_PER_UNIT,
  MODEL_CONFIGS,
  PARTICLE_EFFECT_DEFINITIONS,
  POISON_STATUS_PARTICLE_EFFECT_INDICES,
  PROJECTILE_PRESENTATIONS,
  UNIT_MEDIA,
  UNIT_MEDIA_DEFINITIONS,
  UNIT_PARTICLE_EFFECT_INDICES,
} from "./generated/unit-media";
import { PROJECTILE_MEDIA_DEFINITIONS } from "./projectile-media";

describe("generated unit media catalog", () => {
  test("matches implemented sim ids and keys in stable numeric order", () => {
    const mediaIds = UNIT_MEDIA_DEFINITIONS.map((definition) => definition.type);
    expect(mediaIds).toEqual([...mediaIds].sort((left, right) => left - right));

    for (const sim of UNIT_TYPE_DEFINITIONS) {
      if ((sim.classes & UNIT_CLASS_RESOURCE) !== 0) continue;
      expect(UNIT_MEDIA[sim.id]?.key).toBe(sim.key);
    }
  });

  test("derives model and icon indexes without hand-maintained entries", () => {
    expect(new Set(MODEL_CONFIGS.map((model) => model.key)).size).toBe(MODEL_CONFIGS.length);
    for (const media of UNIT_MEDIA_DEFINITIONS) {
      if (media.icon) expect(TYPE_ICONS[media.type]).toBe(media.icon);
    }
  });

  test("requires complete shared media for every stable projectile type", () => {
    const projectileTypes: number[] = PROJECTILE_MEDIA_DEFINITIONS.map(
      (definition) => definition.type,
    );
    expect(projectileTypes).toEqual(
      Array.from({ length: PROJECTILE_TYPE_COUNT }, (_, index) => index),
    );
    expect(PROJECTILE_PRESENTATIONS).toHaveLength(PROJECTILE_TYPE_COUNT);
    for (const definition of PROJECTILE_MEDIA_DEFINITIONS) {
      const presentation = PROJECTILE_PRESENTATIONS[definition.type]!;
      expect(presentation.kind).toBe(definition.kind);
      if (definition.kind === "model" && presentation.kind === "model") {
        expect(presentation.modelIndices.map((index) => MODEL_CONFIGS[index]?.key)).toEqual(
          definition.models.map((model) => model.key),
        );
      } else if (definition.kind === "particle" && presentation.kind === "particle") {
        expect(presentation.textureUrl).toBe(definition.textureUrl);
        expect(presentation.particleCount).toBe(definition.particleCount);
      }
      if (definition.type === PROJECTILE_WADJET_SPIT) {
        expect(definition.audio?.files).toHaveLength(1);
      }
      if (definition.type === PROJECTILE_MANTICORE_BARB) {
        expect(definition.audio?.files).toHaveLength(1);
        expect(definition.audio?.volume).toBe(0.3);
        expect(definition.audio?.maxVoices).toBe(2);
      }
    }
  });

  test("requires complete media for every implemented ordinary-unit roster entry", () => {
    const implemented = UNIT_ROSTER.filter(
      (entry) =>
        (entry.family === "ordinary-melee" || entry.family === "ordinary-projectile") &&
        entry.status === "implemented" &&
        UNIT_MEDIA[entry.id] !== undefined,
    );

    for (const entry of implemented) {
      const media = UNIT_MEDIA[entry.id]!;
      if (media.presentation.kind !== "model") throw new Error(`${entry.key} must use models`);

      expect(media.presentation.actions.idle).toBeDefined();
      expect(media.presentation.actions.walk).toBeDefined();
      expect(media.presentation.actions.attack).toBeDefined();
      expect(media.presentation.actions.death).toBeDefined();
      expect(media.icon).not.toBeNull();
      expect(media.audio.selection?.files.length).toBeGreaterThan(0);
      expect(media.audio.acknowledge?.files.length).toBeGreaterThan(0);
      expect(media.audio.attackAcknowledge?.files.length).toBeGreaterThan(0);
    }
  });

  test("compiles source-bound special particles into one renderer catalog", () => {
    expect(PARTICLE_EFFECT_DEFINITIONS).toHaveLength(9);
    expect(PARTICLE_EFFECT_DEFINITIONS[0]).toMatchObject({
      key: "greekNemeanLionSoundWave",
      trigger: "special-attack",
      blend: "additive",
      maxParticles: 20,
      particleLifetimeSeconds: 0.8,
      emissionStartSeconds: 1.1,
      emissionDurationSeconds: 1,
      emissionRatePerSecond: 8,
      emissionRateVariance: 0.2,
      initialVelocity: 5,
      baseScale: 6,
      scaleStart: 0,
      scaleEnd: 1,
    });
    expect(PARTICLE_EFFECT_DEFINITIONS[1]).toMatchObject({
      key: "greekMedusaHeadGlow",
      trigger: "special-attack",
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
      scaleStart: 0.8,
      scaleEnd: 1,
    });
    for (let index = 2; index <= 4; index += 1) {
      expect(PARTICLE_EFFECT_DEFINITIONS[index]).toMatchObject({
        trigger: "special-attack",
        blend: "additive",
        spreader: "forward",
        maxParticles: 15,
        particleLifetimeSeconds: 1,
        emissionStartSeconds: 0.6,
        emissionDurationSeconds: 1,
        emissionRatePerSecond: 15,
        initialVelocity: 6,
        baseScale: 1,
        scaleStart: 0.2,
        scaleEnd: 1,
      });
    }
    expect(PARTICLE_EFFECT_DEFINITIONS[2]?.appearanceWeightStart).toBe(0);
    expect(PARTICLE_EFFECT_DEFINITIONS[2]?.appearanceWeightEnd).toBeCloseTo(1 / 3);
    expect(PARTICLE_EFFECT_DEFINITIONS[4]?.appearanceWeightStart).toBeCloseTo(2 / 3);
    expect(PARTICLE_EFFECT_DEFINITIONS[4]?.appearanceWeightEnd).toBe(1);
    expect(PARTICLE_EFFECT_DEFINITIONS[5]).toMatchObject({
      key: "egyptianSphinxSandTornado",
      trigger: "special-attack",
      blend: "normal",
      spreader: "vertical",
      maxParticles: 35,
      particleLifetimeSeconds: 2,
      emissionDurationSeconds: 1.6,
      initialVelocity: 3,
      baseScale: 5.5,
      scaleStart: 1,
      scaleEnd: 0.2,
    });
    expect(PARTICLE_EFFECT_DEFINITIONS[7]).toMatchObject({
      key: "egyptianAvengerSwordSwoosh",
      trigger: "special-attack",
      blend: "additive",
      spreader: "vertical",
      emissionShape: "rectangle-horizontal",
      emissionRadiusX: 0.25,
      emissionRadiusZ: 0.25,
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
    expect(PARTICLE_EFFECT_DEFINITIONS[6]).toMatchObject({
      key: "egyptianPetsuchosBallGlow",
      trigger: "beam-attack",
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
    expect(PARTICLE_EFFECT_DEFINITIONS[8]).toMatchObject({
      key: "egyptianScorpionPoison",
      trigger: "poisoned-status",
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
      baseScale: 1.5,
      scaleStart: 0.8,
      scaleEnd: 1,
    });
    expect(POISON_STATUS_PARTICLE_EFFECT_INDICES).toEqual([8]);
    expect(MAX_PARTICLES_PER_UNIT).toBe(40);
    const nemeanMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "greek-nemean-lion",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[nemeanMedia.type]).toEqual([0]);
    const medusaMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "greek-medusa",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[medusaMedia.type]).toEqual([1]);
    const sphinxMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "egyptian-sphinx",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[sphinxMedia.type]).toEqual([5]);
    const chimeraMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "greek-chimera",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[chimeraMedia.type]).toEqual([2, 3, 4]);
    const avengerMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "egyptian-avenger",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[avengerMedia.type]).toEqual([7]);
    const scorpionMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "egyptian-scorpion-man",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[scorpionMedia.type]).toEqual([8]);
    const petsuchosMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "egyptian-petsuchos",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[petsuchosMedia.type]).toEqual([6]);
    expect(BEAM_PRESENTATIONS[petsuchosMedia.type]).toMatchObject({
      startTicks: 27,
      endTicks: 60,
      width: 0.38,
      sourceHeight: 1.3,
    });
  });
});
