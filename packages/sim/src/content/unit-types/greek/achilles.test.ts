import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_ACHILLES, TYPE_HOPLITE } from "../../unit-type-ids";
import { definition } from "./achilles";

function attackWorld() {
  const world = createWorld(106);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const achilles = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_ACHILLES);
  const target = spawnUnit(world, 20, 21.25, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [achilles],
    targetId: target,
  });
  return { world, target };
}

describe("Greek Achilles unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic balance and all three mounted attack cycles", () => {
    expect(definition).toMatchObject({
      maxHp: 340,
      movementSpeed: 5.5,
      armor: [0.4, 0.45, 0.99],
      costFood: 350,
      costFavor: 4,
      populationCost: 3,
      attack: {
        damage: [9, 0, 0],
        cooldownTicks: 20,
        cycleVariants: [
          { actionTicks: 20, impactDelayTicks: 9 },
          { actionTicks: 24, impactDelayTicks: 17 },
          { actionTicks: 17, impactDelayTicks: 11 },
        ],
      },
    });
  });

  test("uses the selected source cycle for timing and duration-scaled damage", () => {
    const { world } = attackWorld();
    const startingHp = world.hp[1]!;

    tickWorld(world);
    const variant = world.meleeActionVariant[0]!;
    const cycle = definition.attack.cycleVariants[variant]!;
    expect(variant).toBeLessThan(3);
    expect(world.attackCooldown[0]).toBe(cycle.actionTicks);

    for (let tick = 1; tick < cycle.impactDelayTicks; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startingHp);
    tickWorld(world);

    expect(world.hp[1]).toBeCloseTo(
      startingHp - resolveMeleeCycleDamage(definition.attack, cycle, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );
  });

  test("keeps variable-cycle selection deterministic", () => {
    const a = attackWorld().world;
    const b = attackWorld().world;

    for (let tick = 0; tick < 300; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
