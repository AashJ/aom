import { describe, expect, test } from "bun:test";
import { GRID_CELLS, GRID_DIM, rebuildUnitSpatialGrid } from "./spatial-grid";

describe("deterministic unit spatial grid", () => {
  test("buckets units in dense order and clamps map-edge positions", () => {
    const state = {
      count: 5,
      posX: new Float64Array([2.1, 0.1, 2.9, -1, 999]),
      posZ: new Float64Array([2.1, 0.1, 2.9, -1, 999]),
      cellCount: new Uint32Array(GRID_CELLS),
      cellStart: new Uint32Array(GRID_CELLS + 1),
      cellUnits: new Uint32Array(5),
    };

    rebuildUnitSpatialGrid(state);

    const sharedCell = 1 + GRID_DIM;
    expect(Array.from(state.cellUnits.slice(0, 2))).toEqual([1, 3]);
    expect(
      Array.from(
        state.cellUnits.slice(state.cellStart[sharedCell], state.cellStart[sharedCell + 1]),
      ),
    ).toEqual([0, 2]);
    expect(state.cellUnits[4]).toBe(4);
    expect(state.cellStart[GRID_CELLS]).toBe(state.count);
  });
});
