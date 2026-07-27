import { describe, expect, test } from "bun:test";
import {
  generateMap,
  MAP_AEGEAN_COAST,
  MAP_RIVER_NILE,
  startLocationsForMap,
  TERRAIN_DOMAIN_LAND,
  TERRAIN_DOMAIN_WATER,
} from "./maps";
import { MAP_TILES } from "./terrain";
import { createPlayableWorld } from "./ecs/world";
import { GOD_RA, GOD_ZEUS } from "./ecs/progression";
import { TYPE_BERRY, TYPE_FISH_PERCH } from "./ecs/types";

describe("deterministic map definitions", () => {
  test("keeps Aegean Coast dry and preserves its established start layout", () => {
    const map = generateMap(MAP_AEGEAN_COAST, 1337, 2);

    expect(map.waterNavigable.every((value) => value === 0)).toBe(true);
    expect(map.startLocations).toEqual([
      [40, 40],
      [216, 216],
    ]);
  });

  test("River Nile is deterministic and separates both banks with navigable water", () => {
    const first = generateMap(MAP_RIVER_NILE, 1337, 2);
    const second = generateMap(MAP_RIVER_NILE, 1337, 2);

    expect(first.heights).toEqual(second.heights);
    expect(first.terrainMaterials).toEqual(second.terrainMaterials);
    expect(first.terrainDomains).toEqual(second.terrainDomains);
    expect(first.startLocations).toEqual(second.startLocations);
    expect(first.waterNavigable.some((value) => value === 1)).toBe(true);
    expect(first.landWalkable.some((value) => value === 1)).toBe(true);

    for (let index = 0; index < first.terrainDomains.length; index += 1) {
      const domain = first.terrainDomains[index]!;
      expect(domain === TERRAIN_DOMAIN_LAND || domain === TERRAIN_DOMAIN_WATER).toBe(true);
      expect(first.landWalkable[index]! + first.waterNavigable[index]!).toBe(1);
    }
  });

  test("River Nile starts opposing players on land across the river", () => {
    const map = generateMap(MAP_RIVER_NILE, 77, 2);
    const [first, second] = map.startLocations;
    const firstTile = Math.floor(first![1]) * MAP_TILES + Math.floor(first![0]);
    const secondTile = Math.floor(second![1]) * MAP_TILES + Math.floor(second![0]);

    expect(map.landWalkable[firstTile]).toBe(1);
    expect(map.landWalkable[secondTile]).toBe(1);
    expect(Math.abs(first![0] - second![0]) + Math.abs(first![1] - second![1])).toBeGreaterThan(
      100,
    );
  });

  test("River Nile handedness can rotate the authored river orientation", () => {
    const first = generateMap(MAP_RIVER_NILE, 1, 2);
    let rotated = false;

    for (let seed = 2; seed < 256; seed += 1) {
      const candidate = generateMap(MAP_RIVER_NILE, seed, 2);
      if (
        Math.abs(candidate.startLocations[0]![0] - candidate.startLocations[1]![0]) !==
        Math.abs(first.startLocations[0]![0] - first.startLocations[1]![0])
      ) {
        rotated = true;
        break;
      }
    }

    expect(rotated).toBe(true);
  });

  test("River Nile produces a complete deterministic two-player opening", () => {
    const players = [
      { id: 0, majorGod: GOD_ZEUS },
      { id: 1, majorGod: GOD_RA },
    ] as const;
    const first = createPlayableWorld(1337, 6, players, undefined, MAP_RIVER_NILE);
    const second = createPlayableWorld(1337, 6, players, undefined, MAP_RIVER_NILE);

    expect(first.mapId).toBe(MAP_RIVER_NILE);
    expect(first.mapSeed).toBe(second.mapSeed);
    expect(first.count).toBe(second.count);
    expect(first.posX.slice(0, first.count)).toEqual(second.posX.slice(0, second.count));
    expect(first.posZ.slice(0, first.count)).toEqual(second.posZ.slice(0, second.count));
    const starts = startLocationsForMap(MAP_RIVER_NILE, first.mapSeed, players.length);
    const berries: number[] = [];
    const fish: number[] = [];

    for (let index = 0; index < first.count; index += 1) {
      const tile = Math.floor(first.posZ[index]!) * MAP_TILES + Math.floor(first.posX[index]!);

      if (first.unitType[index] === TYPE_FISH_PERCH) {
        fish.push(index);
        expect(first.terrainDomains[tile]).toBe(TERRAIN_DOMAIN_WATER);
        expect(first.hp[index]).toBe(1_000);

        const tileX = Math.floor(first.posX[index]!);
        const tileZ = Math.floor(first.posZ[index]!);
        for (let dz = -6; dz <= 6; dz += 1) {
          for (let dx = -6; dx <= 6; dx += 1) {
            if (dx * dx + dz * dz > 36) continue;
            expect(first.terrainDomains[(tileZ + dz) * MAP_TILES + tileX + dx]).toBe(
              TERRAIN_DOMAIN_WATER,
            );
          }
        }
      } else {
        expect(first.terrainDomains[tile]).toBe(TERRAIN_DOMAIN_LAND);
      }

      if (first.unitType[index] === TYPE_BERRY) berries.push(index);
    }

    // river nile.xs: one 10-bush far patch and three 3-fish schools per player.
    expect(berries).toHaveLength(10);
    expect(fish).toHaveLength(18);

    for (const berry of berries) {
      for (const [startX, startZ] of starts) {
        const dx = first.posX[berry]! - startX;
        const dz = first.posZ[berry]! - startZ;
        expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(60 * 60);
      }
      for (const otherBerry of berries) {
        const dx = first.posX[berry]! - first.posX[otherBerry]!;
        const dz = first.posZ[berry]! - first.posZ[otherBerry]!;
        expect(dx * dx + dz * dz).toBeLessThanOrEqual(8 * 8);
      }
    }
  });
});
