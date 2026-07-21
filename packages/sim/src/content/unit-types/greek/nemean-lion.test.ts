import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveMeleeCycleDamage } from "../../../ecs/combat";
import { NO_MELEE_ATTACK_VARIANT } from "../../../ecs/melee-attack-cycles";
import { registerPlayer } from "../../../ecs/players";
import { MODE_PRAYING, createWorld, killUnit, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_JASON, TYPE_NEMEAN_LION, TYPE_TREE } from "../../unit-type-ids";
import { definition } from "./nemean-lion";

function attackWorld() {
  const world = createWorld(73);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const lion = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
  // A valid surface-to-surface starting pose keeps this special-attack fixture
  // independent of the ground-contact repair covered by ground-contact.test.ts.
  const target = spawnUnit(world, 20, 21.5, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [lion],
    targetId: target,
  });
  return { world, lion, target };
}

describe("Greek Nemean Lion unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, GATE_C_MYTH_UNIT_REFERENCES[1]!),
    ).not.toThrow();
  });

  test("pins Classic final balance and both source attack cycles", () => {
    expect(definition).toMatchObject({
      maxHp: 660,
      movementSpeed: 4.8,
      armor: [0.3, 0.6, 0.8],
      costGold: 250,
      costFavor: 22,
      populationCost: 4,
      attack: {
        damage: [20, 0, 10],
        cooldownTicks: 20,
        cycleVariants: [
          { actionTicks: 24, impactDelayTicks: 11 },
          { actionTicks: 18, impactDelayTicks: 8 },
        ],
      },
      specialAttack: {
        kind: "charged-area-pulse",
        damage: [12, 0, 0],
        radius: 10,
        rechargeTicks: 400,
        actionTicks: 60,
        impactDelayTicks: 24,
      },
    });
  });

  test("lands one attacker-centered pulse with linear falloff and relationship filtering", () => {
    const { world } = attackWorld();
    const edgeEnemy = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    const hero = spawnUnit(world, 22, 20, 0, 0, 1, TYPE_JASON);
    const ally = spawnUnit(world, 22, 21, 0, 0, 0, TYPE_HOPLITE);
    const tree = spawnUnit(world, 23, 20, 0, 0, 255, TYPE_TREE);
    world.mode.fill(MODE_PRAYING, 1, world.count);
    const startingHp = Array.from(world.hp.subarray(0, world.count));

    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(60);
    for (let tick = 0; tick < 23; tick += 1) tickWorld(world);
    for (let index = 1; index < world.count; index += 1) {
      expect(world.hp[index]).toBe(startingHp[index]);
    }

    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(36);
    expect(world.specialRecharge[0]).toBe(400);
    expect(world.hp[1]).toBeCloseTo(startingHp[1]! - 12 * 0.65 * 0.85, 10);
    expect(world.hp[2]).toBeCloseTo(startingHp[2]! - 12 * 0.65 * 0.5, 10);
    expect(world.hp[3]).toBeCloseTo(startingHp[3]! - 12 * 0.75 * 0.01 * 0.8, 10);
    expect(world.hp[4]).toBe(startingHp[4]);
    expect(world.hp[5]).toBeCloseTo(startingHp[5]! - 12 * 0.7, 10);

    expect(edgeEnemy).not.toBe(0);
    expect(hero).not.toBe(0);
    expect(ally).not.toBe(0);
    expect(tree).not.toBe(0);
  });

  test("defers area deaths until every victim in the pulse has resolved", () => {
    const { world } = attackWorld();
    spawnUnit(world, 20.75, 20, 0, 0, 1, TYPE_HOPLITE);
    world.hp[1] = 5;
    world.hp[2] = 5;
    world.mode.fill(MODE_PRAYING, 1, world.count);

    for (let tick = 0; tick < 25; tick += 1) tickWorld(world);

    expect(world.count).toBe(1);
    expect(world.unitType[0]).toBe(TYPE_NEMEAN_LION);
  });

  test("selects one melee clip in the sim, delays its hit, and scales damage by duration", () => {
    const { world } = attackWorld();
    world.specialRecharge[0] = 1_000;
    const startingHp = world.hp[1]!;

    tickWorld(world);
    const variant = world.meleeActionVariant[0]!;
    const cycle = definition.attack.cycleVariants[variant]!;
    expect(variant).toBeLessThan(definition.attack.cycleVariants.length);
    expect(world.attackCooldown[0]).toBe(cycle.actionTicks);
    expect(world.hp[1]).toBe(startingHp);

    for (let tick = 1; tick < cycle.impactDelayTicks; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);
    tickWorld(world);

    const expectedDamage = resolveMeleeCycleDamage(
      definition.attack,
      cycle,
      UNIT_TYPES[TYPE_HOPLITE]!,
    );
    expect(world.hp[1]).toBeCloseTo(startingHp - expectedDamage, 10);
    expect(world.meleeActionImpactPending[0]).toBe(0);

    const snapshot = createSnapshot(2);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.meleeActionVariant[0]).toBe(variant);
  });

  test("keeps area enumeration and variable-cycle selection deterministic", () => {
    const a = attackWorld().world;
    const b = attackWorld().world;
    spawnUnit(a, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    spawnUnit(b, 25, 20, 0, 0, 1, TYPE_HOPLITE);

    for (let tick = 0; tick < 500; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });

  test("preserves variable melee state when death compacts dense storage", () => {
    const world = createWorld(73);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    spawnUnit(world, 10, 10, 0, 0, 0, TYPE_HOPLITE);
    const target = spawnUnit(world, 20.5, 20, 0, 0, 1, TYPE_HOPLITE);
    spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    world.attackTarget[2] = target;
    world.attackCooldown[2] = 12;
    world.meleeActionVariant[2] = 0;
    world.meleeActionImpactPending[2] = 1;
    world.specialRecharge[2] = 100;

    killUnit(world, 0);
    tickWorld(world);

    expect(world.unitType[0]).toBe(TYPE_NEMEAN_LION);
    expect(world.meleeActionVariant[0]).toBe(0);
    expect(world.meleeActionImpactPending[0]).toBe(1);
    expect(world.attackCooldown[0]).toBe(11);
    expect(world.meleeActionVariant[1]).toBe(NO_MELEE_ATTACK_VARIANT);
  });
});
