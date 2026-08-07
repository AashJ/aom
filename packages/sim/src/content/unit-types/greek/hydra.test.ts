import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveMeleeCycleDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_HYDRA } from "../../unit-type-ids";
import { definition } from "./hydra";

function attackWorld(kills = 0) {
  const world = createWorld(356);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const hydra = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HYDRA);
  const target = spawnUnit(world, 20, 22, 0, 0, 1, TYPE_HOPLITE);
  world.combatExperienceKills[0] = kills;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [hydra],
    targetId: target,
  });
  return { world, hydra, target };
}

function creditedKill(world: ReturnType<typeof createWorld>, hydra: number): void {
  const target = spawnUnit(world, 20, 22, 0, 0, 1, TYPE_HOPLITE);
  world.hp[resolveId(world, target)] = 1;
  enqueueCommand(world, {
    tick: world.tick,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [hydra],
    targetId: target,
  });
  for (let tick = 0; tick < 40 && resolveId(world, target) >= 0; tick += 1) tickWorld(world);
  while (world.attackCooldown[resolveId(world, hydra)]! > 0) tickWorld(world);
  expect(resolveId(world, target)).toBe(-1);
}

describe("Greek Hydra unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance and five source experience cycles", () => {
    expect(definition).toMatchObject({
      maxHp: 800,
      lineOfSight: 16,
      movementSpeed: 4,
      armor: [0.6, 0.4, 0.8],
      costFood: 250,
      costFavor: 28,
      buildTicks: 400,
      populationCost: 5,
      attack: {
        damage: [20, 0, 10],
        range: 2,
        cycleVariants: [
          { actionTicks: 30, impactDelayTicks: 15 },
          { actionTicks: 30, impactDelayTicks: 16 },
          { actionTicks: 30, impactDelayTicks: 16 },
          { actionTicks: 30, impactDelayTicks: 16 },
          { actionTicks: 30, impactDelayTicks: 16 },
        ],
        killScaling: {
          damageMultiplierPerKill: 1 / 6,
          maxKills: 12,
          killsPerVariant: 3,
        },
      },
    });
  });

  test("adds one-sixth damage per credited kill and caps at triple damage", () => {
    for (const kills of [0, 1, 6, 12] as const) {
      const { world, target } = attackWorld(kills);
      const startingHp = world.hp[1]!;
      for (let tick = 0; tick < 20 && world.hp[1] === startingHp; tick += 1) tickWorld(world);
      const variant = Math.min(4, Math.floor(kills / 3));
      const expected =
        resolveMeleeCycleDamage(
          definition.attack,
          definition.attack.cycleVariants[variant]!,
          UNIT_TYPES[TYPE_HOPLITE]!,
        ) *
        (1 + kills / 6);
      expect(world.hp[resolveId(world, target)]).toBeCloseTo(startingHp - expected, 10);
    }
  });

  test("grows one visual tier every three kills and caps after twelve", () => {
    const { world, hydra, target } = attackWorld();
    killUnit(world, resolveId(world, target));
    tickWorld(world);

    for (let kill = 1; kill <= 13; kill += 1) {
      creditedKill(world, hydra);
      const hydraIndex = resolveId(world, hydra);
      expect(world.combatExperienceKills[hydraIndex]).toBe(Math.min(kill, 12));

      const probe = spawnUnit(world, 20, 22, 0, 0, 1, TYPE_HOPLITE);
      enqueueCommand(world, {
        tick: world.tick,
        issuer: 0,
        type: COMMAND_ATTACK,
        unitIds: [hydra],
        targetId: probe,
      });
      tickWorld(world);
      expect(world.meleeActionVariant[hydraIndex]).toBe(Math.min(4, Math.floor(kill / 3)));
      killUnit(world, resolveId(world, probe));
      tickWorld(world);
      while (world.attackCooldown[resolveId(world, hydra)]! > 0) tickWorld(world);
    }
  });

  test("copies, snapshots, death-projects, and hashes kill experience", () => {
    const { world, hydra } = attackWorld(7);
    const twin = attackWorld(6).world;
    expect(hashWorld(world)).not.toBe(hashWorld(twin));

    const disposable = spawnUnit(world, 10, 10, 0, 0, 0, TYPE_HOPLITE);
    killUnit(world, resolveId(world, disposable));
    tickWorld(world);
    expect(world.combatExperienceKills[resolveId(world, hydra)]).toBe(7);

    const snapshot = createSnapshot(8);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.combatExperienceKills[resolveId(world, hydra)]).toBe(7);

    killUnit(world, resolveId(world, hydra));
    tickWorld(world);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.deathCombatExperienceKills[0]).toBe(7);
  });
});
