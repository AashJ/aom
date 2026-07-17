import { describe, expect, test } from "bun:test";
import { createSnapshot } from "@aom/sim";
import {
  UNIT_POSE_ELEVATION,
  UNIT_POSE_FLOATS,
  UNIT_POSE_X,
  UNIT_POSE_Z,
  unitSnapshotDisplacementSquared,
  writeInterpolatedUnitPose,
} from "./unit-pose";

describe("interpolated unit pose", () => {
  test("interpolates horizontal position and airborne elevation on one clock", () => {
    const prev = createSnapshot(1);
    const curr = createSnapshot(1);
    prev.count = 1;
    curr.count = 1;
    prev.ids[0] = 7;
    curr.ids[0] = 7;
    prev.posX[0] = 10;
    prev.posZ[0] = 20;
    prev.elevation[0] = 2;
    curr.posX[0] = 14;
    curr.posZ[0] = 28;
    curr.elevation[0] = 6;
    const pose = new Float64Array(UNIT_POSE_FLOATS);

    writeInterpolatedUnitPose(pose, prev, curr, 0, 0.25);

    expect(pose[UNIT_POSE_X]).toBe(11);
    expect(pose[UNIT_POSE_Z]).toBe(22);
    expect(pose[UNIT_POSE_ELEVATION]).toBe(3);
    expect(unitSnapshotDisplacementSquared(prev, curr, 0)).toBe(80);
  });

  test("snaps every transform component when dense-slot identity changes", () => {
    const prev = createSnapshot(1);
    const curr = createSnapshot(1);
    prev.count = 1;
    curr.count = 1;
    prev.ids[0] = 7;
    curr.ids[0] = 8;
    prev.posX[0] = 10;
    prev.posZ[0] = 20;
    prev.elevation[0] = 2;
    curr.posX[0] = 14;
    curr.posZ[0] = 28;
    curr.elevation[0] = 6;
    const pose = new Float64Array(UNIT_POSE_FLOATS);

    writeInterpolatedUnitPose(pose, prev, curr, 0, 0.25);

    expect(pose[UNIT_POSE_X]).toBe(14);
    expect(pose[UNIT_POSE_Z]).toBe(28);
    expect(pose[UNIT_POSE_ELEVATION]).toBe(6);
    expect(unitSnapshotDisplacementSquared(prev, curr, 0)).toBe(0);
  });
});
