import { describe, expect, test } from "bun:test";
import { MOVEMENT_DOMAIN_LAND, MOVEMENT_DOMAIN_WATER } from "../content/unit-type-schema";
import { MAP_TILES } from "../terrain";
import { isWalkableStep, navigationGridForDomain } from "./navigation";

describe("movement domains", () => {
  test("land and water orders consult independent navigation masks", () => {
    const land = new Uint8Array(MAP_TILES * MAP_TILES);
    const water = new Uint8Array(MAP_TILES * MAP_TILES);
    const destination = 12 * MAP_TILES + 11;
    const state = { walkable: land, waterNavigable: water };

    water[destination] = 1;

    expect(navigationGridForDomain(state, MOVEMENT_DOMAIN_LAND)).toBe(land);
    expect(navigationGridForDomain(state, MOVEMENT_DOMAIN_WATER)).toBe(water);
    expect(isWalkableStep(state, 10.5, 12.5, 11.5, 12.5, MOVEMENT_DOMAIN_LAND)).toBe(false);
    expect(isWalkableStep(state, 10.5, 12.5, 11.5, 12.5, MOVEMENT_DOMAIN_WATER)).toBe(true);
  });

  test("water movement preserves the same diagonal corner-cutting rule as land", () => {
    const water = new Uint8Array(MAP_TILES * MAP_TILES);
    const state = {
      walkable: new Uint8Array(water.length),
      waterNavigable: water,
    };

    water[11 * MAP_TILES + 11] = 1;
    expect(isWalkableStep(state, 10.5, 10.5, 11.5, 11.5, MOVEMENT_DOMAIN_WATER)).toBe(false);

    water[10 * MAP_TILES + 11] = 1;
    water[11 * MAP_TILES + 10] = 1;
    expect(isWalkableStep(state, 10.5, 10.5, 11.5, 11.5, MOVEMENT_DOMAIN_WATER)).toBe(true);
  });
});
