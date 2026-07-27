import { describe, expect, test } from "bun:test";
import { FOOD, MOVEMENT_DOMAIN_WATER } from "../../unit-type-schema";
import { definition } from "./fish-perch";

describe("perch source profile", () => {
  test("keeps the Classic food, water, armor, and obstruction values", () => {
    expect(definition.maxHp).toBe(1_000);
    expect(definition.resource).toBe(FOOD);
    expect(definition.movementSpeed).toBe(3);
    expect(definition.movementDomain).toBe(MOVEMENT_DOMAIN_WATER);
    expect(definition.resourceGathererDomain).toBe(MOVEMENT_DOMAIN_WATER);
    expect(definition.armor).toEqual([0.2, 0.2, 0.99]);
    expect(definition.bodyRadius).toBe(3);
    expect(definition.collidesWithProjectiles).toBe(false);
  });
});
