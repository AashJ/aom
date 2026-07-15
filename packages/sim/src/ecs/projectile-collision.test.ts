import { describe, expect, test } from "bun:test";
import { projectileCircleEntryFraction, projectileHitComesFirst } from "./projectile-collision";

describe("deterministic projectile collision kernel", () => {
  test("returns the normalized entry point for a swept circle hit", () => {
    const hit = projectileCircleEntryFraction(0, 0, 10, 0, 5, 0, 1);

    expect(hit).toBe(0.4);
    expect(projectileCircleEntryFraction(0, 0, 10, 0, 5, 3, 1)).toBe(-1);
  });

  test("treats a segment that starts inside the body as immediate contact", () => {
    expect(projectileCircleEntryFraction(5, 0, 10, 0, 5, 0, 1)).toBe(0);
  });

  test("orders contacts by entry fraction and then stable target id", () => {
    expect(projectileHitComesFirst(0.7, 80, 0.4, 60)).toBe(true);
    expect(projectileHitComesFirst(0.4, 60, 0.7, 80)).toBe(false);
    expect(projectileHitComesFirst(0.4, 60, 0.4, 50)).toBe(true);
    expect(projectileHitComesFirst(-1, 0, 0.4, 60)).toBe(true);
    expect(projectileHitComesFirst(0.4, 60, -1, 0)).toBe(false);
  });
});
