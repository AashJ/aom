import { describe, expect, test } from "bun:test";
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
});
