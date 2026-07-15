import { describe, expect, test } from "bun:test";
import { createSnapshot } from "@aom/sim";
import type { RuntimeProjectilePresentation } from "../content/unit-media-schema";
import * as mat4 from "../math/mat4";
import {
  PROJECTILE_VISUAL_FACING_X,
  PROJECTILE_VISUAL_FACING_Z,
  PROJECTILE_VISUAL_FLOATS,
  PROJECTILE_VISUAL_PROGRESS,
  PROJECTILE_VISUAL_X,
  PROJECTILE_VISUAL_Z,
  projectileFlightHeight,
  resolveProjectilePresentation,
  writeProjectileModelTransform,
  writeProjectileVisualState,
} from "./projectile-presentation";

const presentation: RuntimeProjectilePresentation = {
  modelIndex: 0,
  flightHeight: 1,
  arcHeight: 0.75,
  forwardAxis: "positive-z",
};

describe("projectile presentation", () => {
  test("resolves only visible projectiles with registered media", () => {
    const snapshot = createSnapshot(1, 1);
    snapshot.projectileCount = 1;
    snapshot.projectileVisible[0] = 1;
    snapshot.projectileTypes[0] = 0;
    expect(resolveProjectilePresentation(snapshot, 0)).not.toBeNull();

    snapshot.projectileVisible[0] = 0;
    expect(resolveProjectilePresentation(snapshot, 0)).toBeNull();
    snapshot.projectileVisible[0] = 1;
    snapshot.projectileTypes[0] = 255;
    expect(resolveProjectilePresentation(snapshot, 0)).toBeNull();
  });

  test("interpolates only matching stable projectile identities", () => {
    const prev = createSnapshot(1, 1);
    const curr = createSnapshot(1, 1);
    const out = new Float32Array(PROJECTILE_VISUAL_FLOATS);
    prev.projectileCount = curr.projectileCount = 1;
    prev.projectileIds[0] = curr.projectileIds[0] = 7;
    prev.projectilePosX[0] = 2;
    prev.projectilePosZ[0] = 4;
    prev.projectileFacingX[0] = 1;
    prev.projectileProgress[0] = 0.25;
    curr.projectilePosX[0] = 6;
    curr.projectilePosZ[0] = 8;
    curr.projectileFacingZ[0] = 1;
    curr.projectileProgress[0] = 0.75;

    writeProjectileVisualState(out, prev, curr, 0, 0.5);

    expect(out[PROJECTILE_VISUAL_X]).toBe(4);
    expect(out[PROJECTILE_VISUAL_Z]).toBe(6);
    expect(out[PROJECTILE_VISUAL_FACING_X]).toBeCloseTo(Math.SQRT1_2);
    expect(out[PROJECTILE_VISUAL_FACING_Z]).toBeCloseTo(Math.SQRT1_2);
    expect(out[PROJECTILE_VISUAL_PROGRESS]).toBe(0.5);

    curr.projectileIds[0] = 8;
    writeProjectileVisualState(out, prev, curr, 0, 0.5);
    expect(out[PROJECTILE_VISUAL_X]).toBe(6);
    expect(out[PROJECTILE_VISUAL_Z]).toBe(8);
    expect(out[PROJECTILE_VISUAL_PROGRESS]).toBe(0.75);
  });

  test("derives a presentation-only parabola from authoritative progress", () => {
    expect(projectileFlightHeight(presentation, 0)).toBe(1);
    expect(projectileFlightHeight(presentation, 0.5)).toBe(1.75);
    expect(projectileFlightHeight(presentation, 1)).toBe(1);
  });

  test("normalizes each Classic projectile model axis onto local forward", () => {
    const transform = mat4.create();

    writeProjectileModelTransform(transform, "negative-z");
    expect(transform[10]! * -1).toBe(1);

    writeProjectileModelTransform(transform, "positive-y");
    expect(transform[6]).toBe(1);

    writeProjectileModelTransform(transform, "positive-z");
    expect(transform).toEqual(mat4.create());
  });
});
