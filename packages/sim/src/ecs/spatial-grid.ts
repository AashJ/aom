import { MAP_TILES } from "../terrain";

export const GRID_CELL = 2;
export const GRID_DIM = MAP_TILES / GRID_CELL;
export const GRID_CELLS = GRID_DIM * GRID_DIM;

export interface UnitSpatialGridState {
  readonly count: number;
  readonly posX: Float64Array;
  readonly posZ: Float64Array;
  readonly cellCount: Uint32Array;
  readonly cellStart: Uint32Array;
  readonly cellUnits: Uint32Array;
}

export type UnitSpatialGridVisitor<TState extends UnitSpatialGridState, TContext> = (
  state: TState,
  context: TContext,
  unitIndex: number,
) => void;

export function gridCoordinateForPosition(position: number): number {
  const raw = Math.floor(position / GRID_CELL);
  return raw < 0 ? 0 : raw >= GRID_DIM ? GRID_DIM - 1 : raw;
}

/** Visits AABB candidates in fixed cell order and dense order within each bucket. */
export function visitUnitSpatialGridAabb<TState extends UnitSpatialGridState, TContext>(
  state: TState,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  context: TContext,
  visitor: UnitSpatialGridVisitor<TState, TContext>,
): void {
  const minCellX = gridCoordinateForPosition(Math.min(minX, maxX));
  const maxCellX = gridCoordinateForPosition(Math.max(minX, maxX));
  const minCellZ = gridCoordinateForPosition(Math.min(minZ, maxZ));
  const maxCellZ = gridCoordinateForPosition(Math.max(minZ, maxZ));

  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const cell = cellX + GRID_DIM * cellZ;
      const start = state.cellStart[cell]!;
      const end = state.cellStart[cell + 1]!;
      for (let offset = start; offset < end; offset += 1) {
        visitor(state, context, state.cellUnits[offset]!);
      }
    }
  }
}

/** Rebuilds deterministic dense-unit buckets from authoritative positions. */
export function rebuildUnitSpatialGrid(state: UnitSpatialGridState): void {
  state.cellCount.fill(0, 0, GRID_CELLS);

  for (let index = 0; index < state.count; index += 1) {
    const cellX = gridCoordinateForPosition(state.posX[index]!);
    const cellZ = gridCoordinateForPosition(state.posZ[index]!);
    const cell = cellX + GRID_DIM * cellZ;

    state.cellCount[cell] = state.cellCount[cell]! + 1;
  }

  state.cellStart[0] = 0;
  for (let cell = 0; cell < GRID_CELLS; cell += 1) {
    state.cellStart[cell + 1] = state.cellStart[cell]! + state.cellCount[cell]!;
  }

  state.cellCount.fill(0, 0, GRID_CELLS);

  for (let index = 0; index < state.count; index += 1) {
    const cellX = gridCoordinateForPosition(state.posX[index]!);
    const cellZ = gridCoordinateForPosition(state.posZ[index]!);
    const cell = cellX + GRID_DIM * cellZ;
    const offset = state.cellStart[cell]! + state.cellCount[cell]!;

    // Scatter runs in dense-unit order. Every bucket therefore has a fixed
    // iteration order for collision, acquisition, economy, and separation.
    state.cellUnits[offset] = index;
    state.cellCount[cell] = state.cellCount[cell]! + 1;
  }
}
