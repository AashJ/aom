import { describe, expect, test } from "bun:test";
import { circleSweepEntryFraction } from "./circle-collision";

describe("shared deterministic circle sweep", () => {
  test("returns the first normalized contact along a crossing segment", () => {
    expect(circleSweepEntryFraction(-2, 0, 2, 0, 0, 0, 1)).toBeCloseTo(0.25, 12);
  });

  test("reports immediate contact when the segment starts inside", () => {
    expect(circleSweepEntryFraction(0.5, 0, 2, 0, 0, 0, 1)).toBe(0);
  });

  test("returns no contact for a segment moving away from the circle", () => {
    expect(circleSweepEntryFraction(2, 0, 3, 0, 0, 0, 1)).toBe(-1);
  });
});
