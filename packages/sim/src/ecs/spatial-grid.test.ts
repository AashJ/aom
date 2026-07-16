import { describe, expect, test } from "bun:test";
import { NO_TARGET } from "./id";
import {
  GRID_CELLS,
  GRID_DIM,
  gridCoordinateForPosition,
  rebuildUnitSpatialGrid,
  visitUnitSpatialGridAabb,
} from "./spatial-grid";

describe("deterministic unit spatial grid", () => {
  test("owns world-position clamping for every grid consumer", () => {
    expect(gridCoordinateForPosition(-1)).toBe(0);
    expect(gridCoordinateForPosition(0)).toBe(0);
    expect(gridCoordinateForPosition(2)).toBe(1);
    expect(gridCoordinateForPosition(999)).toBe(GRID_DIM - 1);
  });

  test("buckets units in dense order and clamps map-edge positions", () => {
    const state = {
      count: 5,
      posX: new Float64Array([2.1, 0.1, 2.9, -1, 999]),
      posZ: new Float64Array([2.1, 0.1, 2.9, -1, 999]),
      cellCount: new Uint32Array(GRID_CELLS),
      cellStart: new Uint32Array(GRID_CELLS + 1),
      cellUnits: new Uint32Array(5),
      containedBy: new Uint32Array(5).fill(NO_TARGET),
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

    const candidates: number[] = [];
    visitUnitSpatialGridAabb(state, 3, 3, 0, 0, candidates, (_state, output, unitIndex) =>
      output.push(unitIndex),
    );
    expect(candidates).toEqual([1, 3, 0, 2]);

    state.containedBy[2] = 123;
    rebuildUnitSpatialGrid(state);
    expect(
      Array.from(
        state.cellUnits.slice(state.cellStart[sharedCell], state.cellStart[sharedCell + 1]),
      ),
    ).toEqual([0]);
    expect(state.cellStart[GRID_CELLS]).toBe(state.count - 1);
  });
});
