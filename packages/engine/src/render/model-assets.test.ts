import { describe, expect, test } from "bun:test";
import { parseClassicModelGlb } from "./glb";
import { MODEL_CONFIGS, MODEL_INDEX } from "./model-assets";

describe("named model registry", () => {
  test("derives every GPU index and attachment target from a named model", () => {
    expect(new Set(MODEL_CONFIGS.map((config) => config.key)).size).toBe(MODEL_CONFIGS.length);

    for (const [index, config] of MODEL_CONFIGS.entries()) {
      expect(MODEL_INDEX[config.key]).toBe(index);
      if (config.attachment) {
        expect(MODEL_CONFIGS[MODEL_INDEX[config.attachment.model]]?.key).toBe(
          config.attachment.model,
        );
      }
    }
  });

  test("loads all four original Greek prayer clips with animation", async () => {
    const prayerFiles = [
      "villager-g-male-pray-a.glb",
      "villager-g-male-pray-b.glb",
      "villager-g-female-pray-a.glb",
      "villager-g-female-pray-b.glb",
    ];
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = (async () => ({}) as ImageBitmap) as typeof createImageBitmap;

    try {
      for (const file of prayerFiles) {
        const url = new URL(`../assets/models/${file}`, import.meta.url);
        const model = await parseClassicModelGlb(await Bun.file(url).arrayBuffer(), file);
        expect(model.primitives.length).toBeGreaterThan(0);
        expect(model.duration).toBeGreaterThan(0);
      }
    } finally {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    }
  });
});
