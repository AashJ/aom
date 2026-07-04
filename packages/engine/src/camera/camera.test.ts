import { describe, expect, test } from "bun:test";
import * as camera from "./camera";
import * as mat4 from "../math/mat4";
import * as vec3 from "../math/vec3";

describe("camera", () => {
  test("viewDir is normalized and points downward", () => {
    const cam = camera.createCamera();

    expect(vec3.length(cam.viewDir)).toBeCloseTo(1, 5);
    expect(cam.viewDir[1]!).toBeLessThan(0);
  });

  test("updates eye and matrices from target and distance", () => {
    const cam = camera.createCamera();

    camera.updateMatrices(cam, 16 / 9);

    const dx = cam.eye[0]! - cam.target[0]!;
    const dy = cam.eye[1]! - cam.target[1]!;
    const dz = cam.eye[2]! - cam.target[2]!;
    expect(Math.sqrt(dx * dx + dy * dy + dz * dz)).toBeCloseTo(cam.distance, 5);
    expect(cam.eye[1]!).toBeGreaterThan(0);
  });

  test("projects target to the center of clip space", () => {
    const cam = camera.createCamera();
    const point = vec3.create();

    camera.updateMatrices(cam, 16 / 9);
    mat4.transformPoint(point, cam.viewProj, cam.target);

    expect(point[0]!).toBeCloseTo(0, 3);
    expect(point[1]!).toBeCloseTo(0, 3);
    expect(point[2]!).toBeGreaterThan(0);
    expect(point[2]!).toBeLessThan(1);
  });

  test("screen center ray hits the target on the ground", () => {
    const cam = camera.createCamera();
    const point = vec3.create();

    camera.updateMatrices(cam, 16 / 9);

    expect(camera.screenToGround(cam, 0, 0, point)).toBe(true);
    expect(point[0]!).toBeCloseTo(cam.target[0]!, 3);
    expect(point[1]!).toBeCloseTo(0, 3);
    expect(point[2]!).toBeCloseTo(cam.target[2]!, 3);
  });

  test("pans in ground-plane view axes and clamps to bounds", () => {
    const cam = camera.createCamera();
    const startX = cam.target[0]!;
    const startY = cam.target[1]!;
    const startZ = cam.target[2]!;

    camera.pan(cam, 0, 10);

    const dx = cam.target[0]! - startX;
    const dz = cam.target[2]! - startZ;
    expect(Math.sqrt(dx * dx + dz * dz)).toBeCloseTo(10, 4);
    expect(cam.target[1]!).toBeCloseTo(startY, 5);

    camera.pan(cam, 10000, 10000);

    expect(cam.target[0]!).toBeGreaterThanOrEqual(cam.bounds[0]!);
    expect(cam.target[0]!).toBeLessThanOrEqual(cam.bounds[2]!);
    expect(cam.target[2]!).toBeGreaterThanOrEqual(cam.bounds[1]!);
    expect(cam.target[2]!).toBeLessThanOrEqual(cam.bounds[3]!);
  });

  test("zoom clamps distance", () => {
    const cam = camera.createCamera();

    camera.zoom(cam, 0.0001);
    expect(cam.distance).toBe(camera.MIN_DISTANCE);

    camera.zoom(cam, 10000);
    expect(cam.distance).toBe(camera.MAX_DISTANCE);
  });
});
