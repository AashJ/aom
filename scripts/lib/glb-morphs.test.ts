import { describe, expect, test } from "bun:test";
import { resampleGlbMorphTargets } from "./glb-morphs";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function align4(value: number): number {
  return (value + 3) & ~3;
}

function encodeSyntheticGlb(gltf: unknown, binary: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = align4(json.length);
  const output = new Uint8Array(12 + 8 + jsonLength + 8 + binary.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  output.fill(0x20, 20, 20 + jsonLength);
  output.set(json, 20);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binary.length, true);
  view.setUint32(binaryHeader + 4, BIN_CHUNK, true);
  output.set(binary, binaryHeader + 8);
  return output;
}

function syntheticMorphGlb(staticMeshFirst = false): Uint8Array {
  const binary = new Uint8Array(40);
  new Float32Array(binary.buffer, 0, 2).set([0, 1]);
  new Float32Array(binary.buffer, 8, 8).set([0, 1, 0, 0, 0, 0, 0, 1]);
  const morphMesh = {
    weights: [0, 0, 0, 0],
    primitives: [
      {
        targets: [{ POSITION: 10 }, { POSITION: 11 }, { POSITION: 12 }, { POSITION: 13 }],
      },
    ],
  };
  const gltf = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 32 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
      { bufferView: 1, componentType: 5126, count: 8, type: "SCALAR" },
    ],
    meshes: staticMeshFirst ? [{ primitives: [{}] }, morphMesh] : [morphMesh],
    nodes: [{ mesh: staticMeshFirst ? 1 : 0 }],
    animations: [
      {
        channels: [{ sampler: 0, target: { node: 0, path: "weights" } }],
        samplers: [{ input: 0, output: 1 }],
      },
    ],
  };
  return encodeSyntheticGlb(gltf, binary);
}

function heterogeneousMorphGlb(): Uint8Array {
  const binary = new Uint8Array(80);
  new Float32Array(binary.buffer, 0, 2).set([0, 1]);
  new Float32Array(binary.buffer, 8, 8).set([0, 1, 0, 0, 0, 0, 0, 1]);
  new Float32Array(binary.buffer, 40, 10).set([0, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  return encodeSyntheticGlb(
    {
      asset: { version: "2.0" },
      buffers: [{ byteLength: binary.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 8 },
        { buffer: 0, byteOffset: 8, byteLength: 32 },
        { buffer: 0, byteOffset: 40, byteLength: 40 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
        { bufferView: 1, componentType: 5126, count: 8, type: "SCALAR" },
        { bufferView: 2, componentType: 5126, count: 10, type: "SCALAR" },
      ],
      meshes: [
        {
          weights: [0, 0, 0, 0],
          primitives: [{ targets: [10, 11, 12, 13].map((POSITION) => ({ POSITION })) }],
        },
        {
          weights: [0, 0, 0, 0, 0],
          primitives: [{ targets: [20, 21, 22, 23, 24].map((POSITION) => ({ POSITION })) }],
        },
      ],
      nodes: [{ mesh: 0 }, { mesh: 1 }],
      animations: [
        {
          channels: [
            { sampler: 0, target: { node: 0, path: "weights" } },
            { sampler: 1, target: { node: 1, path: "weights" } },
          ],
          samplers: [
            { input: 0, output: 1 },
            { input: 0, output: 2 },
          ],
        },
      ],
    },
    binary,
  );
}

interface DecodedMorphGlb {
  accessors: Array<{ bufferView: number; count: number }>;
  bufferViews: Array<{ byteOffset?: number }>;
  meshes: Array<{
    weights?: number[];
    primitives: Array<{ targets?: Array<{ POSITION: number }> }>;
  }>;
  animations: Array<{ samplers: Array<{ input: number; output: number }> }>;
}

function decodeGlb(output: Uint8Array): { gltf: DecodedMorphGlb; jsonLength: number } {
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const jsonLength = view.getUint32(12, true);
  return {
    gltf: JSON.parse(
      new TextDecoder().decode(output.subarray(20, 20 + jsonLength)),
    ) as DecodedMorphGlb,
    jsonLength,
  };
}

describe("Classic GLB morph resampling", () => {
  test("preserves the animation clock and interpolates omitted vertex frames", () => {
    const output = resampleGlbMorphTargets(syntheticMorphGlb(), 3);
    const { gltf, jsonLength } = decodeGlb(output);
    const sampler = gltf.animations[0]!.samplers[0]!;
    const accessor = gltf.accessors[sampler.output]!;
    const bufferView = gltf.bufferViews[accessor.bufferView]!;
    const binaryStart = 20 + jsonLength + 8;
    const weights = new Float32Array(
      output.buffer,
      output.byteOffset + binaryStart + (bufferView.byteOffset ?? 0),
      accessor.count,
    );

    expect(sampler.input).toBe(0);
    expect(gltf.meshes[0]!.primitives[0]!.targets!.map((target) => target.POSITION)).toEqual([
      10, 12, 13,
    ]);
    expect(gltf.meshes[0]!.weights).toEqual([0, 0, 0]);
    expect(Array.from(weights)).toEqual([0.5, 0.5, 0, 0, 0, 1]);
  });

  test("finds morph animation on a later mesh instead of assuming mesh zero", () => {
    const output = resampleGlbMorphTargets(syntheticMorphGlb(true), 3);
    const { gltf } = decodeGlb(output);

    expect(gltf.meshes[0]!.primitives[0]!.targets).toBeUndefined();
    expect(gltf.meshes[1]!.primitives[0]!.targets!.map((target) => target.POSITION)).toEqual([
      10, 12, 13,
    ]);
    expect(gltf.meshes[1]!.weights).toEqual([0, 0, 0]);
  });

  test("resamples each animated mesh against its own source target count", () => {
    const output = resampleGlbMorphTargets(heterogeneousMorphGlb(), 3);
    const { gltf } = decodeGlb(output);
    const [firstSampler, secondSampler] = gltf.animations[0]!.samplers;

    expect(gltf.meshes[0]!.primitives[0]!.targets!.map((target) => target.POSITION)).toEqual([
      10, 12, 13,
    ]);
    expect(gltf.meshes[1]!.primitives[0]!.targets!.map((target) => target.POSITION)).toEqual([
      20, 22, 24,
    ]);
    expect(gltf.accessors[firstSampler!.output]!.count).toBe(6);
    expect(gltf.accessors[secondSampler!.output]!.count).toBe(6);
  });
});
