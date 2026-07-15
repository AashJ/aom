import { describe, expect, test } from "bun:test";
import { parseClassicModelGlb } from "./glb";
import { MODEL_CONFIGS, PROJECTILE_PRESENTATIONS } from "./model-assets";

describe("named model registry", () => {
  test("derives every GPU index and attachment target from a named model", () => {
    expect(new Set(MODEL_CONFIGS.map((config) => config.key)).size).toBe(MODEL_CONFIGS.length);

    for (const config of MODEL_CONFIGS) {
      for (const attachment of config.attachments ?? []) {
        expect(MODEL_CONFIGS[attachment.modelIndex]).toBeDefined();
      }
    }
  });

  test("keeps projectile models in the same registry rebuilt after device loss", () => {
    for (const presentation of PROJECTILE_PRESENTATIONS) {
      expect(MODEL_CONFIGS[presentation.modelIndex]).toBeDefined();
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
    const decodedTextureBytes: number[] = [];
    globalThis.createImageBitmap = (async (source: ImageBitmapSource) => {
      if (source instanceof Blob) decodedTextureBytes.push(source.size);
      return {} as ImageBitmap;
    }) as typeof createImageBitmap;

    try {
      for (const file of prayerFiles) {
        const url = new URL(`../assets/models/${file}`, import.meta.url);
        const textureStart = decodedTextureBytes.length;
        const model = await parseClassicModelGlb(await Bun.file(url).arrayBuffer(), file);
        expect(model.primitives.length).toBeGreaterThan(0);
        expect(model.duration).toBeGreaterThan(0);
        expect(decodedTextureBytes.slice(textureStart)).toHaveLength(2);
        expect(decodedTextureBytes.slice(textureStart).every((bytes) => bytes > 1_000)).toBe(true);
      }
    } finally {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    }
  });

  test("parses every generated model and attachment contract", async () => {
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = (async () => ({}) as ImageBitmap) as typeof createImageBitmap;

    try {
      for (const [modelIndex, config] of MODEL_CONFIGS.entries()) {
        const requiredNodes = [
          ...(config.attachments ?? []).map((attachment) => attachment.targetNode),
          ...MODEL_CONFIGS.flatMap((owner) =>
            (owner.attachments ?? []).flatMap((attachment) =>
              attachment.modelIndex === modelIndex ? [attachment.hotspotNode] : [],
            ),
          ),
        ];
        const model = await parseClassicModelGlb(
          await Bun.file(config.url).arrayBuffer(),
          config.key,
          { requiredNodes },
        );
        expect(model.primitives.length).toBeGreaterThan(0);
        expect(model.duration).toBeGreaterThanOrEqual(0);
      }
    } finally {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    }
  });
});
