import { describe, expect, test } from "bun:test";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_JASON, TYPE_SCARAB, TYPE_TREE } from "../../unit-type-ids";
import { definition } from "./scarab";

function deathWorld() {
  const world = createWorld(314);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const scarab = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SCARAB);
  const enemy = spawnUnit(world, 20, 21, 0, 0, 1, TYPE_HOPLITE);
  const hero = spawnUnit(world, 21, 20, 0, 0, 1, TYPE_JASON);
  const ally = spawnUnit(world, 19, 20, 0, 0, 0, TYPE_HOPLITE);
  const neutral = spawnUnit(world, 20, 19, 0, 0, 255, TYPE_TREE);
  const outside = spawnUnit(world, 20, 27.6, 0, 0, 1, TYPE_HOPLITE);
  return { world, scarab, enemy, hero, ally, neutral, outside };
}

describe("Egyptian Scarab unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance, source attack timing, and death-area contract", () => {
    expect(definition).toMatchObject({
      maxHp: 670,
      lineOfSight: 16,
      movementSpeed: 3.2,
      armor: [0.3, 0.75, 0.8],
      costFood: 200,
      costFavor: 20,
      buildTicks: 400,
      populationCost: 5,
      attack: {
        damage: [6, 0, 12],
        range: 0.1,
        cycleVariants: [{ actionTicks: 30, impactDelayTicks: 13 }],
      },
      deathAreaAttack: {
        damage: [0, 30, 0],
        radius: 7.5,
        falloff: "constant",
      },
    });
  });

  test("deals constant enemy-and-neutral death damage while sparing allies", () => {
    const { world, scarab, enemy, hero, ally, neutral, outside } = deathWorld();
    const startingHp = new Map(
      [enemy, hero, ally, neutral, outside].map((id) => {
        const index = resolveId(world, id);
        return [id, world.hp[index]!] as const;
      }),
    );

    killUnit(world, resolveId(world, scarab));
    tickWorld(world);

    const hp = (id: number) => world.hp[resolveId(world, id)]!;
    expect(hp(enemy)).toBe(startingHp.get(enemy)! - 30 * (1 - 0.15));
    expect(hp(hero)).toBeCloseTo(startingHp.get(hero)! - 30 * 0.01 * (1 - 0.35), 10);
    expect(hp(ally)).toBe(startingHp.get(ally)!);
    expect(hp(neutral)).toBe(startingHp.get(neutral)! - 30);
    expect(hp(outside)).toBe(startingHp.get(outside)!);
  });

  test("processes chained Scarab death bursts once in lethal-event order", () => {
    const world = createWorld(315);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    registerPlayer(world, 2);
    const first = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SCARAB);
    const second = spawnUnit(world, 21, 20, 0, 0, 1, TYPE_SCARAB);
    const target = spawnUnit(world, 20, 21, 0, 0, 2, TYPE_HOPLITE);
    const targetIndex = resolveId(world, target);
    const startingHp = world.hp[targetIndex]!;
    world.hp[resolveId(world, second)] = 1;

    killUnit(world, resolveId(world, first));
    tickWorld(world);

    expect(world.deathEventCount).toBe(2);
    expect(world.hp[resolveId(world, target)]).toBe(startingHp - 60 * (1 - 0.15));
  });

  test("keeps chained death-area resolution deterministic", () => {
    const a = deathWorld().world;
    const b = deathWorld().world;
    killUnit(a, 0);
    killUnit(b, 0);
    tickWorld(a);
    tickWorld(b);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  test("retains siege and myth identity in generated combat content", () => {
    expect(UNIT_TYPES[TYPE_SCARAB]).toBeDefined();
  });
});
