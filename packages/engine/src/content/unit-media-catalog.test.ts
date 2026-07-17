import { describe, expect, test } from "bun:test";
import {
  PROJECTILE_TYPE_COUNT,
  UNIT_CLASS_RESOURCE,
  UNIT_ROSTER,
  UNIT_TYPE_DEFINITIONS,
} from "@aom/sim";
import { TYPE_ICONS } from "../assets/icons";
import {
  MAX_PARTICLES_PER_UNIT,
  MODEL_CONFIGS,
  PARTICLE_EFFECT_DEFINITIONS,
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
      expect(MODEL_CONFIGS[presentation.modelIndex]?.key).toBe(definition.model.key);
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
    expect(PARTICLE_EFFECT_DEFINITIONS).toHaveLength(1);
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
    });
    expect(MAX_PARTICLES_PER_UNIT).toBe(20);
    const nemeanMedia = UNIT_MEDIA_DEFINITIONS.find(
      (definition) => definition.key === "greek-nemean-lion",
    )!;
    expect(UNIT_PARTICLE_EFFECT_INDICES[nemeanMedia.type]).toEqual([0]);
  });
});
