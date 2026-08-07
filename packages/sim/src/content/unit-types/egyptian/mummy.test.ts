import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import { registerPlayer } from "../../../ecs/players";
import { UNIT_TYPES } from "../../../ecs/types";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_CARCINOS,
  TYPE_GREEK_CARAVAN,
  TYPE_HOPLITE,
  TYPE_JASON,
  TYPE_MINION,
  TYPE_MUMMY,
} from "../../unit-type-ids";
import { UNIT_CLASS_INFANTRY, UNIT_CLASS_MILITARY, UNIT_CLASS_MYTH } from "../../unit-type-schema";
import { definition as minionDefinition } from "./minion";
import { definition } from "./mummy";

function runUntil(world: ReturnType<typeof createWorld>, predicate: () => boolean): void {
  for (let tick = 0; tick < 200 && !predicate(); tick += 1) tickWorld(world);
}

describe("Egyptian Mummy and Minion unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins both launch rows and the four-second conversion cycle", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_MYTH | UNIT_CLASS_INFANTRY | UNIT_CLASS_MILITARY,
      maxHp: 350,
      lineOfSight: 18,
      movementSpeed: 4,
      armor: [0.35, 0.5, 0.8],
      costGold: 200,
      costFavor: 35,
      buildTicks: 340,
      populationCost: 5,
      specialAttack: {
        kind: "charged-convert",
        rechargeTicks: 500,
        actionTicks: 80,
        impactDelayTicks: 48,
        spawnUnitType: TYPE_MINION,
      },
    });
    expect(minionDefinition).toMatchObject({
      maxHp: 180,
      lineOfSight: 16,
      movementSpeed: 5,
      armor: [0.35, 0.4, 0.99],
      lifespanTicks: 1200,
      populationCost: 0,
      attack: { damage: [10, 0, 0], cooldownTicks: 18 },
    });
  });

  test("instantly replaces an eligible human with an owned sixty-second Minion", () => {
    const world = createWorld(761);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const mummy = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_MUMMY);
    const victim = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [mummy],
      targetId: victim,
    });
    runUntil(world, () => resolveId(world, victim) < 0);

    expect(resolveId(world, victim)).toBe(-1);
    const minion = Array.from({ length: world.count }, (_, index) => index).find(
      (index) => world.unitType[index] === TYPE_MINION,
    )!;
    expect(world.owner[minion]).toBe(0);
    expect(world.lifespanRemaining[minion]).toBe(1200);
    expect(world.specialRecharge[resolveId(world, mummy)]).toBeGreaterThan(0);
  });

  test("rejects heroes and Caravans, but can convert a naval myth unit", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_JASON]!)).toBeFalse();
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_CARAVAN]!)).toBeFalse();
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_CARCINOS]!)).toBeTrue();
  });

  test("spawns before the victim's death burst, so a converted Carcinos kills its Minion", () => {
    const world = createWorld(762);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const mummy = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_MUMMY);
    const carcinos = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_CARCINOS);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [mummy],
      targetId: carcinos,
    });
    runUntil(world, () => resolveId(world, carcinos) < 0);
    expect(resolveId(world, carcinos)).toBe(-1);
    expect(
      Array.from({ length: world.count }, (_, index) => world.unitType[index]).includes(
        TYPE_MINION,
      ),
    ).toBeFalse();
  });
});
