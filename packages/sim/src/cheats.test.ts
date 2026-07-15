import { describe, expect, test } from "bun:test";
import {
  CHEAT_ADD_FOOD,
  CHEAT_ADD_GOLD,
  CHEAT_ADD_WOOD,
  CHEAT_FULL_FAVOR,
  CHEAT_REVEAL_MAP,
  COMMAND_CHEAT,
  enqueueCommand,
  type CheatId,
} from "./commands";
import { registerPlayer } from "./ecs/players";
import { GOD_HADES } from "./ecs/progression";
import { FAVOR, FOOD, GOLD, RESOURCE_COUNT, WOOD } from "./ecs/types";
import { createWorld, tickWorld, type World } from "./ecs/world";
import { VIS_EXPLORED, VIS_UNSEEN, VISIBILITY_TILES } from "./visibility";

function applyCheat(world: World, issuer: number, cheat: CheatId): void {
  enqueueCommand(world, {
    tick: world.tick,
    issuer,
    type: COMMAND_CHEAT,
    cheat,
  });
  tickWorld(world);
}

describe("Classic cheat codes", () => {
  test("adds 1,000 food, wood, and gold to the issuing player", () => {
    const world = createWorld(42);
    registerPlayer(world, 0);
    world.stockpiles[FOOD] = 25;
    world.stockpiles[WOOD] = 50;
    world.stockpiles[GOLD] = 75;

    applyCheat(world, 0, CHEAT_ADD_FOOD);
    applyCheat(world, 0, CHEAT_ADD_WOOD);
    applyCheat(world, 0, CHEAT_ADD_GOLD);

    expect(world.stockpiles[FOOD]).toBe(1_025);
    expect(world.stockpiles[WOOD]).toBe(1_050);
    expect(world.stockpiles[GOLD]).toBe(1_075);
  });

  test("fills favor to the Classic cap for Zeus and other major gods", () => {
    const world = createWorld(42);
    registerPlayer(world, 0);
    registerPlayer(world, 1, GOD_HADES);
    world.stockpiles[FAVOR] = 12;
    world.stockpiles[RESOURCE_COUNT + FAVOR] = 34;

    applyCheat(world, 0, CHEAT_FULL_FAVOR);
    applyCheat(world, 1, CHEAT_FULL_FAVOR);

    expect(world.stockpiles[FAVOR]).toBe(200);
    expect(world.stockpiles[RESOURCE_COUNT + FAVOR]).toBe(100);
  });

  test("reveals explored terrain only for the issuing player", () => {
    const world = createWorld(42);
    registerPlayer(world, 0);
    registerPlayer(world, 1);

    applyCheat(world, 0, CHEAT_REVEAL_MAP);

    expect(world.visibility.subarray(0, VISIBILITY_TILES).every((v) => v === VIS_EXPLORED)).toBe(
      true,
    );
    expect(
      world.visibility
        .subarray(VISIBILITY_TILES, VISIBILITY_TILES * 2)
        .every((v) => v === VIS_UNSEEN),
    ).toBe(true);
  });
});
