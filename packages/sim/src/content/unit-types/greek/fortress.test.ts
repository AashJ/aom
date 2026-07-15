import { describe, expect, test } from "bun:test";
import { BUILD_OPTIONS_BY_WORKER } from "../../generated/unit-types";
import { TYPE_GREEK_FORTRESS, TYPE_GREEK_VILLAGER } from "../../unit-type-ids";
import { definition } from "./fortress";

describe("Greek Fortress producer pack", () => {
  test("pins the Classic building and worker-command contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_GREEK_FORTRESS,
      key: "greek-fortress",
      maxHp: 2100,
      lineOfSight: 30,
      armor: [0.3, 0.96, 0.05],
      costWood: 300,
      costGold: 300,
      costFavor: 10,
      buildTicks: 100 * 20,
      builtBy: [{ type: TYPE_GREEK_VILLAGER, commandSlot: 5 }],
    });
    expect(BUILD_OPTIONS_BY_WORKER[TYPE_GREEK_VILLAGER]).toContainEqual({
      type: TYPE_GREEK_FORTRESS,
      commandSlot: 5,
    });
  });
});
