import { describe, expect, test } from "bun:test";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_CARCINOS } from "../../unit-type-ids";
import { definition } from "./carcinos";

describe("Greek Carcinos unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins launch balance, source attack timing, and Crab Blood", () => {
    expect(definition).toMatchObject({
      maxHp: 720,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.7, 0.6, 0.8],
      costWood: 200,
      costFavor: 20,
      buildTicks: 180,
      populationCost: 4,
      attack: {
        damage: [20, 0, 12],
        range: 0.3,
        cycleVariants: [
          { actionTicks: 22, impactDelayTicks: 10 },
          { actionTicks: 24, impactDelayTicks: 11 },
        ],
      },
      deathAreaAttack: {
        damage: [300, 0, 0],
        radius: 7.5,
        falloff: "constant",
      },
    });
  });

  test("Crab Blood damages enemies only at a constant radius", () => {
    const world = createWorld(631);
    world.waterNavigable.fill(1);
    world.waterWalkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const carcinos = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_CARCINOS);
    const enemy = spawnUnit(world, 20, 21, 0, 0, 1, TYPE_CARCINOS);
    const ally = spawnUnit(world, 21, 20, 0, 0, 0, TYPE_CARCINOS);
    const neutral = spawnUnit(world, 19, 20, 0, 0, 255, TYPE_CARCINOS);
    const outside = spawnUnit(world, 20, 27.6, 0, 0, 1, TYPE_CARCINOS);
    const startingHp = new Map(
      [enemy, ally, neutral, outside].map((id) => [id, world.hp[resolveId(world, id)]!] as const),
    );

    killUnit(world, resolveId(world, carcinos));
    tickWorld(world);

    const hp = (id: number) => world.hp[resolveId(world, id)]!;
    expect(hp(enemy)).toBe(startingHp.get(enemy)! - 300 * (1 - 0.7));
    expect(hp(ally)).toBe(startingHp.get(ally)!);
    expect(hp(neutral)).toBe(startingHp.get(neutral)!);
    expect(hp(outside)).toBe(startingHp.get(outside)!);
  });
});
