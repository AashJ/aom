import {
  computeWalkable,
  generateHeightmap,
  generateTerrainMaterials,
  MAP_TILES,
  TERRAIN_DIRT_A,
  VERTS_PER_ROW,
} from "./terrain";

export const MAP_AEGEAN_COAST = "aegean-coast";
export const MAP_RIVER_NILE = "river-nile";
export const DEFAULT_MAP_ID = MAP_AEGEAN_COAST;
export const MAP_IDS = [MAP_AEGEAN_COAST, MAP_RIVER_NILE] as const;
export type MapId = (typeof MAP_IDS)[number];

export const TERRAIN_DOMAIN_LAND = 1 << 0;
export const TERRAIN_DOMAIN_WATER = 1 << 1;

export type StartLocation = readonly [number, number];

export interface GeneratedMap {
  readonly id: MapId;
  readonly seed: number;
  readonly heights: Float32Array;
  readonly terrainMaterials: Uint8Array;
  readonly terrainDomains: Uint8Array;
  readonly landWalkable: Uint8Array;
  readonly waterNavigable: Uint8Array;
  readonly waterLevel: number;
  readonly startLocations: readonly StartLocation[];
}

const AEGEAN_START_LOCATIONS_BY_PLAYER_COUNT: readonly (readonly StartLocation[])[] = [
  [],
  [[40, 40]],
  [
    [40, 40],
    [216, 216],
  ],
  [
    [128, 40],
    [204, 172],
    [52, 172],
  ],
  [
    [40, 40],
    [216, 216],
    [216, 40],
    [40, 216],
  ],
];

function aegeanStartLocations(playerCount: number): readonly StartLocation[] {
  const locations = AEGEAN_START_LOCATIONS_BY_PLAYER_COUNT[playerCount];

  if (locations === undefined || locations.length !== playerCount) {
    throw new RangeError(`Aegean Coast does not support ${playerCount} players.`);
  }

  return locations;
}

function hash2D(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  const sz = tz * tz * tz * (tz * (tz * 6 - 15) + 10);
  const n00 = hash2D(x0, z0, seed);
  const n10 = hash2D(x0 + 1, z0, seed);
  const n01 = hash2D(x0, z0 + 1, seed);
  const n11 = hash2D(x0 + 1, z0 + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;

  return nx0 + (nx1 - nx0) * sz;
}

function nileStartLocations(
  playerCount: number,
  horizontalRiver: boolean,
): readonly StartLocation[] {
  if (playerCount < 1 || playerCount > 4) {
    throw new RangeError(`River Nile does not support ${playerCount} players.`);
  }

  const starts: StartLocation[] = [];
  const perBank = Math.ceil(playerCount / 2);

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const bankIndex = playerIndex & 1;
    const slot = Math.floor(playerIndex / 2);
    const along = ((slot + 1) * MAP_TILES) / (perBank + 1);
    const across = bankIndex === 0 ? 46 : MAP_TILES - 46;

    starts.push(horizontalRiver ? [along, across] : [across, along]);
  }

  return starts;
}

export function startLocationsForMap(
  id: MapId,
  seed: number,
  playerCount: number,
): readonly StartLocation[] {
  switch (id) {
    case MAP_AEGEAN_COAST:
      return aegeanStartLocations(playerCount);
    case MAP_RIVER_NILE:
      return nileStartLocations(playerCount, hash2D(0, 0, seed) < 0.5);
  }
}

function generateAegeanCoast(seed: number, playerCount: number): GeneratedMap {
  const heights = generateHeightmap(seed);
  const terrainMaterials = generateTerrainMaterials(seed, heights);
  const landWalkable = computeWalkable(heights);
  const terrainDomains = new Uint8Array(MAP_TILES * MAP_TILES);
  const waterNavigable = new Uint8Array(terrainDomains.length);

  for (let index = 0; index < terrainDomains.length; index += 1) {
    if (landWalkable[index] === 1) terrainDomains[index] = TERRAIN_DOMAIN_LAND;
  }

  return {
    id: MAP_AEGEAN_COAST,
    seed,
    heights,
    terrainMaterials,
    terrainDomains,
    landWalkable,
    waterNavigable,
    waterLevel: 0,
    startLocations: startLocationsForMap(MAP_AEGEAN_COAST, seed, playerCount),
  };
}

