import { MAX_MODEL_MORPH_TARGETS } from "./glb";

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const MORPH_WEIGHTS_PER_ATTRIBUTE = 4;
const LOCAL_MATRIX_FLOATS = 16;

if (MAX_MODEL_MORPH_TARGETS % MORPH_WEIGHTS_PER_ATTRIBUTE !== 0) {
  throw new Error("Model morph capacity must fill complete float32x4 vertex attributes");
}

export const MODEL_INSTANCE_MORPH_OFFSET = 9;
export const MODEL_INSTANCE_MORPH_ATTRIBUTE_LOCATION = 6;
export const MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT =
  MAX_MODEL_MORPH_TARGETS / MORPH_WEIGHTS_PER_ATTRIBUTE;
export const MODEL_INSTANCE_MATRIX_OFFSET = MODEL_INSTANCE_MORPH_OFFSET + MAX_MODEL_MORPH_TARGETS;
export const MODEL_INSTANCE_MATRIX_ATTRIBUTE_LOCATION =
  MODEL_INSTANCE_MORPH_ATTRIBUTE_LOCATION + MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT;
export const MODEL_INSTANCE_FLOATS = MODEL_INSTANCE_MATRIX_OFFSET + LOCAL_MATRIX_FLOATS;
export const MODEL_INSTANCE_STRIDE = MODEL_INSTANCE_FLOATS * FLOAT_BYTES;

export const MODEL_INSTANCE_ATTRIBUTES: readonly GPUVertexAttribute[] = [
  { format: "float32x3", offset: 0, shaderLocation: 3 },
  { format: "float32x2", offset: 3 * FLOAT_BYTES, shaderLocation: 4 },
  { format: "float32x4", offset: 5 * FLOAT_BYTES, shaderLocation: 5 },
  ...Array.from({ length: MODEL_INSTANCE_MORPH_ATTRIBUTE_COUNT }, (_, index) => ({
    format: "float32x4" as const,
    offset: (MODEL_INSTANCE_MORPH_OFFSET + index * MORPH_WEIGHTS_PER_ATTRIBUTE) * FLOAT_BYTES,
    shaderLocation: MODEL_INSTANCE_MORPH_ATTRIBUTE_LOCATION + index,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    format: "float32x4" as const,
    offset: (MODEL_INSTANCE_MATRIX_OFFSET + index * 4) * FLOAT_BYTES,
    shaderLocation: MODEL_INSTANCE_MATRIX_ATTRIBUTE_LOCATION + index,
  })),
];

export function modelIndexUploadData(indices: Uint16Array | Uint32Array): Uint8Array {
  const source = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);
  const upload = new Uint8Array(Math.ceil(source.byteLength / 4) * 4);
  upload.set(source);
  return upload;
}
