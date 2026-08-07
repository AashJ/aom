import { describe, expect, test } from "bun:test";
import { COMMAND_TRAIN, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { AGE_HEROIC, GOD_RA } from "../../../ecs/progression";
import { createWorld, spawnBuilding, tickWorld } from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_EGYPTIAN_TOWN_CENTER, TYPE_MERCENARY_CAVALRY } from "../../unit-type-ids";
import { GOLD } from "../../unit-type-schema";
import { definition } from "./mercenary-cavalry";

describe("Egyptian Mercenary Cavalry unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = unitReferenceEntry(definition.key)!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins launch-era balance and all three source attack cycles", () => {
    expect(definition).toMatchObject({
      maxHp: 190,
      lineOfSight: 22,
      movementSpeed: 5.3,
      armor: [0.6, 0.7, 0.99],
      costGold: 120,
      buildTicks: 3 * 20,
      lifespanTicks: 45 * 20,
      populationCost: 0,
      attack: {
        kind: "melee",
        damage: [8, 0, 0],
        range: 0.3,
        cooldownTicks: 20,
        cycleVariants: [
          { actionTicks: 20, impactDelayTicks: 10 },
          { actionTicks: 24, impactDelayTicks: 17 },
          { actionTicks: 17, impactDelayTicks: 11 },
        ],
      },
    });
  });

  test("trains in three seconds from a Heroic Egyptian Town Center", () => {
    const world = createWorld(157);
    registerPlayer(world, 0, GOD_RA);
    world.walkable.fill(1);
    world.playerAge[0] = AGE_HEROIC;
    world.stockpiles[GOLD] = 1_000;
    const townCenter = spawnBuilding(world, 100, 100, 0, TYPE_EGYPTIAN_TOWN_CENTER, true);

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: townCenter,
      unitType: TYPE_MERCENARY_CAVALRY,
    });
    for (let tick = 0; tick < definition.buildTicks; tick += 1) tickWorld(world);

    expect(world.count).toBe(2);
    expect(world.unitType[1]).toBe(TYPE_MERCENARY_CAVALRY);
    expect(world.lifespanRemaining[1]).toBe(900);
    expect(world.stockpiles[GOLD]).toBe(1_000 - definition.costGold);
  });
});