function generateRiverNile(seed: number, playerCount: number): GeneratedMap {
  const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
  const terrainMaterials = new Uint8Array(heights.length);
  const terrainDomains = new Uint8Array(MAP_TILES * MAP_TILES);
  const landWalkable = new Uint8Array(terrainDomains.length);
  const waterNavigable = new Uint8Array(terrainDomains.length);
  const horizontalRiver = hash2D(0, 0, seed) < 0.5;
  // Classic initializes the complete map as Egyptian Nile water, then builds
  // separated team land areas. For fewer than four teams its authored minimum
  // inter-team water width is 45 m.
  const halfRiverWidth = 22.5;
  const shoreBlend = 4;

  for (let z = 0; z < VERTS_PER_ROW; z += 1) {
    for (let x = 0; x < VERTS_PER_ROW; x += 1) {
      const along = horizontalRiver ? x : z;
      const across = horizontalRiver ? z : x;
      const centerNoise = valueNoise(along / 72, 0, seed + 17) - 0.5;
      const riverCenter = MAP_TILES * 0.5 + centerNoise * 18;
      const distanceFromCenter = Math.abs(across - riverCenter);
      const landDistance = distanceFromCenter - halfRiverWidth;
      const broad = valueNoise(x / 64, z / 64, seed + 31);
      const detail = valueNoise(x / 22, z / 22, seed + 47);
      let height = -2.25 + detail * 0.35;

      if (landDistance >= 0) {
        const blend = Math.min(1, landDistance / shoreBlend);
        height = -0.35 + blend * (3.1 + broad * 0.8 + detail * 0.35);
      }

      heights[z * VERTS_PER_ROW + x] = height;

      // Classic paints SandA on team land, SandC on player areas, and SandB
      // around the inner start. DirtA is the extracted sand texture in the
      // current terrain catalog; keep Nile dry instead of blending in Aegean
      // grass while the other two Classic sand variants remain unavailable.
      terrainMaterials[z * VERTS_PER_ROW + x] = TERRAIN_DIRT_A;
    }
  }

  for (let z = 0; z < MAP_TILES; z += 1) {
    for (let x = 0; x < MAP_TILES; x += 1) {
      const centerX = x + 0.5;
      const centerZ = z + 0.5;
      const along = horizontalRiver ? centerX : centerZ;
      const across = horizontalRiver ? centerZ : centerX;
      const riverCenter = MAP_TILES * 0.5 + (valueNoise(along / 72, 0, seed + 17) - 0.5) * 18;
      const index = z * MAP_TILES + x;

      if (Math.abs(across - riverCenter) < halfRiverWidth) {
        terrainDomains[index] = TERRAIN_DOMAIN_WATER;
        waterNavigable[index] = 1;
      } else {
        terrainDomains[index] = TERRAIN_DOMAIN_LAND;
        landWalkable[index] = 1;
      }
    }
  }

  return {
    id: MAP_RIVER_NILE,
    seed,
    heights,
    terrainMaterials,
    terrainDomains,
    landWalkable,
    waterNavigable,
    waterLevel: 0,
    startLocations: startLocationsForMap(MAP_RIVER_NILE, seed, playerCount),
  };
}

export function generateMap(id: MapId, seed: number, playerCount: number): GeneratedMap {
  switch (id) {
    case MAP_AEGEAN_COAST:
      return generateAegeanCoast(seed, playerCount);
    case MAP_RIVER_NILE:
      return generateRiverNile(seed, playerCount);
  }
}

export function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && MAP_IDS.includes(value as MapId);
}

export function buildSurfaceHeightmap(
  terrainHeights: Float32Array,
  waterNavigable: Uint8Array,
  waterLevel: number,
): Float32Array {
  if (terrainHeights.length !== VERTS_PER_ROW * VERTS_PER_ROW) {
    throw new RangeError("Surface terrain must contain one value per terrain vertex.");
  }
  if (waterNavigable.length !== MAP_TILES * MAP_TILES) {
    throw new RangeError("Surface water mask must contain one value per map tile.");
  }

  const surface = terrainHeights.slice();

  for (let z = 0; z < VERTS_PER_ROW; z += 1) {
    for (let x = 0; x < VERTS_PER_ROW; x += 1) {
      let touchesWater = false;

      for (let tileZ = Math.max(0, z - 1); tileZ <= Math.min(MAP_TILES - 1, z); tileZ += 1) {
        for (let tileX = Math.max(0, x - 1); tileX <= Math.min(MAP_TILES - 1, x); tileX += 1) {
          if (waterNavigable[tileZ * MAP_TILES + tileX] === 1) {
            touchesWater = true;
            break;
          }
        }
        if (touchesWater) break;
      }

      if (touchesWater) {
        const index = z * VERTS_PER_ROW + x;
        surface[index] = Math.max(surface[index]!, waterLevel);
      }
    }
  }

  return surface;
}
