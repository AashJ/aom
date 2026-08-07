import {
  TYPE_EGYPTIAN_WALL_CONNECTOR,
  TYPE_EGYPTIAN_WALL_LONG,
  TYPE_EGYPTIAN_WALL_MEDIUM,
  TYPE_EGYPTIAN_WALL_SHORT,
  TYPE_GREEK_WALL_CONNECTOR,
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_WALL_MEDIUM,
  TYPE_GREEK_WALL_SHORT,
} from "./unit-type-ids";

export const WALL_COORDINATE_SCALE = 16;
export const MAX_WALL_LINE_LENGTH = 256;

export interface WallFamily {
  readonly connectorType: number;
  readonly shortType: number;
  readonly mediumType: number;
  readonly longType: number;
}

export interface WallLinePiece {
  readonly type: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly facingX: number;
  readonly facingZ: number;
}

const GREEK_WALL_FAMILY: WallFamily = {
  connectorType: TYPE_GREEK_WALL_CONNECTOR,
  shortType: TYPE_GREEK_WALL_SHORT,
  mediumType: TYPE_GREEK_WALL_MEDIUM,
  longType: TYPE_GREEK_WALL_LONG,
};

const EGYPTIAN_WALL_FAMILY: WallFamily = {
  connectorType: TYPE_EGYPTIAN_WALL_CONNECTOR,
  shortType: TYPE_EGYPTIAN_WALL_SHORT,
  mediumType: TYPE_EGYPTIAN_WALL_MEDIUM,
  longType: TYPE_EGYPTIAN_WALL_LONG,
};

export function wallFamilyForConnector(type: number): WallFamily | undefined {
  if (type === TYPE_GREEK_WALL_CONNECTOR) return GREEK_WALL_FAMILY;
  if (type === TYPE_EGYPTIAN_WALL_CONNECTOR) return EGYPTIAN_WALL_FAMILY;
  return undefined;
}

export function isWallConnectorType(type: number): boolean {
  return wallFamilyForConnector(type) !== undefined;
}

export function isAutomaticWallSegmentType(type: number): boolean {
  return (
    type === TYPE_GREEK_WALL_SHORT ||
    type === TYPE_GREEK_WALL_MEDIUM ||
    type === TYPE_GREEK_WALL_LONG ||
    type === TYPE_EGYPTIAN_WALL_SHORT ||
    type === TYPE_EGYPTIAN_WALL_MEDIUM ||
    type === TYPE_EGYPTIAN_WALL_LONG
  );
}

export function quantizeWallCoordinate(value: number): number {
  return Math.round(value * WALL_COORDINATE_SCALE);
}

export function wallCoordinate(value: number): number {
  return value / WALL_COORDINATE_SCALE;
}

function addPiece(
  pieces: WallLinePiece[],
  type: number,
  centerX: number,
  centerZ: number,
  directionX: number,
  directionZ: number,
): void {
  pieces.push({
    type,
    centerX,
    centerZ,
    // Rectangular building models use local X as their long axis. Facing is
    // therefore the perpendicular vector, matching rotation 0's (0, 1).
    facingX: -directionZ,
    facingZ: directionX,
  });
}

export function planWallLine(
  connectorType: number,
  startXFixed: number,
  startZFixed: number,
  endXFixed: number,
  endZFixed: number,
): readonly WallLinePiece[] {
  const family = wallFamilyForConnector(connectorType);
  if (!family) return [];

  const startX = wallCoordinate(startXFixed);
  const startZ = wallCoordinate(startZFixed);
  const rawDx = wallCoordinate(endXFixed - startXFixed);
  const rawDz = wallCoordinate(endZFixed - startZFixed);
  const rawDistance = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
  if (!Number.isFinite(rawDistance) || rawDistance < 0.5) {
    return [
      {
        type: family.connectorType,
        centerX: startX,
        centerZ: startZ,
        facingX: 0,
        facingZ: 1,
      },
    ];
  }

  const distance = Math.min(MAX_WALL_LINE_LENGTH, Math.max(1, Math.round(rawDistance)));
  const directionX = rawDx / rawDistance;
  const directionZ = rawDz / rawDistance;
  const pieces: WallLinePiece[] = [];
  let cursor = 0;
  addPiece(pieces, family.connectorType, startX, startZ, directionX, directionZ);

  while (cursor < distance) {
    const remaining = distance - cursor;
    let segmentType = -1;
    let segmentLength = 0;

    if (remaining >= 6) {
      segmentType = family.longType;
      segmentLength = 5;
    } else if (remaining >= 4) {
      segmentType = family.mediumType;
      segmentLength = 3;
    } else if (remaining >= 3) {
      segmentType = family.shortType;
      segmentLength = 2;
    }

    if (segmentType >= 0) {
      const segmentCenter = cursor + 0.5 + segmentLength / 2;
      addPiece(
        pieces,
        segmentType,
        startX + directionX * segmentCenter,
        startZ + directionZ * segmentCenter,
        directionX,
        directionZ,
      );
      cursor += segmentLength + 1;
    } else {
      // A one- or two-unit remainder is represented by adjacent connectors,
      // preserving the Classic wall-chip behavior instead of stretching a mesh.
      cursor += 1;
    }

    addPiece(
      pieces,
      family.connectorType,
      startX + directionX * cursor,
      startZ + directionZ * cursor,
      directionX,
      directionZ,
    );
  }

  return pieces;
}
