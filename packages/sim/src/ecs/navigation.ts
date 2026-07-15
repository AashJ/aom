import { buildFlowField, cellOf, type FlowField } from "../flow";
import { MAP_TILES } from "../terrain";
import type { World } from "./world";

const FIELD_CACHE_SIZE = 8;

export function setFacingToward(
  world: World,
  index: number,
  targetX: number,
  targetZ: number,
): void {
  const dx = targetX - world.posX[index]!;
  const dz = targetZ - world.posZ[index]!;

  if (dx === 0 && dz === 0) {
    return;
  }

  const inverseLength = 1 / Math.sqrt(dx * dx + dz * dz);
  world.facingX[index] = dx * inverseLength;
  world.facingZ[index] = dz * inverseLength;
}

export function assignFieldGoal(
  world: World,
  index: number,
  targetX: number,
  targetZ: number,
  footprint = 0,
): void {
  // MOVE keeps its walkable-goal remap before calling this. Static buildings keep their blocked
  // center as the logical/cache goal, but route to every walkable cell around their footprint.
  const goalCell = cellOf(targetX, targetZ);
  let fieldForGoal: FlowField | null = null;

  for (let cacheIndex = 0; cacheIndex < world.fieldCache.length; cacheIndex += 1) {
    const field = world.fieldCache[cacheIndex]!;

    if (field.goalCell === goalCell) {
      fieldForGoal = field;
      world.fieldCache.splice(cacheIndex, 1);
      world.fieldCache.push(field);
      break;
    }
  }

  if (fieldForGoal === null) {
    if (footprint > 0) {
      const minTileX = Math.round(targetX - footprint / 2);
      const minTileZ = Math.round(targetZ - footprint / 2);
      const maxTileX = minTileX + footprint - 1;
      const maxTileZ = minTileZ + footprint - 1;
      const routeGoalCells: number[] = [];

      // Multi-source routing lets each unit approach the nearest reachable side instead of
      // funneling everyone toward one arbitrary corner that terrain may isolate.
      for (let z = minTileZ - 1; z <= maxTileZ + 1; z += 1) {
        for (let x = minTileX - 1; x <= maxTileX + 1; x += 1) {
          if (
            x !== minTileX - 1 &&
            x !== maxTileX + 1 &&
            z !== minTileZ - 1 &&
            z !== maxTileZ + 1
          ) {
            continue;
          }

          if (x < 0 || x >= MAP_TILES || z < 0 || z >= MAP_TILES) {
            continue;
          }

          const routeGoalCell = z * MAP_TILES + x;

          if (world.walkable[routeGoalCell] === 1) {
            routeGoalCells.push(routeGoalCell);
          }
        }
      }

      fieldForGoal = buildFlowField(world.walkable, goalCell, routeGoalCells);
    } else {
      fieldForGoal = buildFlowField(world.walkable, goalCell);
    }

    world.fieldCache.push(fieldForGoal);

    if (world.fieldCache.length > FIELD_CACHE_SIZE) {
      world.fieldCache.shift();
    }
  }

  world.unitField[index] = fieldForGoal;
  world.moveTargetX[index] = targetX;
  world.moveTargetZ[index] = targetZ;
  world.moving[index] = 1;
}
