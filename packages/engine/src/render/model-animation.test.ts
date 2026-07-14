import { describe, expect, test } from "bun:test";
import type { ModelAsset } from "./glb";
import { MAX_MORPH_TARGETS, sampleModelAnimation } from "./model-animation";

const asset: ModelAsset = {
  primitives: [],
  materials: [],
  nodes: [
    {
      name: "Dummy_righthand",
      parent: -1,
      translation: new Float32Array([0, 0, 0]),
      rotation: new Float32Array([0, 0, 0, 1]),
      scale: new Float32Array([1, 1, 1]),
      translationTrack: {
        times: new Float32Array([0, 1]),
        values: new Float32Array([0, 0, 0, 2, 0, 0]),
        components: 3,
      },
    },
  ],
  nodeIndexByName: new Map([["dummy_righthand", 0]]),
  morphTrack: {
    times: new Float32Array([0, 1]),
    weights: new Float32Array([1, 0, 0, 1]),
    targetCount: 2,
  },
  duration: 1,
  groundOffset: 0,
};

describe("sampleModelAnimation", () => {
  test("interpolates morph weights and attachment transforms on the same clock", () => {
    const state = {
      weights: new Float32Array(MAX_MORPH_TARGETS),
      nodeMatrix: new Float32Array(16),
    };

    sampleModelAnimation(asset, 0.5, 0, state);

    expect(state.weights[0]).toBeCloseTo(0.5);
    expect(state.weights[1]).toBeCloseTo(0.5);
    expect(state.nodeMatrix[12]).toBeCloseTo(1);
    expect(state.nodeMatrix[15]).toBe(1);
  });

  test("loops model time and returns identity when no attachment node is requested", () => {
    const state = {
      weights: new Float32Array(MAX_MORPH_TARGETS),
      nodeMatrix: new Float32Array(16),
    };

    sampleModelAnimation(asset, 1.5, -1, state);

    expect(state.weights[0]).toBeCloseTo(0.5);
    expect(state.weights[1]).toBeCloseTo(0.5);
    expect(Array.from(state.nodeMatrix)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
});
