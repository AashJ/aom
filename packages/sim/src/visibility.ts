import { UNIT_TYPES } from "./ecs/types";
import type { World } from "./ecs/world";
import { MAP_TILES } from "./terrain";

export const VIS_UNSEEN = 0;
export const VIS_EXPLORED = 1;
export const VIS_VISIBLE = 2;
export const VISIBILITY_TILES = MAP_TILES * MAP_TILES;

export function updateVisibility(world: World): void {
  for (let slot = 0; slot < world.playerCount; slot += 1) {
    const start = slot * VISIBILITY_TILES;
    const end = start + VISIBILITY_TILES;

    for (let offset = start; offset < end; offset += 1) {
      if (world.visibility[offset] === VIS_VISIBLE) {
        world.visibility[offset] = VIS_EXPLORED;
      }
    }
  }

  for (let i = 0; i < world.count; i += 1) {
    if (world.dying[i] === 1 || world.hp[i] === 0) continue;

    const slot = world.playerSlotById[world.owner[i]!]!;

    if (slot < 0) continue;

    const stats = UNIT_TYPES[world.unitType[i]!]!;

    if (
      stats.lineOfSight <= 0 ||
      (stats.footprint > 0 && world.buildProgress[i]! < stats.buildTicks)
    ) {
      continue;
    }

    const centerX = world.posX[i]!;
    const centerZ = world.posZ[i]!;
    const radius = stats.lineOfSight;
    const radiusSq = radius * radius;
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(MAP_TILES - 1, Math.floor(centerX + radius));
    const minZ = Math.max(0, Math.floor(centerZ - radius));
    const maxZ = Math.min(MAP_TILES - 1, Math.floor(centerZ + radius));
    const base = slot * VISIBILITY_TILES;

    for (let z = minZ; z <= maxZ; z += 1) {
      const dz = z + 0.5 - centerZ;

      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - centerX;

        if (dx * dx + dz * dz <= radiusSq) {
          world.visibility[base + z * MAP_TILES + x] = VIS_VISIBLE;
        }
      }
    }
  }
}

export function isFootprintVisibleTo(
  world: World,
  playerId: number,
  tileX: number,
  tileZ: number,
  size: number,
): boolean {
  const slot = world.playerSlotById[playerId]!;

  if (slot < 0) return false;

  const base = slot * VISIBILITY_TILES;

  for (let z = tileZ; z < tileZ + size; z += 1) {
    for (let x = tileX; x < tileX + size; x += 1) {
      if (
        x < 0 ||
        x >= MAP_TILES ||
        z < 0 ||
        z >= MAP_TILES ||
        world.visibility[base + z * MAP_TILES + x] !== VIS_VISIBLE
      ) {
        return false;
      }
    }
  }

  return true;
}

export function isEntityVisibleTo(world: World, playerId: number, entityIndex: number): boolean {
  if (entityIndex < 0 || entityIndex >= world.count) return false;
  if (world.owner[entityIndex] === playerId) return true;

  const slot = world.playerSlotById[playerId]!;

  if (slot < 0) return false;

  const stats = UNIT_TYPES[world.unitType[entityIndex]!]!;
  const footprint = stats.footprint;

  if (footprint > 0) {
    const tileX = Math.round(world.posX[entityIndex]! - footprint / 2);
    const tileZ = Math.round(world.posZ[entityIndex]! - footprint / 2);
    const base = slot * VISIBILITY_TILES;

    for (let z = tileZ; z < tileZ + footprint; z += 1) {
      for (let x = tileX; x < tileX + footprint; x += 1) {
        if (
          x >= 0 &&
          x < MAP_TILES &&
          z >= 0 &&
          z < MAP_TILES &&
          world.visibility[base + z * MAP_TILES + x] === VIS_VISIBLE
        ) {
          return true;
        }
      }
    }

    return false;
  }

  const tileX = Math.max(0, Math.min(MAP_TILES - 1, Math.floor(world.posX[entityIndex]!)));
  const tileZ = Math.max(0, Math.min(MAP_TILES - 1, Math.floor(world.posZ[entityIndex]!)));

  return world.visibility[slot * VISIBILITY_TILES + tileZ * MAP_TILES + tileX] === VIS_VISIBLE;
}
