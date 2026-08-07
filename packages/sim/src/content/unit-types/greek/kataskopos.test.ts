import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_KATASKOPOS } from "../../unit-type-ids";
import { definition } from "./kataskopos";

describe("Greek Kataskopos unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("does not auto-acquire enemies but obeys an explicit attack order", () => {
    const world = createWorld(80);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const scout = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_KATASKOPOS);
    const target = spawnUnit(world, 20, 21, 0, 0, 1, TYPE_HOPLITE);
    const startingHp = world.hp[1]!;

    for (let tick = 0; tick < 40; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [scout],
      targetId: target,
    });
    for (let tick = 0; tick < 30; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBeLessThan(startingHp);
  });
});
