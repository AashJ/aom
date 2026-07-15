import { describe, expect, test } from "bun:test";
import { UNIT_CLASS_RESOURCE, UNIT_ROSTER, UNIT_TYPE_DEFINITIONS } from "@aom/sim";
import { TYPE_ICONS } from "../assets/icons";
import { MODEL_CONFIGS, UNIT_MEDIA, UNIT_MEDIA_DEFINITIONS } from "./generated/unit-media";

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

  test("requires complete ordinary-melee media for every implemented roster entry", () => {
    const implemented = UNIT_ROSTER.filter(
      (entry) =>
        entry.family === "ordinary-melee" &&
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
});
