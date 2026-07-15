// Flow fields per ARCHITECTURE.md M3: one field serves every unit ordered to the
// same goal; built at command time (allocation acceptable there, like commands),
// never per tick. Integer-cost Dijkstra keeps the build fully deterministic; the
// only floats are the final normalized directions.
import { MAP_TILES } from "./terrain";

const CELL_COUNT = MAP_TILES * MAP_TILES;
const UNVISITED = 0xffffffff;
// Integer 10/14 approximates the 1/sqrt(2) diagonal ratio: the classic
// grid-Dijkstra trick keeps the whole search in exact integer math.
const STRAIGHT_COST = 10;
const DIAGONAL_COST = 14;

// This order is part of the determinism contract and must not be reordered
// casually: N, NE, E, SE, S, SW, W, NW.
const NEIGHBOR_DX = new Int8Array([0, 1, 1, 1, 0, -1, -1, -1]);
const NEIGHBOR_DZ = new Int8Array([-1, -1, 0, 1, 1, 1, 0, -1]);
const NEIGHBOR_COST = new Uint8Array([
  STRAIGHT_COST,
  DIAGONAL_COST,
  STRAIGHT_COST,
  DIAGONAL_COST,
  STRAIGHT_COST,
  DIAGONAL_COST,
  STRAIGHT_COST,
  DIAGONAL_COST,
]);
// Unit-length neighbor vectors. The search still uses an eight-neighbor grid,
// but the final flow at each cell blends every downhill neighbor instead of
// storing one predecessor. Runtime sampling then interpolates those vectors so
// steering is not locked to eight headings.
const INV_SQRT2 = 1 / Math.sqrt(2);
const NEIGHBOR_UNIT_X = new Float32Array(8);
const NEIGHBOR_UNIT_Z = new Float32Array(8);
for (let i = 0; i < 8; i += 1) {
  const scale = NEIGHBOR_DX[i]! !== 0 && NEIGHBOR_DZ[i]! !== 0 ? INV_SQRT2 : 1;
  NEIGHBOR_UNIT_X[i] = NEIGHBOR_DX[i]! * scale;
  NEIGHBOR_UNIT_Z[i] = NEIGHBOR_DZ[i]! * scale;
}

// Module-level scratch is safe because builds are synchronous and single-threaded.
// This module is intentionally non-reentrant.
// Max accumulated cost is well under 2^16 on this map, but Uint32Array is
// headroom over cleverness rather than a tight bound.
const costs = new Uint32Array(CELL_COUNT);
// Dial's algorithm (bucket queue): edge costs are small integers (10/14), so
// cells are binned by cost and scanned in ascending order — no heap, no log n.
// Dijkstra's final cost field is unique regardless of pop order, so the derived
// direction field is bit-identical to the old binary-heap version's.
// Worst path cost is <= MAP_TILES * 2 * DIAGONAL_COST = 7168; 8192 is headroom.
const MAX_BUCKET_COST = 8192;
const bucketHead = new Int32Array(MAX_BUCKET_COST);
// Pushes append immutable entry slots (cell, next) instead of linking cells
// intrusively: a cell re-pushed at a cheaper cost would otherwise corrupt the
// chain of the bucket it already sits in. Stale entries are skipped by
// comparing against costs[cell] (lazy deletion). Capacity is 4 pushes per cell,
// same slack the old heap used.
const ENTRY_CAPACITY = CELL_COUNT * 4;
const entryCell = new Int32Array(ENTRY_CAPACITY);
const entryNext = new Int32Array(ENTRY_CAPACITY);
let entryCount = 0;

function bucketPush(cost: number, cell: number): void {
  // Both guards are unreachable on this map's cost bounds; if either ever
  // fires it fires identically on every client, so determinism holds.
  if (cost >= MAX_BUCKET_COST || entryCount >= ENTRY_CAPACITY) {
    return;
  }

  entryCell[entryCount] = cell;
  entryNext[entryCount] = bucketHead[cost]!;
  bucketHead[cost] = entryCount;
  entryCount += 1;
}

export interface FlowField {
  goalCell: number;
  dirX: Float32Array;
  dirZ: Float32Array;
}

export function cellOf(x: number, z: number): number {
  const tileX = Math.min(MAP_TILES - 1, Math.max(0, Math.floor(x)));
  const tileZ = Math.min(MAP_TILES - 1, Math.max(0, Math.floor(z)));

  return tileZ * MAP_TILES + tileX;
}

