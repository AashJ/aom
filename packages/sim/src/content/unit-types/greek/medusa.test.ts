import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  UNIT_CLASS_AIR,
  UNIT_CLASS_HERO,
  UNIT_CLASS_HUNTABLE,
  UNIT_CLASS_SET_ANIMAL,
  UNIT_CONDITION_FROZEN,
  UNIT_CONDITION_STONE,
} from "../../unit-type-schema";
import { TYPE_ACHILLES, TYPE_HOPLITE, TYPE_MEDUSA, TYPE_MINOTAUR } from "../../unit-type-ids";
import { definition } from "./medusa";

function duel(targetType = TYPE_HOPLITE, distance = 11) {
  const world = createWorld(362);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const medusa = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_MEDUSA);
  const target = spawnUnit(world, 20 + distance, 20, 0, 0, 1, targetType);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [medusa],
    targetId: target,
  });
  return { world, medusa, target };
}

describe("Greek Medusa unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic launch balance, arrow release, and petrification timing", () => {
    expect(definition).toMatchObject({
      maxHp: 360,
      lineOfSight: 18,
      movementSpeed: 4.3,
      armor: [0.6, 0.7, 0.8],
      costGold: 250,
      costFavor: 40,
      buildTicks: 400,
      populationCost: 5,
      attack: {
        damage: [0, 15, 12.5],
        range: 10,
        launchDelayTicks: 13,
      },
      specialAttack: {
        kind: "charged-terminal",
        effect: "petrify-kill",
        range: 10,
        rechargeTicks: 400,
        actionTicks: 40,
        impactDelayTicks: 24,
      },
    });
  });

  test("petrifies humans, huntables, myth units, and Set animals but not heroes or air", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_ACHILLES]!)).toBe(false);
    expect(
      isValidSpecialTarget(special, {
        ...UNIT_TYPES[TYPE_HOPLITE]!,
        classes: UNIT_CLASS_HUNTABLE,
      }),
    ).toBe(true);
    expect(
      isValidSpecialTarget(special, {
        ...UNIT_TYPES[TYPE_HOPLITE]!,
        classes: UNIT_CLASS_SET_ANIMAL,
      }),
    ).toBe(true);
    for (const excludedClass of [UNIT_CLASS_HERO, UNIT_CLASS_AIR]) {
      expect(
        isValidSpecialTarget(special, {
          ...UNIT_TYPES[TYPE_MINOTAUR]!,
          classes: UNIT_TYPES[TYPE_MINOTAUR]!.classes | excludedClass,
        }),
      ).toBe(false);
    }
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!, UNIT_CONDITION_FROZEN)).toBe(
      false,
    );
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!, UNIT_CONDITION_STONE)).toBe(
      false,
    );
  });

  test("casts beyond ordinary arrow range and petrifies on the 60% source tag", () => {
    const { world, target } = duel();
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(40);
    expect(world.projectiles.count).toBe(0);
    expect(world.moving[0]).toBe(0);

    for (let tick = 0; tick < 23; tick += 1) tickWorld(world);
    expect(resolveId(world, target)).toBe(1);
    tickWorld(world);

    expect(resolveId(world, target)).toBe(-1);
    expect(world.specialRecharge[0]).toBe(400);
    expect(world.deathEventCount).toBe(1);
    expect(world.deathEventConditions[0]! & UNIT_CONDITION_STONE).toBe(UNIT_CONDITION_STONE);
    const snapshot = createSnapshot(4);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.deathConditions[0]! & UNIT_CONDITION_STONE).toBe(UNIT_CONDITION_STONE);
  });

  test("uses the ordinary arrow cycle against a special-immune hero", () => {
    const { world, target } = duel(TYPE_ACHILLES, 5);
    const startingHp = world.hp[1]!;
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(0);
    expect(world.projectiles.count).toBe(1);

    for (let tick = 0; tick < 40 && world.hp[resolveId(world, target)] === startingHp; tick += 1) {
      tickWorld(world);
    }
    expect(world.hp[resolveId(world, target)]).toBeLessThan(startingHp);
  });

  test("keeps ranged petrification deterministic", () => {
    const a = duel().world;
    const b = duel().world;
    for (let tick = 0; tick < 180; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
