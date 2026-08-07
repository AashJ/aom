import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, COMMAND_GARRISON, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { countGarrisonedUnits } from "../../../ecs/garrison";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import {
  TYPE_EGYPTIAN_HOUSE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_SIEGE_TOWER,
} from "../../unit-type-ids";
import { definition } from "./siege-tower";

function attack(world: ReturnType<typeof createWorld>, source: number, target: number): void {
  enqueueCommand(world, {
    tick: world.tick,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [source],
    targetId: target,
  });
}

describe("Egyptian Siege Tower unit pack", () => {
  test("pins its two automatic attack modes and five-unit mobile garrison", () => {
    expect(definition).toMatchObject({
      maxHp: 350,
      armor: [0.05, 0.96, 0.9],
      attack: { kind: "projectile", damage: [0, 5, 0], projectileCount: 3, launchDelayTicks: 8 },
      buildingAttack: {
        kind: "melee",
        damage: [0, 0, 50],
        range: 3,
        cooldownTicks: 80,
        cycleVariants: [{ actionTicks: 80, impactDelayTicks: 40 }],
      },
      garrison: {
        capacity: 5,
        attackMultiplierPerOccupant: 0.05,
        speedMultiplierPerOccupant: 0.05,
      },
      buildTicks: 440,
    });
  });

  test("rams buildings but fires a three-arrow volley at units", () => {
    const world = createWorld(316);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const tower = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SIEGE_TOWER);
    const house = spawnUnit(world, 22, 20, 0, 0, 1, TYPE_EGYPTIAN_HOUSE);
    const houseIndex = resolveId(world, house);
    const houseStart = world.hp[houseIndex]!;
    attack(world, tower, house);
    for (let tick = 0; tick < 40; tick += 1) tickWorld(world);
    expect(world.hp[houseIndex]).toBe(houseStart);
    expect(world.projectiles.count).toBe(0);
    tickWorld(world);
    expect(world.hp[houseIndex]).toBeLessThan(houseStart);

    const rangedWorld = createWorld(318);
    rangedWorld.walkable.fill(1);
    registerPlayer(rangedWorld, 0);
    registerPlayer(rangedWorld, 1);
    const rangedTower = spawnUnit(rangedWorld, 20, 20, 0, 0, 0, TYPE_SIEGE_TOWER);
    const soldier = spawnUnit(rangedWorld, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    attack(rangedWorld, rangedTower, soldier);
    tickWorld(rangedWorld);
    for (let tick = 0; tick < 8; tick += 1) tickWorld(rangedWorld);
    expect(rangedWorld.projectiles.count).toBe(3);
  });

  test("accepts foot units and applies source garrison bonuses", () => {
    const world = createWorld(317);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    const tower = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SIEGE_TOWER);
    const villager = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_GREEK_VILLAGER);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [villager],
      targetId: tower,
    });
    for (let tick = 0; tick < 40 && countGarrisonedUnits(world, resolveId(world, tower)) === 0; tick += 1) {
      tickWorld(world);
    }
    expect(countGarrisonedUnits(world, resolveId(world, tower))).toBe(1);
  });
});