export function buildFlowField(
  walkable: Uint8Array,
  goalCell: number,
  routeGoalCells?: readonly number[],
): FlowField {
  // Command-time allocation, not per-tick.
  const dirX = new Float32Array(CELL_COUNT);
  const dirZ = new Float32Array(CELL_COUNT);

  if (routeGoalCells === undefined && walkable[goalCell] !== 1) {
    // Callers remap unwalkable goals to a walkable cell before calling this;
    // building interactions instead provide their walkable perimeter cells.
    return { goalCell, dirX, dirZ };
  }

  costs.fill(UNVISITED);
  bucketHead.fill(-1);
  entryCount = 0;

  if (routeGoalCells === undefined) {
    costs[goalCell] = 0;
    bucketPush(0, goalCell);
  } else {
    let seededGoal = false;

    for (const routeGoalCell of routeGoalCells) {
      if (
        routeGoalCell < 0 ||
        routeGoalCell >= CELL_COUNT ||
        walkable[routeGoalCell] !== 1 ||
        costs[routeGoalCell] === 0
      ) {
        continue;
      }

      costs[routeGoalCell] = 0;
      bucketPush(0, routeGoalCell);
      seededGoal = true;
    }

    if (!seededGoal) {
      return { goalCell, dirX, dirZ };
    }
  }

  // Relaxed costs are always >= the bucket being scanned (monotone), so a
  // single ascending pass over the buckets visits every live entry.
  for (let currentCost = 0; currentCost < MAX_BUCKET_COST; currentCost += 1) {
    let entry = bucketHead[currentCost]!;

    while (entry !== -1) {
      const cell = entryCell[entry]!;
      entry = entryNext[entry]!;

      if (currentCost !== costs[cell]) {
        continue;
      }

      // MAP_TILES is 256, so decompose the cell id with bit ops instead of
      // % and floor-divide: measurably faster in this hot loop.
      const tileX = cell & (MAP_TILES - 1);
      const tileZ = cell >>> 8;

      for (let i = 0; i < NEIGHBOR_DX.length; i += 1) {
        const dx = NEIGHBOR_DX[i]!;
        const dz = NEIGHBOR_DZ[i]!;
        const neighborX = tileX + dx;
        const neighborZ = tileZ + dz;

        // Check tile bounds explicitly; otherwise cell 255's naive east neighbor
        // id (255 + 1 = 256) looks in-bounds but is row 1, column 0.
        if (neighborX < 0 || neighborX >= MAP_TILES || neighborZ < 0 || neighborZ >= MAP_TILES) {
          continue;
        }

        const neighbor = neighborZ * MAP_TILES + neighborX;

        if (walkable[neighbor] !== 1) {
          continue;
        }

        if (dx !== 0 && dz !== 0) {
          const sideA = tileZ * MAP_TILES + neighborX;
          const sideB = neighborZ * MAP_TILES + tileX;

          // Diagonals require both adjacent orthogonal cells so units cannot cut
          // corners through cliff edges or diagonal gaps.
          if (walkable[sideA] !== 1 || walkable[sideB] !== 1) {
            continue;
          }
        }

        const candidateCost = currentCost + NEIGHBOR_COST[i]!;

        if (candidateCost < costs[neighbor]!) {
          costs[neighbor] = candidateCost;
          bucketPush(candidateCost, neighbor);
        }
      }
    }
  }

  // Blend all legal downhill neighbors into a smooth vector at each cell. The
  // cost drop is the weight, so strong descent wins without discarding useful
  // side gradients around obstacles.
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const centerCost = costs[cell]!;

    if (centerCost === 0 || centerCost === UNVISITED || walkable[cell] !== 1) {
      continue;
    }

    const tileX = cell & (MAP_TILES - 1);
    const tileZ = cell >>> 8;
    let x = 0;
    let z = 0;
    let fallbackCost = UNVISITED;
    let fallbackX = 0;
    let fallbackZ = 0;

    for (let i = 0; i < NEIGHBOR_DX.length; i += 1) {
      const dx = NEIGHBOR_DX[i]!;
      const dz = NEIGHBOR_DZ[i]!;
      const neighborX = tileX + dx;
      const neighborZ = tileZ + dz;

      if (neighborX < 0 || neighborX >= MAP_TILES || neighborZ < 0 || neighborZ >= MAP_TILES) {
        continue;
      }

      const neighbor = neighborZ * MAP_TILES + neighborX;
      const neighborCost = costs[neighbor]!;

      if (walkable[neighbor] !== 1 || neighborCost >= centerCost) {
        continue;
      }

      if (dx !== 0 && dz !== 0) {
        const sideA = tileZ * MAP_TILES + neighborX;
        const sideB = neighborZ * MAP_TILES + tileX;

        if (walkable[sideA] !== 1 || walkable[sideB] !== 1) {
          continue;
        }
      }

      const drop = centerCost - neighborCost;

      // Symmetric routes around an obstacle can cancel to an exact zero vector.
      // Keep the lowest-cost legal neighbor as a deterministic escape direction;
      // NEIGHBOR_DX/DZ order breaks equal-cost ties.
      if (neighborCost < fallbackCost) {
        fallbackCost = neighborCost;
        fallbackX = NEIGHBOR_UNIT_X[i]!;
        fallbackZ = NEIGHBOR_UNIT_Z[i]!;
      }

      x += NEIGHBOR_UNIT_X[i]! * drop;
      z += NEIGHBOR_UNIT_Z[i]! * drop;
    }

    const lengthSq = x * x + z * z;

    if (lengthSq > 0) {
      const inverseLength = 1 / Math.sqrt(lengthSq);
      dirX[cell] = x * inverseLength;
      dirZ[cell] = z * inverseLength;
    } else if (fallbackCost !== UNVISITED) {
      dirX[cell] = fallbackX;
      dirZ[cell] = fallbackZ;
    }
  }

  return { goalCell, dirX, dirZ };
}

