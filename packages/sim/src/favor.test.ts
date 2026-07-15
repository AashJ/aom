import { describe, expect, test } from "bun:test";
import { COMMAND_PRAY, enqueueCommand } from "./commands";
import {
  FAVOR_PROGRESS_PER_RESOURCE,
  greekFavorRateMicrosPerSecond,
  greekFavorRateMilliPerMinute,
} from "./ecs/favor";
import { registerPlayer } from "./ecs/players";
import { GOD_HADES, GOD_ZEUS } from "./ecs/progression";
import { FAVOR, TYPE_TEMPLE, TYPE_VILLAGER } from "./ecs/types";
import {
  MODE_IDLE,
  MODE_PRAYING,
  createWorld,
  resolveId,
  spawnBuilding,
  spawnUnit,
  tickWorld,
  type World,
} from "./ecs/world";
import { hashWorld } from "./hash";
import { createSnapshot, writeSnapshot } from "./snapshot";

function prayerWorld(complete = true): {
  world: World;
  temple: number;
  villager: number;
} {
  const world = createWorld(42);

  registerPlayer(world, 0);
  world.walkable.fill(1);
  const temple = spawnBuilding(world, 40, 40, 0, TYPE_TEMPLE, complete);
  const villager = spawnUnit(world, 38.5, 42.5, 0, 0, 0, TYPE_VILLAGER);

  return { world, temple, villager };
}

function orderPrayer(world: World, villager: number, temple: number): void {
  enqueueCommand(world, {
    tick: world.tick,
    issuer: 0,
    type: COMMAND_PRAY,
    unitIds: [villager],
    targetId: temple,
  });
  tickWorld(world);
}

describe("Greek Temple prayer", () => {
  test("uses the Classic global diminishing-return curve and Zeus bonus", () => {
    expect(greekFavorRateMicrosPerSecond(1, GOD_HADES)).toBe(88_093);
    expect(greekFavorRateMicrosPerSecond(1, GOD_ZEUS)).toBe(105_711);
    expect(greekFavorRateMicrosPerSecond(6, GOD_HADES)).toBe(413_798);
    expect(greekFavorRateMicrosPerSecond(6, GOD_ZEUS)).toBe(496_557);
    expect(greekFavorRateMicrosPerSecond(13, GOD_ZEUS)).toBe(613_080);
    expect(greekFavorRateMilliPerMinute(6, GOD_ZEUS)).toBe(29_793);
  });

  test("tasks a Greek Villager to a completed Temple and generates Favor", () => {
    const { world, temple, villager } = prayerWorld();
    const villagerIndex = resolveId(world, villager);

    orderPrayer(world, villager, temple);
    expect(world.mode[villagerIndex]).toBe(MODE_PRAYING);

    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(world);
    }

    expect(world.prayingVillagers[0]).toBe(1);
    expect(world.stockpiles[FAVOR]).toBe(1);
  });

  test("counts praying Villagers globally across multiple Temples", () => {
    const { world, temple, villager } = prayerWorld();
    const otherTemple = spawnBuilding(world, 60, 40, 0, TYPE_TEMPLE, true);
    const otherVillager = spawnUnit(world, 58.5, 42.5, 0, 0, 0, TYPE_VILLAGER);

    orderPrayer(world, villager, temple);
    orderPrayer(world, otherVillager, otherTemple);
    tickWorld(world);

    const snapshot = createSnapshot(8);
    writeSnapshot(world, snapshot, 0);

    expect(world.prayingVillagers[0]).toBe(2);
    expect(snapshot.favorRateMilliPerMinute).toBe(12_156);
  });

  test("rejects prayer at an unfinished Temple", () => {
    const { world, temple, villager } = prayerWorld(false);
    const villagerIndex = resolveId(world, villager);

    orderPrayer(world, villager, temple);

    expect(world.mode[villagerIndex]).toBe(MODE_IDLE);
    expect(world.prayingVillagers[0]).toBe(0);
  });

  test("stops at Zeus's Classic Favor cap and discards fractional progress", () => {
    const { world, temple, villager } = prayerWorld();

    orderPrayer(world, villager, temple);
    world.stockpiles[FAVOR] = 199;
    world.playerFavorProgress[0] = FAVOR_PROGRESS_PER_RESOURCE - 1;
    tickWorld(world);

    expect(world.stockpiles[FAVOR]).toBe(200);
    expect(world.playerFavorProgress[0]).toBe(0);

    const snapshot = createSnapshot(8);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.favorRateMilliPerMinute).toBe(0);
  });

  test("hashes fractional Favor progress", () => {
    const a = createWorld(42);
    const b = createWorld(42);

    registerPlayer(a, 0);
    registerPlayer(b, 0);
    expect(hashWorld(a)).toBe(hashWorld(b));

    a.playerFavorProgress[0] = 1;
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});
