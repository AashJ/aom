import { describe, expect, test } from "bun:test";
import { MAX_MODEL_MORPH_TARGETS } from "./glb";
import {
  MODEL_INSTANCE_ATTRIBUTES,
  MODEL_INSTANCE_FLOATS,
  MODEL_INSTANCE_MATRIX_ATTRIBUTE_LOCATION,
  MODEL_INSTANCE_MATRIX_OFFSET,
  MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT,
  MODEL_INSTANCE_MORPH_ATTRIBUTE_LOCATION,
  MODEL_INSTANCE_MORPH_OFFSET,
  MODEL_INSTANCE_STRIDE,
  modelIndexUploadData,
} from "./model-gpu-layout";

describe("model GPU layout", () => {
  test("pads odd uint16 index data without changing its contents", () => {
    const indices = new Uint16Array([2, 1, 0]);
    const source = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);
    const upload = modelIndexUploadData(indices);

    expect(upload.byteLength).toBe(8);
    expect(upload.slice(0, source.byteLength)).toEqual(source);
    expect(upload.slice(source.byteLength)).toEqual(new Uint8Array(2));
  });

  test("keeps the CPU attributes and WGSL inputs on one morph-capacity contract", async () => {
    expect(MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT).toBe(MAX_MODEL_MORPH_TARGETS / 4);
    expect(MODEL_INSTANCE_MATRIX_OFFSET).toBe(
      MODEL_INSTANCE_MORPH_OFFSET + MAX_MODEL_MORPH_TARGETS,
    );
    expect(MODEL_INSTANCE_FLOATS).toBe(MODEL_INSTANCE_MATRIX_OFFSET + 16);
    expect(MODEL_INSTANCE_STRIDE).toBe(MODEL_INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT);

    const morphAttributes = MODEL_INSTANCE_ATTRIBUTES.slice(
      3,
      3 + MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT,
    );
    expect(morphAttributes.map((attribute) => attribute.shaderLocation)).toEqual(
      Array.from(
        { length: MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT },
        (_, index) => MODEL_INSTANCE_MORPH_ATTRIBUTE_LOCATION + index,
      ),
    );
    expect(
      MODEL_INSTANCE_ATTRIBUTES.slice(-4).map((attribute) => attribute.shaderLocation),
    ).toEqual(
      Array.from({ length: 4 }, (_, index) => MODEL_INSTANCE_MATRIX_ATTRIBUTE_LOCATION + index),
    );

    const shader = await Bun.file(new URL("../shaders/models.wgsl", import.meta.url)).text();
    expect(shader).toContain(`const MODEL_MORPH_TARGET_COUNT = ${MAX_MODEL_MORPH_TARGETS}u;`);
    expect(
      Array.from(shader.matchAll(/@location\((\d+)\) morph\d+:/g), (match) => Number(match[1])),
    ).toEqual(morphAttributes.map((attribute) => attribute.shaderLocation));
    expect(
      Array.from(shader.matchAll(/@location\((\d+)\) local\d+:/g), (match) => Number(match[1])),
    ).toEqual(
      Array.from({ length: 4 }, (_, index) => MODEL_INSTANCE_MATRIX_ATTRIBUTE_LOCATION + index),
    );
  });
});
