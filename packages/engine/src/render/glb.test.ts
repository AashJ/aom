import { describe, expect, test } from "bun:test";
import { parseClassicModelGlb } from "./glb";

interface FixtureGltf {
  accessors: Array<{
    bufferView: number;
    byteOffset: number;
    componentType: number;
    count: number;
    type: string;
  }>;
  bufferViews: Array<{ byteOffset: number; byteLength: number }>;
  meshes: Array<{
    primitives: Array<{
      attributes: Record<string, number>;
      indices: number;
      material: number;
      targets?: Array<Record<string, number>>;
    }>;
  }>;
  materials: Array<{ name: string; alphaMode: string; alphaCutoff: number }>;
  nodes: Array<{ name: string; mesh?: number }>;
  animations?: Array<{
    channels: Array<{
      sampler: number;
      target: { node: number; path: "translation" };
    }>;
    samplers: Array<{ input: number; output: number; interpolation: string }>;
  }>;
}

function classicFixture(mutate?: (gltf: FixtureGltf) => void): ArrayBuffer {
  const gltf: FixtureGltf = {
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 1, type: "VEC3" },
      { bufferView: 0, byteOffset: 12, componentType: 5126, count: 1, type: "VEC2" },
      { bufferView: 0, byteOffset: 20, componentType: 5123, count: 3, type: "SCALAR" },
      { bufferView: 0, byteOffset: 28, componentType: 5126, count: 1, type: "SCALAR" },
      { bufferView: 0, byteOffset: 32, componentType: 5126, count: 1, type: "VEC3" },
    ],
    bufferViews: [{ byteOffset: 0, byteLength: 64 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 0, TEXCOORD_0: 1 },
            indices: 2,
            material: 0,
          },
        ],
      },
    ],
    materials: [{ name: "Body( pixelxform1)", alphaMode: "MASK", alphaCutoff: 0.4 }],
    nodes: [{ name: "Visible", mesh: 0 }, { name: "Dummy_hand" }],
  };
  mutate?.(gltf);

  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = json.length + ((4 - (json.length % 4)) % 4);
  const binaryLength = 64;
  const file = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(file);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, file.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  const jsonBytes = new Uint8Array(file, 20, jsonLength);
  jsonBytes.fill(0x20);
  jsonBytes.set(json);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  return file;
}

describe("Classic model GLB contract", () => {
  test("normalizes the supported Classic material semantics", async () => {
    const asset = await parseClassicModelGlb(classicFixture(), "fixture", {
      requiredNodes: ["dummy_HAND"],
    });

    expect(asset.materials[0]).toEqual({
      image: null,
      pixelTransform: "multiply-player-color",
      alpha: { mode: "mask", cutoff: 0.4 },
    });
  });

  test("rejects missing vertex attributes and attachment nodes", async () => {
    await expect(
      parseClassicModelGlb(
        classicFixture((gltf) => delete gltf.meshes[0]!.primitives[0]!.attributes.NORMAL),
        "fixture",
      ),
    ).rejects.toThrow("primitive 0 NORMAL is missing");
    await expect(
      parseClassicModelGlb(classicFixture(), "fixture", { requiredNodes: ["Dummy_missing"] }),
    ).rejects.toThrow("required attachment node Dummy_missing is missing");
  });

  test("rejects animation interpolation the sampler cannot reproduce", async () => {
    await expect(
      parseClassicModelGlb(
        classicFixture((gltf) => {
          gltf.animations = [
            {
              channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
              samplers: [{ input: 3, output: 4, interpolation: "STEP" }],
            },
          ];
        }),
        "fixture",
      ),
    ).rejects.toThrow("unsupported STEP interpolation");
  });

  test("rejects models above the GPU morph target limit", async () => {
    await expect(
      parseClassicModelGlb(
        classicFixture((gltf) => {
          gltf.meshes[0]!.primitives[0]!.targets = Array.from({ length: 13 }, () => ({
            POSITION: 0,
            NORMAL: 0,
          }));
        }),
        "fixture",
      ),
    ).rejects.toThrow("has 13 morph targets; the renderer supports 12");
  });
});
