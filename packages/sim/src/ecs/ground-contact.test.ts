import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../commands";
import { UNIT_TYPES } from "../content/generated/unit-types";
import { TYPE_NEMEAN_LION } from "../content/unit-type-ids";
import { registerPlayer } from "./players";
import { MODE_PRAYING, createWorld, spawnUnit, tickWorld, type World } from "./world";

const lionRadius = UNIT_TYPES[TYPE_NEMEAN_LION]!.bodyRadius;
const lionContactDistance = lionRadius * 2;

function combatWorld(): World {
  const world = createWorld(73);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  return world;
}

function distance(world: World, a: number, b: number): number {
  return Math.hypot(world.posX[a]! - world.posX[b]!, world.posZ[a]! - world.posZ[b]!);
}

function orderAttack(world: World, issuer: number, attackers: number[], target: number): void {
  enqueueCommand(world, {
    tick: 0,
    issuer,
    type: COMMAND_ATTACK,
    unitIds: attackers,
    targetId: target,
  });
}

function expectContactIsValid(world: World, a: number, b: number): void {
  expect(distance(world, a, b)).toBeGreaterThanOrEqual(lionContactDistance - 1e-5);
}

describe("transactional mobile ground contact", () => {
  test("keeps a mutually approaching duel outside both obstruction bodies", () => {
    const world = combatWorld();
    const first = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    const second = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_NEMEAN_LION);
    orderAttack(world, 0, [first], second);
    orderAttack(world, 1, [second], first);

    for (let tick = 0; tick < 20; tick += 1) {
      tickWorld(world);
      expectContactIsValid(world, 0, 1);
    }

    expect(world.specialActionRemaining[0]).toBeGreaterThan(0);
    expect(world.specialActionRemaining[1]).toBeGreaterThan(0);
  });

  test("resolves every edge when two attackers converge on one target", () => {
    const world = combatWorld();
    const left = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    const target = spawnUnit(world, 22.12, 20, 0, 0, 1, TYPE_NEMEAN_LION);
    const right = spawnUnit(world, 24.24, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    world.mode[1] = MODE_PRAYING;
    orderAttack(world, 0, [left, right], target);

    tickWorld(world);

    expectContactIsValid(world, 0, 1);
    expectContactIsValid(world, 1, 2);
  });

  test("resolves an attack chain without invalidating an earlier pair", () => {
    const world = combatWorld();
    const left = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    const middle = spawnUnit(world, 22.12, 20, 0, 0, 1, TYPE_NEMEAN_LION);
    const right = spawnUnit(world, 24.24, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    orderAttack(world, 0, [left], middle);
    orderAttack(world, 1, [middle], right);

    tickWorld(world);

    expectContactIsValid(world, 0, 1);
    expectContactIsValid(world, 1, 2);
  });

  test("keeps inactive incident edges when another contact moves their shared unit", () => {
    const world = combatWorld();
    const waiting = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    const target = spawnUnit(world, 22, 20, 0, 0, 1, TYPE_NEMEAN_LION);
    const approaching = spawnUnit(world, 24.12, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    world.mode[1] = MODE_PRAYING;
    orderAttack(world, 0, [waiting, approaching], target);

    tickWorld(world);

    expectContactIsValid(world, 0, 1);
    expectContactIsValid(world, 1, 2);
  });

  test("repairs penetration even after both combat actions lock position", () => {
    const world = combatWorld();
    const first = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    const second = spawnUnit(world, 21.5, 20, 0, 0, 1, TYPE_NEMEAN_LION);
    orderAttack(world, 0, [first], second);
    orderAttack(world, 1, [second], first);

    tickWorld(world);

    expectContactIsValid(world, 0, 1);
    expect(world.specialActionRemaining[0]).toBeGreaterThan(0);
    expect(world.specialActionRemaining[1]).toBeGreaterThan(0);
  });

  test("uses stable identity to separate an exactly stacked locked pair", () => {
    const world = combatWorld();
    const first = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_NEMEAN_LION);
    const second = spawnUnit(world, 20, 20, 0, 0, 1, TYPE_NEMEAN_LION);
    orderAttack(world, 0, [first], second);
    orderAttack(world, 1, [second], first);

    tickWorld(world);

    expectContactIsValid(world, 0, 1);
  });
});
