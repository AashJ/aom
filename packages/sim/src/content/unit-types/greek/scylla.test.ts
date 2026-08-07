import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { UNIT_TYPES } from "../../generated/unit-types";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_SCYLLA } from "../../unit-type-ids";
import { definition } from "./scylla";

describe("Greek Scylla unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins launch balance, naval domain, and source experience cycles", () => {
    expect(definition).toMatchObject({
      maxHp: 800,
      lineOfSight: 16,
      movementSpeed: 5.3,
      armor: [0.4, 0.7, 0.99],
      costGold: 200,
      costFavor: 15,
      buildTicks: 100,
      populationCost: 5,
      attack: {
        damage: [20, 0, 10],
        range: 0.1,
        bonuses: [{ target: { kind: "classes" }, multiplier: 2 }],
        cycleVariants: [
          { actionTicks: 30, impactDelayTicks: 12 },
          { actionTicks: 30, impactDelayTicks: 12 },
          { actionTicks: 30, impactDelayTicks: 12 },
          { actionTicks: 30, impactDelayTicks: 12 },
          { actionTicks: 30, impactDelayTicks: 12 },
        ],
        killScaling: {
          damageMultiplierPerKill: 1 / 6,
          maxKills: 12,
          killsPerVariant: 3,
        },
      },
    });
  });

  test("applies the Hydra-style one-sixth kill scaling on water", () => {
    for (const kills of [0, 3, 12] as const) {
      const world = createWorld(617 + kills);
      world.waterNavigable.fill(1);
      world.waterWalkable.fill(1);
      registerPlayer(world, 0);
      registerPlayer(world, 1);
      const scylla = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_SCYLLA);
      const target = spawnUnit(world, 20, 21, 0, 0, 1, TYPE_HOPLITE);
      world.combatExperienceKills[resolveId(world, scylla)] = kills;
      const targetIndex = resolveId(world, target);
      const startingHp = world.hp[targetIndex]!;
      enqueueCommand(world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_ATTACK,
        unitIds: [scylla],
        targetId: target,
      });
      for (let tick = 0; tick < 20 && world.hp[targetIndex] === startingHp; tick += 1) {
        tickWorld(world);
      }

      const cycle = definition.attack.cycleVariants[Math.min(4, Math.floor(kills / 3))]!;
      const baseDamage = resolveMeleeCycleDamage(
        definition.attack,
        cycle,
        UNIT_TYPES[TYPE_HOPLITE]!,
      );
      expect(world.hp[targetIndex]).toBeCloseTo(startingHp - baseDamage * (1 + kills / 6), 10);
      expect(world.meleeActionVariant[resolveId(world, scylla)]).toBe(
        Math.min(4, Math.floor(kills / 3)),
      );
    }
  });
});