export function sampleFlowDirection(
  field: FlowField,
  worldX: number,
  worldZ: number,
  outDirection: Float64Array,
): void {
  // Bilinear interpolation across the four neighboring tile vectors removes
  // cell-boundary heading snaps while keeping integer-aligned move orders on
  // their exact row/column.
  const gridX = Math.min(MAP_TILES - 1, Math.max(0, worldX));
  const gridZ = Math.min(MAP_TILES - 1, Math.max(0, worldZ));
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(MAP_TILES - 1, x0 + 1);
  const z1 = Math.min(MAP_TILES - 1, z0 + 1);
  const tx = gridX - x0;
  const tz = gridZ - z0;
  const i00 = z0 * MAP_TILES + x0;
  const i10 = z0 * MAP_TILES + x1;
  const i01 = z1 * MAP_TILES + x0;
  const i11 = z1 * MAP_TILES + x1;

  // Do not interpolate across a blocked, unreachable, or goal cell: all three
  // have a zero vector, and blending toward zero can make the valid component
  // decay asymptotically before the unit crosses the next tile boundary.
  if (
    (field.dirX[i00] === 0 && field.dirZ[i00] === 0) ||
    (field.dirX[i10] === 0 && field.dirZ[i10] === 0) ||
    (field.dirX[i01] === 0 && field.dirZ[i01] === 0) ||
    (field.dirX[i11] === 0 && field.dirZ[i11] === 0)
  ) {
    outDirection[0] = field.dirX[i00]!;
    outDirection[1] = field.dirZ[i00]!;
    return;
  }

  // A route split can put opposite valid directions on adjacent cells (for
  // example, the north and south ways around a mountain). Interpolating across
  // that seam points into the obstacle or flips every step, so deterministically
  // keep the current cell's branch until the unit crosses the cell boundary.
  if (
    field.dirX[i00]! * field.dirX[i10]! + field.dirZ[i00]! * field.dirZ[i10]! < 0 ||
    field.dirX[i00]! * field.dirX[i01]! + field.dirZ[i00]! * field.dirZ[i01]! < 0 ||
    field.dirX[i10]! * field.dirX[i11]! + field.dirZ[i10]! * field.dirZ[i11]! < 0 ||
    field.dirX[i01]! * field.dirX[i11]! + field.dirZ[i01]! * field.dirZ[i11]! < 0
  ) {
    outDirection[0] = field.dirX[i00]!;
    outDirection[1] = field.dirZ[i00]!;
    return;
  }

  const topX = field.dirX[i00]! + (field.dirX[i10]! - field.dirX[i00]!) * tx;
  const topZ = field.dirZ[i00]! + (field.dirZ[i10]! - field.dirZ[i00]!) * tx;
  const bottomX = field.dirX[i01]! + (field.dirX[i11]! - field.dirX[i01]!) * tx;
  const bottomZ = field.dirZ[i01]! + (field.dirZ[i11]! - field.dirZ[i01]!) * tx;
  const x = topX + (bottomX - topX) * tz;
  const z = topZ + (bottomZ - topZ) * tz;
  const lengthSq = x * x + z * z;

  if (lengthSq === 0) {
    outDirection[0] = 0;
    outDirection[1] = 0;
    return;
  }

  const inverseLength = 1 / Math.sqrt(lengthSq);
  outDirection[0] = x * inverseLength;
  outDirection[1] = z * inverseLength;
}
