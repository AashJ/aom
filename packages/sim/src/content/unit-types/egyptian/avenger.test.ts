import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { MODE_PRAYING, createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_AVENGER,
  TYPE_GREEK_HOUSE,
  TYPE_HOPLITE,
  TYPE_JASON,
  TYPE_MINOTAUR,
  TYPE_TREE,
} from "../../unit-type-ids";
import { definition } from "./avenger";

function attackWorld() {
  const world = createWorld(409);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const avenger = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_AVENGER);
  const target = spawnUnit(world, 20, 20.8, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [avenger],
    targetId: target,
  });
  return { world, avenger, target };
}

describe("Egyptian Avenger unit pack", () => {
  test("matches the integration-owned Classic reference", () => {
    const reference = GATE_C_MYTH_UNIT_REFERENCES.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance and the two ordinary source clips", () => {
    expect(definition).toMatchObject({
      maxHp: 600,
      lineOfSight: 18,
      movementSpeed: 5.3,
      armor: [0.6, 0.4, 0.8],
      costFood: 250,
      costFavor: 30,
      buildTicks: 480,
      populationCost: 4,
      attack: {
        damage: [28, 0, 0],
        cycleVariants: [
          { actionTicks: 20, impactDelayTicks: 8 },
          { actionTicks: 20, impactDelayTicks: 12 },
        ],
      },
      specialAttack: {
        damage: [70, 0, 0],
        radius: 7,
        rechargeTicks: 200,
        actionTicks: 30,
        impactDelayTicks: 18,
      },
    });
  });

  test("lands one linearly-falling enemy-and-Gaia-unit pulse at the sole Attack tag", () => {
    const { world } = attackWorld();
    const myth = spawnUnit(world, 22, 20, 0, 0, 1, TYPE_MINOTAUR);
    const hero = spawnUnit(world, 20, 22, 0, 0, 1, TYPE_JASON);
    const enemyBuilding = spawnUnit(world, 18, 20, 0, 0, 1, TYPE_GREEK_HOUSE);
    const ally = spawnUnit(world, 20, 19, 0, 0, 0, TYPE_HOPLITE);
    const neutralUnit = spawnUnit(world, 23, 20, 0, 0, 255, TYPE_TREE);
    const neutralBuilding = spawnUnit(world, 17, 20, 0, 0, 255, TYPE_GREEK_HOUSE);
    world.mode.fill(MODE_PRAYING, 1, world.count);
    const startingHp = Array.from(world.hp.subarray(0, world.count));

    for (let tick = 0; tick < 18; tick += 1) tickWorld(world);
    for (let index = 1; index < world.count; index += 1) {
      expect(world.hp[index]).toBe(startingHp[index]);
    }
    tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(12);
    expect(world.specialRecharge[0]).toBe(200);
    expect(world.hp[1]).toBeLessThan(startingHp[1]!);
    expect(world.hp[2]).toBeLessThan(startingHp[2]!);
    expect(world.hp[3]).toBeLessThan(startingHp[3]!);
    expect(world.hp[4]).toBeLessThan(startingHp[4]!);
    expect(world.hp[5]).toBe(startingHp[5]);
    expect(world.hp[6]).toBeLessThan(startingHp[6]!);
    expect(world.hp[7]).toBe(startingHp[7]);
    expect(myth).not.toBe(0);
    expect(hero).not.toBe(0);
    expect(enemyBuilding).not.toBe(0);
    expect(ally).not.toBe(0);
    expect(neutralUnit).not.toBe(0);
    expect(neutralBuilding).not.toBe(0);
  });

  test("uses the launch 0.1x hero penalty without the Titans myth bonus", () => {
    const hero = UNIT_TYPES[TYPE_JASON]!;
    const myth = UNIT_TYPES[TYPE_MINOTAUR]!;
    const special = definition.specialAttack;
    const heroDamage = special.damage[0] * (1 - hero.armor[0]) * 0.1;
    const mythDamage = special.damage[0] * (1 - myth.armor[0]);

    expect(heroDamage).toBeCloseTo(5.25, 10);
    expect(mythDamage).toBeCloseTo(28, 10);
  });

  test("keeps Whirlwind and alternating attack state deterministic", () => {
    const a = attackWorld().world;
    const b = attackWorld().world;
    for (let tick = 0; tick < 300; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
