import { describe, expect, test } from "bun:test";
import { COMMAND_TRAIN, enqueueCommand } from "../../../commands";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { registerPlayer } from "../../../ecs/players";
import { AGE_CLASSICAL, GOD_RA } from "../../../ecs/progression";
import {
  createWorld,
  killUnit,
  resolveId,
  spawnBuilding,
  spawnUnit,
  tickWorld,
} from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { GOLD } from "../../unit-type-schema";
import { TYPE_EGYPTIAN_TOWN_CENTER, TYPE_HOPLITE, TYPE_MERCENARY } from "../../unit-type-ids";
import { definition } from "./mercenary";

describe("Egyptian Mercenary unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = unitReferenceEntry(definition.key)!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins the launch-era temporary infantry contract", () => {
    expect(definition).toMatchObject({
      maxHp: 85,
      lineOfSight: 20,
      movementSpeed: 4.3,
      armor: [0.45, 0.3, 0.99],
      costGold: 90,
      buildTicks: 20,
      lifespanTicks: 45 * 20,
      populationCost: 0,
      attack: {
        kind: "melee",
        damage: [8, 0, 0],
        range: 0.3,
        cooldownTicks: 20,
      },
    });
  });

  test("lives for exactly 45 active seconds and exposes the hashed countdown", () => {
    const world = createWorld(133);
    const twin = createWorld(133);
    registerPlayer(world, 0, GOD_RA);
    registerPlayer(twin, 0, GOD_RA);
    world.walkable.fill(1);
    twin.walkable.fill(1);
    const id = spawnUnit(world, 100, 100, 0, 0, 0, TYPE_MERCENARY);
    spawnUnit(twin, 100, 100, 0, 0, 0, TYPE_MERCENARY);
    const snapshot = createSnapshot(2);

    expect(world.lifespanRemaining[0]).toBe(900);
    expect(hashWorld(world)).toBe(hashWorld(twin));
    twin.lifespanRemaining[0] = 899;
    expect(hashWorld(world)).not.toBe(hashWorld(twin));
    tickWorld(world);
    expect(world.lifespanRemaining[0]).toBe(899);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.lifespanRemaining[0]).toBe(899);

    for (let tick = 1; tick < 899; tick += 1) tickWorld(world);
    expect(resolveId(world, id)).toBe(0);
    expect(world.lifespanRemaining[0]).toBe(1);

    tickWorld(world);
    expect(resolveId(world, id)).toBe(-1);
    expect(world.deathEventCount).toBe(1);
    expect(world.deathEventTypes[0]).toBe(TYPE_MERCENARY);
  });

  test("preserves lifetime through dense-slot compaction", () => {
    const world = createWorld(134);
    registerPlayer(world, 0, GOD_RA);
    world.walkable.fill(1);
    const permanent = spawnUnit(world, 90, 90, 0, 0, 0, TYPE_HOPLITE);
    const mercenary = spawnUnit(world, 100, 100, 0, 0, 0, TYPE_MERCENARY);

    killUnit(world, resolveId(world, permanent));
    tickWorld(world);

    expect(resolveId(world, mercenary)).toBe(0);
    expect(world.lifespanRemaining[0]).toBe(899);
  });

  test("trains from an Egyptian Town Center without consuming population", () => {
    const world = createWorld(135);
    registerPlayer(world, 0, GOD_RA);
    world.walkable.fill(1);
    world.playerAge[0] = AGE_CLASSICAL;
    world.stockpiles[GOLD] = 1_000;
    const townCenter = spawnBuilding(world, 100, 100, 0, TYPE_EGYPTIAN_TOWN_CENTER, true);

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: townCenter,
      unitType: TYPE_MERCENARY,
    });
    for (let tick = 0; tick < definition.buildTicks; tick += 1) tickWorld(world);

    expect(world.count).toBe(2);
    expect(world.unitType[1]).toBe(TYPE_MERCENARY);
    expect(world.lifespanRemaining[1]).toBe(900);
    expect(world.stockpiles[GOLD]).toBe(1_000 - definition.costGold);
  });
});
