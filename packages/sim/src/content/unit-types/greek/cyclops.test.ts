import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, COMMAND_MOVE, enqueueCommand } from "../../../commands";
import { resolveDamage, resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import {
  createWorld,
  killUnit,
  NEUTRAL_OWNER,
  resolveId,
  spawnUnit,
  tickWorld,
  unitIdAt,
} from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import {
  TYPE_CYCLOPS,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MINOTAUR,
  TYPE_POLYPHEMUS,
} from "../../unit-type-ids";
import { UNIT_CONDITION_FROZEN, UNIT_CONDITION_STONE } from "../../unit-type-schema";
import { definition } from "./cyclops";

function duel(seed = 309) {
  const world = createWorld(seed);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const cyclops = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_CYCLOPS);
  const target = spawnUnit(world, 21.5, 20, 0, 0, 1, TYPE_HOPLITE);
  world.attackCooldown[resolveId(world, target)] = 0xffff;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [cyclops],
    targetId: target,
  });
  return { world, cyclops, target };
}

describe("Greek Cyclops unit pack", () => {
  test("pins launch balance, unequal club cycles, and the two-stage Throw action", () => {
    expect(definition).toMatchObject({
      maxHp: 500,
      lineOfSight: 16,
      movementSpeed: 3.2,
      armor: [0.4, 0.5, 0.8],
      costFood: 250,
      costFavor: 22,
      buildTicks: 400,
      populationCost: 4,
      attack: {
        damage: [15, 0, 12],
        cooldownTicks: 20,
        cycleVariants: [
          { actionTicks: 24, impactDelayTicks: 13 },
          { actionTicks: 32, impactDelayTicks: 20 },
        ],
      },
      specialAttack: {
        kind: "charged-pickup-throw",
        damage: [30, 0, 0],
        radius: 10,
        falloff: "constant",
        rechargeTicks: 300,
        actionTicks: 100,
        pickupDelayTicks: 23,
        throwDelayTicks: 69,
      },
    });
  });

  test("accepts villagers and human soldiers, but not heroes, myth units, frozen, or stone", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_VILLAGER]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_POLYPHEMUS]!)).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!, UNIT_CONDITION_FROZEN)).toBe(
      false,
    );
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!, UNIT_CONDITION_STONE)).toBe(
      false,
    );
  });

  test("terminally picks up at 23%, hits at 69%, and dies at full action completion", () => {
    const { world, cyclops, target } = duel();
    const near = spawnUnit(world, 25, 25, 0, 0, 1, TYPE_GREEK_TEMPLE);
    const edge = spawnUnit(world, 28, 25, 0, 0, 1, TYPE_GREEK_TEMPLE);
    const outside = spawnUnit(world, 35, 20, 0, 0, 1, TYPE_GREEK_TEMPLE);
    const ally = spawnUnit(world, 16, 24, 0, 0, 0, TYPE_HOPLITE);
    const neutral = spawnUnit(world, 24, 16, 0, 0, NEUTRAL_OWNER, TYPE_HOPLITE);
    for (const id of [near, edge, outside, ally, neutral]) {
      world.attackCooldown[resolveId(world, id)] = 0xffff;
    }
    const starting = new Map(
      [near, edge, outside, ally, neutral].map(
        (id) => [id, world.hp[resolveId(world, id)]!] as const,
      ),
    );

    tickWorld(world);
    for (let tick = 0; tick < 22; tick += 1) tickWorld(world);
    expect(world.hp[resolveId(world, target)]).toBeGreaterThan(0);
    tickWorld(world);

    const targetIndex = resolveId(world, target);
    expect(world.hp[targetIndex]).toBe(0);
    expect(world.dying[targetIndex]).toBe(0);
    expect(world.containedBy[targetIndex]).toBe(cyclops);
    expect(world.terminalThrowSource[targetIndex]).toBe(cyclops);
    expect(world.specialActionImpactPending[resolveId(world, cyclops)]).toBe(2);
    expect(world.specialRecharge[resolveId(world, cyclops)]).toBe(300);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [cyclops],
      targetX: 40,
      targetZ: 40,
    });
    for (let tick = 0; tick < 45; tick += 1) tickWorld(world);
    expect(world.containedBy[resolveId(world, target)]).toBe(cyclops);
    tickWorld(world);

    const held = resolveId(world, target);
    expect(world.containedBy[held]).toBe(cyclops);
    expect(world.specialActionImpactPending[resolveId(world, cyclops)]).toBe(3);
    const buildingSplash = resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_GREEK_TEMPLE]!);
    const unitSplash = resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!);
    expect(world.hp[resolveId(world, near)]).toBe(starting.get(near)! - buildingSplash);
    expect(world.hp[resolveId(world, edge)]).toBe(starting.get(edge)! - buildingSplash);
    expect(world.hp[resolveId(world, neutral)]).toBe(starting.get(neutral)! - unitSplash);
    expect(world.hp[resolveId(world, outside)]).toBe(starting.get(outside)!);
    expect(world.hp[resolveId(world, ally)]).toBe(starting.get(ally)!);

    let recoveryTicks = 0;
    while (resolveId(world, target) >= 0 && recoveryTicks < 100) {
      tickWorld(world);
      recoveryTicks += 1;
    }
    expect(resolveId(world, target)).toBe(-1);
    expect(recoveryTicks).toBe(31);
  });

  test("kills a committed carried victim if the Cyclops dies before release", () => {
    const { world, cyclops, target } = duel();
    tickWorld(world);
    for (let tick = 0; tick < 23; tick += 1) tickWorld(world);
    expect(world.containedBy[resolveId(world, target)]).toBe(cyclops);

    killUnit(world, resolveId(world, cyclops), true);
    tickWorld(world);
    expect(resolveId(world, cyclops)).toBe(-1);
    expect(resolveId(world, target)).toBe(-1);
  });

  test("falls back to the selected source-authored ordinary attack cycle", () => {
    const { world } = duel();
    world.specialRecharge[0] = 100;
    const startingHp = world.hp[1]!;
    tickWorld(world);
    const cycle = definition.attack.cycleVariants[world.meleeActionVariant[0]!]!;
    for (let tick = 1; tick < cycle.impactDelayTicks; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);
    tickWorld(world);
    expect(world.hp[1]).toBeCloseTo(
      startingHp - resolveMeleeCycleDamage(definition.attack, cycle, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );
  });

  test("hashes pickup, containment, authored recovery, and dense removal deterministically", () => {
    const a = duel(947).world;
    const b = duel(947).world;
    for (let tick = 0; tick < 300; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
    expect(a.count).toBe(b.count);
    for (let index = 0; index < a.count; index += 1) {
      expect(unitIdAt(a, index)).toBe(unitIdAt(b, index));
    }
  });
});
