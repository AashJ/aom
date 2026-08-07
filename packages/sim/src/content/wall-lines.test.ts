import { describe, expect, test } from "bun:test";
import {
  TYPE_EGYPTIAN_WALL_CONNECTOR,
  TYPE_GREEK_WALL_CONNECTOR,
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_WALL_MEDIUM,
} from "./unit-type-ids";
import { planWallLine, quantizeWallCoordinate, wallFamilyForConnector } from "./wall-lines";

describe("Classic wall-line composition", () => {
  test("recognizes only the two playable connector families", () => {
    expect(wallFamilyForConnector(TYPE_GREEK_WALL_CONNECTOR)?.connectorType).toBe(
      TYPE_GREEK_WALL_CONNECTOR,
    );
    expect(wallFamilyForConnector(TYPE_EGYPTIAN_WALL_CONNECTOR)?.connectorType).toBe(
      TYPE_EGYPTIAN_WALL_CONNECTOR,
    );
    expect(wallFamilyForConnector(TYPE_GREEK_WALL_LONG)).toBeUndefined();
  });

  test("fills a straight gesture with authored long pieces and connectors", () => {
    const pieces = planWallLine(
      TYPE_GREEK_WALL_CONNECTOR,
      quantizeWallCoordinate(10.5),
      quantizeWallCoordinate(20.5),
      quantizeWallCoordinate(22.5),
      quantizeWallCoordinate(20.5),
    );

    expect(pieces.map((piece) => piece.type)).toEqual([
      TYPE_GREEK_WALL_CONNECTOR,
      TYPE_GREEK_WALL_LONG,
      TYPE_GREEK_WALL_CONNECTOR,
      TYPE_GREEK_WALL_LONG,
      TYPE_GREEK_WALL_CONNECTOR,
    ]);
    expect(pieces.map((piece) => piece.centerX)).toEqual([10.5, 13.5, 16.5, 19.5, 22.5]);
  });

  test("keeps diagonal positions and orientation deterministic", () => {
    const pieces = planWallLine(
      TYPE_GREEK_WALL_CONNECTOR,
      quantizeWallCoordinate(10.5),
      quantizeWallCoordinate(10.5),
      quantizeWallCoordinate(13.5),
      quantizeWallCoordinate(14.5),
    );

    expect(pieces.map((piece) => piece.type)).toEqual([
      TYPE_GREEK_WALL_CONNECTOR,
      TYPE_GREEK_WALL_MEDIUM,
      TYPE_GREEK_WALL_CONNECTOR,
      TYPE_GREEK_WALL_CONNECTOR,
    ]);
    expect(pieces[1]!.facingX).toBeCloseTo(-0.8);
    expect(pieces[1]!.facingZ).toBeCloseTo(0.6);
    expect(pieces[2]!.centerX).toBeCloseTo(12.9);
    expect(pieces[2]!.centerZ).toBeCloseTo(13.7);
  });
});
