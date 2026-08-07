import { describe, expect, test } from "bun:test";
import { COMMAND_GATHER, COMMAND_STOP, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import {
  createWorld,
  MODE_EATING_RESOURCE,
  NEUTRAL_OWNER,
  resolveId,
  spawnUnit,
  tickWorld,
} from "../../../ecs/world";
import { TYPE_COLOSSUS, TYPE_GOLD_MINE, TYPE_TREE } from "../../unit-type-ids";
import { definition } from "./colossus";

describe("Greek Colossus unit pack", () => {
  test("pins Classic combat and resource-eating repair", () => {
    expect(definition).toMatchObject({
      maxHp: 1100,
      movementSpeed: 2.4,
      armor: [0.5, 0.8, 0.8],
      costGold: 300,
      costFavor: 40,
      populationCost: 5,
      attack: {
        damage: [20, 0, 50],
        cycleVariants: [
          { actionTicks: 26, impactDelayTicks: 14 },
          { actionTicks: 26, impactDelayTicks: 12 },
        ],
      },
      resourceEat: { consumePerSecond: 30, healPerSecond: 15 },
    });
  });

  test("consumes Wood or Gold continuously, heals proportionally, and is interruptible", () => {
    const world = createWorld(359);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    const colossus = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_COLOSSUS);
    const tree = spawnUnit(world, 20.5, 20, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
    const mine = spawnUnit(world, 23, 20, 0, 0, NEUTRAL_OWNER, TYPE_GOLD_MINE);
    const colossusIndex = resolveId(world, colossus);
    const treeIndex = resolveId(world, tree);
    world.hp[colossusIndex] = 1000;
    const treeStart = world.hp[treeIndex]!;

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [colossus],
      targetId: tree,
    });
    tickWorld(world);
    expect(world.mode[colossusIndex]).toBe(MODE_EATING_RESOURCE);
    expect(world.hp[colossusIndex]).toBeCloseTo(1000.75, 10);
    expect(world.hp[treeIndex]).toBeCloseTo(treeStart - 1.5, 10);

    for (let tick = 0; tick < 9; tick += 1) tickWorld(world);
    const healed = world.hp[colossusIndex]! - 1000;
    const consumed = treeStart - world.hp[treeIndex]!;
    expect(healed).toBeGreaterThan(0);
    expect(healed).toBeCloseTo(consumed / 2, 10);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_STOP,
      unitIds: [colossus],
    });
    tickWorld(world);
    expect(world.mode[colossusIndex]).not.toBe(MODE_EATING_RESOURCE);
    const stoppedHp = world.hp[colossusIndex]!;
    tickWorld(world);
    expect(world.hp[colossusIndex]).toBe(stoppedHp);

    world.hp[colossusIndex] = 1099.5;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [colossus],
      targetId: mine,
    });
    for (let tick = 0; tick < 30 && world.mode[colossusIndex] !== MODE_EATING_RESOURCE; tick += 1) {
      tickWorld(world);
    }
    while (world.hp[colossusIndex]! < definition.maxHp) tickWorld(world);
    expect(world.hp[colossusIndex]).toBe(1100);
  });
});
