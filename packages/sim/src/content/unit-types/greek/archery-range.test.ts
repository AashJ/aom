import { describe, expect, test } from "bun:test";
import { BUILD_OPTIONS_BY_WORKER } from "../../generated/unit-types";
import { TYPE_GREEK_ARCHERY_RANGE, TYPE_GREEK_VILLAGER } from "../../unit-type-ids";
import { definition } from "./archery-range";

describe("Greek Archery Range producer", () => {
  test("pins the Classic producer contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_GREEK_ARCHERY_RANGE,
      key: "greek-archery-range",
      maxHp: 1200,
      lineOfSight: 9,
      armor: [0.3, 0.96, 0.05],
      bodyRadius: 4,
      footprint: 4,
      costWood: 100,
      buildTicks: 25 * 20,
      builtBy: [{ type: TYPE_GREEK_VILLAGER, commandSlot: 6 }],
    });
    expect(BUILD_OPTIONS_BY_WORKER[TYPE_GREEK_VILLAGER]).toContainEqual({
      type: TYPE_GREEK_ARCHERY_RANGE,
      commandSlot: 6,
    });
  });
});
