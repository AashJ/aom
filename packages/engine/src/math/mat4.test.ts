import { describe, expect, test } from "bun:test";
import * as mat4 from "./mat4";
import * as vec3 from "./vec3";

describe("mat4", () => {
  test("perspective maps camera-space z into WebGPU depth", () => {
    const proj = mat4.create();
    const out = vec3.create();

    mat4.perspective(proj, Math.PI / 4, 16 / 9, 0.1, 100);
    mat4.transformPoint(out, proj, vec3.create(0, 0, -0.1));

    // WebGPU uses [0, 1] clip depth; this guards against porting WebGL's [-1, 1] matrix.
    expect(out[2]!).toBeCloseTo(0, 5);

    mat4.transformPoint(out, proj, vec3.create(0, 0, -100));
    expect(out[2]!).toBeCloseTo(1, 5);

    mat4.transformPoint(out, proj, vec3.create(0, 0, -50));
    expect(out[2]!).toBeGreaterThan(0.9);
    expect(out[2]!).toBeLessThan(1);
  });

  test("lookAt maps eye to origin and target to negative z", () => {
    const eye = vec3.create(3, 4, 5);
    const target = vec3.create(0, 0, 0);
    const view = mat4.create();
    const out = vec3.create();

    mat4.lookAt(view, eye, target, vec3.create(0, 1, 0));
    mat4.transformPoint(out, view, eye);

    expect(out[0]!).toBeCloseTo(0, 5);
    expect(out[1]!).toBeCloseTo(0, 5);
    expect(out[2]!).toBeCloseTo(0, 5);

    mat4.transformPoint(out, view, target);

    expect(out[0]!).toBeCloseTo(0, 5);
    expect(out[1]!).toBeCloseTo(0, 5);
    expect(out[2]!).toBeCloseTo(-Math.sqrt(3 * 3 + 4 * 4 + 5 * 5), 5);
  });

  test("inverts a view-projection matrix for unprojection", () => {
    const proj = mat4.create();
    const view = mat4.create();
    const viewProj = mat4.create();
    const inv = mat4.create();
    const world = vec3.create(1.5, -2, 3.5);
    const clip = vec3.create();
    const back = vec3.create();

    mat4.perspective(proj, Math.PI / 4, 16 / 9, 0.1, 100);
    mat4.lookAt(view, vec3.create(3, 4, 5), vec3.create(0, 0, 0), vec3.create(0, 1, 0));
    mat4.multiply(viewProj, proj, view);

    expect(mat4.invert(inv, viewProj)).toBe(true);

    mat4.transformPoint(clip, viewProj, world);
    mat4.transformPoint(back, inv, clip);

    expect(back[0]!).toBeCloseTo(1.5, 3);
    expect(back[1]!).toBeCloseTo(-2, 3);
    expect(back[2]!).toBeCloseTo(3.5, 3);
  });

  test("multiply is alias-safe for either input", () => {
    const a = mat4.create();
    const b = mat4.create();
    const ref = mat4.create();
    const aliasA = mat4.create();
    const aliasB = mat4.create();

    mat4.lookAt(a, vec3.create(1, 2, 3), vec3.create(0, 1, 0), vec3.create(0, 1, 0));
    mat4.perspective(b, 1, 1.5, 0.5, 60);
    mat4.multiply(ref, a, b);
    aliasA.set(a);
    aliasB.set(b);
    mat4.multiply(aliasA, aliasA, b);
    mat4.multiply(aliasB, a, aliasB);

    for (let index = 0; index < 16; index += 1) {
      expect(aliasA[index]!).toBeCloseTo(ref[index]!, 5);
      expect(aliasB[index]!).toBeCloseTo(ref[index]!, 5);
    }
  });

  test("invert rejects the zero matrix", () => {
    expect(mat4.invert(mat4.create(), new Float32Array(16))).toBe(false);
  });

  test("transformDirection ignores translation and is alias-safe", () => {
    const transform = mat4.create();
    const direction = vec3.create(1, 2, 3);

    transform[12] = 100;
    transform[13] = 200;
    transform[14] = 300;
    mat4.transformDirection(direction, transform, direction);

    expect(direction[0]!).toBeCloseTo(1, 5);
    expect(direction[1]!).toBeCloseTo(2, 5);
    expect(direction[2]!).toBeCloseTo(3, 5);
  });
});
