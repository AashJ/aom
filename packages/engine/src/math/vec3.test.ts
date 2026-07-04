import { describe, expect, test } from "bun:test";
import * as vec3 from "./vec3";

describe("vec3", () => {
  test("computes cross products and dot products", () => {
    const out = vec3.create();

    vec3.cross(out, vec3.create(1, 0, 0), vec3.create(0, 1, 0));

    expect(out[0]!).toBeCloseTo(0, 5);
    expect(out[1]!).toBeCloseTo(0, 5);
    expect(out[2]!).toBeCloseTo(1, 5);
    expect(vec3.dot(vec3.create(1, 2, 3), vec3.create(4, -5, 6))).toBeCloseTo(12, 5);
  });

  test("subtracts vectors", () => {
    const out = vec3.create();

    vec3.sub(out, vec3.create(5, 7, 9), vec3.create(1, 2, 3));

    expect(out[0]!).toBeCloseTo(4, 5);
    expect(out[1]!).toBeCloseTo(5, 5);
    expect(out[2]!).toBeCloseTo(6, 5);
  });

  test("normalizes zero to zero without NaN", () => {
    const out = vec3.create(1, 2, 3);

    vec3.normalize(out, vec3.create(0, 0, 0));

    expect(Number.isNaN(out[0]!)).toBe(false);
    expect(out[0]!).toBeCloseTo(0, 5);
    expect(out[1]!).toBeCloseTo(0, 5);
    expect(out[2]!).toBeCloseTo(0, 5);
  });

  test("adds a scaled vector", () => {
    const out = vec3.create();

    vec3.addScaled(out, vec3.create(1, 1, 1), vec3.create(0, 2, 0), 3);

    expect(out[0]!).toBeCloseTo(1, 5);
    expect(out[1]!).toBeCloseTo(7, 5);
    expect(out[2]!).toBeCloseTo(1, 5);
  });

  test("lerps component-wise", () => {
    const out = vec3.create();

    vec3.lerp(out, vec3.create(0, 0, 0), vec3.create(10, 20, 30), 0.25);

    expect(out[0]!).toBeCloseTo(2.5, 5);
    expect(out[1]!).toBeCloseTo(5, 5);
    expect(out[2]!).toBeCloseTo(7.5, 5);
  });
});
