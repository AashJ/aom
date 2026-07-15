import { describe, expect, test } from "bun:test";
import { BUILD_OPTIONS_BY_WORKER } from "../../generated/unit-types";
import { TYPE_EGYPTIAN_LABORER, TYPE_EGYPTIAN_MIGDOL_STRONGHOLD } from "../../unit-type-ids";
import { definition } from "./migdol-stronghold";

describe("Egyptian Migdol Stronghold producer pack", () => {
  test("pins the Classic building and worker-command contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
      key: "egyptian-migdol-stronghold",
      maxHp: 2600,
      lineOfSight: 30,
      armor: [0.3, 0.96, 0.05],
      costWood: 0,
      costGold: 400,
      costFavor: 10,
      buildTicks: 130 * 20,
      builtBy: [{ type: TYPE_EGYPTIAN_LABORER, commandSlot: 4 }],
    });
    expect(BUILD_OPTIONS_BY_WORKER[TYPE_EGYPTIAN_LABORER]).toContainEqual({
      type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
      commandSlot: 4,
    });
  });
});
