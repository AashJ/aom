import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage, resolveMeleeDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_MINOTAUR } from "../../unit-type-ids";
import { UNIT_TYPES } from "../../generated/unit-types";
import { definition } from "./minotaur";

function duel() {
  const world = createWorld(42);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const minotaur = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_MINOTAUR);
  const hoplite = spawnUnit(world, 20.5, 20, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [minotaur],
    targetId: hoplite,
  });
  return { world, minotaur, hoplite };
}

describe("Greek Minotaur unit pack", () => {
  test("matches the integration-owned Classic candidate reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, GATE_C_MYTH_UNIT_REFERENCES[0]),
    ).not.toThrow();
  });

  test("pins myth, Favor, primary counter, and gore target rules as authored content", () => {
    expect(definition).toMatchObject({
      id: TYPE_MINOTAUR,
      maxHp: 300,
      movementSpeed: 4,
      armor: [0.6, 0.5, 0.8],
      costFood: 200,
      costFavor: 16,
      buildTicks: 20 * 20,
      populationCost: 4,
      attack: {
        damage: [15, 0, 10],
        cooldownTicks: 20,
      },
      specialAttack: {
        damage: [60, 0, 0],
        rechargeTicks: 15 * 20,
        actionTicks: 2 * 20,
        impactDelayTicks: 19,
      },
    });
    expect(resolveMeleeDamage(definition.attack, definition)).toBe(24);
    expect(resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(39);
  });

  test("starts gore ready, applies damage on the source tag, and then recharges", () => {
    const { world } = duel();
    const startingHp = world.hp[1]!;

    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(40);
    expect(world.specialActionImpactPending[0]).toBe(1);
    expect(world.specialRecharge[0]).toBe(0);
    expect(world.hp[1]).toBe(startingHp);

    for (let tick = 0; tick < 18; tick += 1) tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(22);
    expect(world.hp[1]).toBe(startingHp);

    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(21);
    expect(world.specialActionImpactPending[0]).toBe(0);
    expect(world.specialRecharge[0]).toBe(300);
    expect(world.hp[1]).toBe(startingHp - 39);

    const snapshot = createSnapshot(4);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.specialActionRemaining[0]).toBe(21);
  });

  test("locks the attacker and idle target against separation throughout the gore wind-up", () => {
    const { world } = duel();
    const minotaurX = world.posX[0];
    const minotaurZ = world.posZ[0];
    const targetX = world.posX[1];
    const targetZ = world.posZ[1];

    for (let tick = 0; tick < 20; tick += 1) {
      tickWorld(world);
      expect(world.posX[0]).toBe(minotaurX);
      expect(world.posZ[0]).toBe(minotaurZ);
      expect(world.posX[1]).toBe(targetX);
      expect(world.posZ[1]).toBe(targetZ);
    }

    expect(world.specialActionImpactPending[0]).toBe(0);
  });

  test("cancels an escaped wind-up without spending its charge", () => {
    const { world } = duel();
    tickWorld(world);

    world.posX[1] = 30;
    tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(0);
    expect(world.specialActionImpactPending[0]).toBe(0);
    expect(world.specialRecharge[0]).toBe(0);
    expect(world.attackCooldown[0]).toBe(0);
  });

  test("keeps charged action state deterministic tick by tick", () => {
    const a = duel().world;
    const b = duel().world;

    for (let tick = 0; tick < 80; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });

  test("preserves charged action state when death compacts dense storage", () => {
    const world = createWorld(42);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    spawnUnit(world, 10, 10, 0, 0, 0, TYPE_HOPLITE);
    const target = spawnUnit(world, 20, 20, 0, 0, 1, TYPE_HOPLITE);
    spawnUnit(world, 21, 20, 0, 0, 0, TYPE_MINOTAUR);

    world.specialRecharge[2] = 123;
    world.specialActionRemaining[2] = 10;
    world.specialActionTarget[2] = target;
    world.specialActionImpactPending[2] = 0;

    killUnit(world, 0);
    tickWorld(world);

    expect(world.unitType[0]).toBe(TYPE_MINOTAUR);
    expect(world.specialRecharge[0]).toBe(122);
    expect(world.specialActionRemaining[0]).toBe(9);
    expect(world.specialActionTarget[0]).toBe(target);
    expect(world.specialActionImpactPending[0]).toBe(0);
  });
});
