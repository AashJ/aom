import { describe, expect, test } from "bun:test";
import { BUILD_OPTIONS_BY_WORKER } from "../../generated/unit-types";
import { TYPE_GREEK_STABLE, TYPE_GREEK_VILLAGER } from "../../unit-type-ids";
import { definition } from "./stable";

describe("Greek Stable producer pack", () => {
  test("pins the Classic building and worker-command contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_GREEK_STABLE,
      key: "greek-stable",
      maxHp: 1200,
      lineOfSight: 9,
      armor: [0.4, 0.96, 0.05],
      costWood: 100,
      buildTicks: 23 * 20,
      builtBy: [{ type: TYPE_GREEK_VILLAGER, commandSlot: 4 }],
    });
    expect(BUILD_OPTIONS_BY_WORKER[TYPE_GREEK_VILLAGER]).toContainEqual({
      type: TYPE_GREEK_STABLE,
      commandSlot: 4,
    });
  });
});
