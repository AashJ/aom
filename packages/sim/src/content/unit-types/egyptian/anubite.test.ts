import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import {
  MODE_PRAYING,
  NEUTRAL_OWNER,
  createWorld,
  killUnit,
  spawnUnit,
  tickWorld,
} from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_ACHILLES,
  TYPE_ANUBITE,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MINOTAUR,
} from "../../unit-type-ids";
import { definition } from "./anubite";

function jumpWorld(distance = 6) {
  const world = createWorld(321);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const anubite = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_ANUBITE);
  const target = spawnUnit(world, 20 + distance, 20, 0, 0, 1, TYPE_HOPLITE);
  world.mode[1] = MODE_PRAYING;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [anubite],
    targetId: target,
  });
  return { world, anubite, target };
}

describe("Egyptian Anubite unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic balance, both melee cycles, and the jump range band", () => {
    expect(definition).toMatchObject({
      maxHp: 200,
      movementSpeed: 5.3,
      armor: [0.6, 0.55, 0.8],
      costFood: 100,
      costFavor: 15,
      buildTicks: 180,
      populationCost: 3,
      attack: {
        damage: [13, 0, 0],
        cycleVariants: [
          { actionTicks: 15, impactDelayTicks: 7 },
          { actionTicks: 19, impactDelayTicks: 9 },
        ],
      },
      specialAttack: {
        kind: "charged-jump",
        damage: [15, 0, 0],
        minimumRange: 4,
        range: 8,
        radius: 3,
        rechargeTicks: 100,
        takeoffTicks: 13,
        flightTicks: 40,
        landingTicks: 20,
        actionTicks: 73,
        impactDelayTicks: 53,
      },
    });
  });

  test("targets human and myth units for the leap but excludes heroes and buildings", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_VILLAGER]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_ACHILLES]!)).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_HOUSE]!)).toBe(false);
  });

  test("uses ordinary melee inside the four-unit minimum leap range", () => {
    const { world } = jumpWorld(2);
    const startingHp = world.hp[1]!;
    for (let tick = 0; tick < 20; tick += 1) tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(0);
    expect(world.hp[1]).toBeLessThan(startingHp);
  });

  test("holds through takeoff, follows one deterministic arc, and impacts at landing", () => {
    const { world } = jumpWorld();
    const splash = spawnUnit(world, 27.5, 20, 0, 0, 1, TYPE_HOPLITE);
    const ally = spawnUnit(world, 25, 20, 0, 0, 0, TYPE_HOPLITE);
    const neutral = spawnUnit(world, 26, 21, 0, 0, NEUTRAL_OWNER, TYPE_HOPLITE);
    world.mode.fill(MODE_PRAYING, 1, world.count);
    const startingHp = Array.from(world.hp.subarray(0, world.count));

    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(73);
    for (let tick = 0; tick < 13; tick += 1) tickWorld(world);
    expect(world.posX[0]).toBe(20);
    expect(world.specialActionRemaining[0]).toBe(60);

    for (let tick = 0; tick < 20; tick += 1) tickWorld(world);
    expect(world.posX[0]).toBe(23);
    const snapshot = createSnapshot(8);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.elevation[0]).toBe(4);

    for (let tick = 0; tick < 19; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp[1]);
    tickWorld(world);

    expect(world.posX[0]).toBe(26);
    expect(world.specialActionRemaining[0]).toBe(20);
    expect(world.specialRecharge[0]).toBe(100);
    expect(world.hp[1]).toBeCloseTo(
      startingHp[1]! - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!),
    );
    expect(world.hp[2]).toBeLessThan(startingHp[2]!);
    expect(world.hp[3]).toBe(startingHp[3]);
    expect(world.hp[4]).toBe(startingHp[4]);
    expect(splash).not.toBe(0);
    expect(ally).not.toBe(0);
    expect(neutral).not.toBe(0);
  });

  test("cancels before takeoff but commits to the locked landing point once airborne", () => {
    const early = jumpWorld().world;
    tickWorld(early);
    killUnit(early, 1);
    tickWorld(early);
    expect(early.specialActionRemaining[0]).toBe(0);
    expect(early.posX[0]).toBeLessThan(21);

    const committed = jumpWorld().world;
    tickWorld(committed);
    for (let tick = 0; tick < 14; tick += 1) tickWorld(committed);
    expect(committed.posX[0]).toBeGreaterThan(20);
    killUnit(committed, 1);
    for (let tick = 0; tick < 39; tick += 1) tickWorld(committed);
    expect(committed.posX[0]).toBe(26);
    expect(committed.specialRecharge[0]).toBe(100);
  });

  test("keeps jump travel, area impact, and recharge deterministic", () => {
    const a = jumpWorld().world;
    const b = jumpWorld().world;
    for (let tick = 0; tick < 240; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
