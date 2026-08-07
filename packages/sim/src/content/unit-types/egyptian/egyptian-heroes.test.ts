import { describe, expect, test } from "bun:test";
import {
  COMMAND_ATTACK,
  COMMAND_EMPOWER,
  COMMAND_HEAL,
  enqueueCommand,
} from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { AGE_MYTHIC, GOD_ISIS, GOD_OSIRIS, GOD_RA } from "../../../ecs/progression";
import { effectiveAttackRange, effectiveMaxHp } from "../../../ecs/unit-age";
import {
  createWorld,
  killUnit,
  spawnBuilding,
  spawnUnit,
  tickWorld,
  transformPharaohToSonOfOsiris,
} from "../../../ecs/world";
import {
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_HOPLITE,
  TYPE_PHARAOH,
  TYPE_PRIEST,
  TYPE_SON_OF_OSIRIS,
} from "../../unit-type-ids";
import { definition as pharaoh } from "./pharaoh";
import { definition as priest } from "./priest";
import { definition as son } from "./son-of-osiris";

function flatWorld(majorGod = GOD_ISIS) {
  const world = createWorld(433);
  world.walkable.fill(1);
  registerPlayer(world, 0, majorGod);
  registerPlayer(world, 1, GOD_ISIS);
  return world;
}

describe("Egyptian hero support pack", () => {
  test("pins the source-authored age progression", () => {
    expect(effectiveMaxHp(pharaoh, AGE_MYTHIC)).toBe(120);
    expect(effectiveAttackRange(pharaoh, pharaoh.attack, AGE_MYTHIC)).toBe(20);
    expect(effectiveMaxHp(priest, AGE_MYTHIC)).toBe(108);
    expect(effectiveAttackRange(priest, priest.attack, AGE_MYTHIC)).toBe(22);
  });

  test("heals idle allies at the authored rate and rejects healing the Son", () => {
    const world = flatWorld();
    const source = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PRIEST);
    const ally = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_HOPLITE);
    world.hp[1] = 50;
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_HEAL,
      unitIds: [source],
      targetId: ally,
    });
    for (let tick = 0; tick < 20; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBeCloseTo(57.5, 8);

    const sonId = spawnUnit(world, 22, 20, 0, 0, 0, TYPE_SON_OF_OSIRIS);
    world.hp[2] = 100;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_HEAL,
      unitIds: [source],
      targetId: sonId,
    });
    tickWorld(world);
    expect(world.hp[2]).toBe(100);
  });

  test("only Ra priests can empower", () => {
    for (const [majorGod, expectedMode] of [[GOD_ISIS, 0], [GOD_RA, 12]] as const) {
      const world = flatWorld(majorGod);
      const source = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PRIEST);
      const building = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_EGYPTIAN_HOUSE);
      enqueueCommand(world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_EMPOWER,
        unitIds: [source],
        targetId: building,
      });
      tickWorld(world);
      expect(world.mode[0]).toBe(expectedMode);
    }
  });

  test("chains Son of Osiris lightning through at most four nearest enemies", () => {
    const world = flatWorld();
    const attacker = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SON_OF_OSIRIS);
    const targets = [26, 28, 30, 32, 34].map((x) =>
      spawnUnit(world, x, 20, 0, 0, 1, TYPE_HOPLITE),
    );
    const startHp = targets.map((_, index) => world.hp[index + 1]!);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [attacker],
      targetId: targets[0]!,
    });
    for (let tick = 0; tick < 34; tick += 1) tickWorld(world);
    for (let index = 0; index < 4; index += 1) expect(world.hp[index + 1]).toBeLessThan(startHp[index]!);
    expect(world.hp[5]).toBe(startHp[4]);
  });

  test("returns a slain Pharaoh after the exact 90-second delay when a Town Center survives", () => {
    const world = flatWorld();
    spawnBuilding(world, 18, 18, 0, TYPE_EGYPTIAN_TOWN_CENTER);
    spawnUnit(world, 28, 20, 0, 0, 0, TYPE_PHARAOH);
    killUnit(world, 1, true);
    tickWorld(world);
    expect(world.pharaohRespawnRemaining[0]).toBe(1799);
    for (let tick = 0; tick < 1799; tick += 1) tickWorld(world);
    expect(Array.from(world.unitType.slice(0, world.count))).not.toContain(TYPE_PHARAOH);
    tickWorld(world);
    expect(Array.from(world.unitType.slice(0, world.count))).toContain(TYPE_PHARAOH);
  });

  test("pins the Son's Classic combat and support contract", () => {
    expect(son).toMatchObject({
      maxHp: 420,
      lineOfSight: 25,
      armor: [0.3, 0.5, 0.99],
      healable: false,
      attack: {
        damage: [60, 0, 0],
        range: 18,
        cooldownTicks: 60,
        impactDelayTicks: 33,
        chain: { maxTargets: 4 },
      },
    });
  });

  test("transforms an Osiris Pharaoh in place and preserves its hit-point percentage", () => {
    const world = flatWorld();
    world.playerMinorGods[3] = GOD_OSIRIS;
    const id = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PHARAOH);
    world.hp[0] = 50;
    expect(transformPharaohToSonOfOsiris(world, id)).toBe(true);
    expect(world.unitType[0]).toBe(TYPE_SON_OF_OSIRIS);
    expect(world.hp[0]).toBe(210);
    expect(world.handleOf[0]).toBe(id);
  });
});
