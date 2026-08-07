import { describe, expect, test } from "bun:test";
import { AGE_HEROIC } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_LABORER, TYPE_EGYPTIAN_SIEGE_WORKS } from "../../unit-type-ids";
import { UNIT_CLASS_BUILDING } from "../../unit-type-schema";
import { definition } from "./siege-works";

describe("Egyptian Siege Works producer", () => {
  test("pins the original Classic Siege Camp building row", () => {
    expect(definition).toMatchObject({
      id: TYPE_EGYPTIAN_SIEGE_WORKS,
      key: "egyptian-siege-works",
      label: "Siege Works",
      classes: UNIT_CLASS_BUILDING,
      maxHp: 1200,
      lineOfSight: 9,
      armor: [0.3, 0.96, 0.05],
      footprint: 5,
      costGold: 25,
      buildTicks: 1000,
      requiredAge: AGE_HEROIC,
      builtBy: [{ type: TYPE_EGYPTIAN_LABORER, commandSlot: 5 }],
    });
  });
});
