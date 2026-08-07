import { describe, expect, test } from "bun:test";
import {
  COMMAND_ATTACK,
  COMMAND_GARRISON,
  COMMAND_UNGARRISON,
  enqueueCommand,
} from "../../../commands";
import { countGarrisonedUnits } from "../../../ecs/garrison";
import { hashWorld } from "../../../hash";
import { registerPlayer } from "../../../ecs/players";
import { PROJECTILE_BALLISTA_BOLT } from "../../../ecs/projectiles";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { NO_TARGET } from "../../../ecs/unit-tasks";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_HELEPOLIS,
  TYPE_HIPPIKON,
  TYPE_HOPLITE,
  TYPE_JASON,
  TYPE_TOXOTES,
  TYPE_GREEK_VILLAGER,
} from "../../unit-type-ids";
import { definition } from "./helepolis";

function setup(seed = 446) {
  const world = createWorld(seed);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  return world;
}

describe("Greek Helepolis unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins the Trial siege, volley, and garrison rows", () => {
    expect(definition).toMatchObject({
      classes: 528,
      maxHp: 700,
      lineOfSight: 18,
      movementSpeed: 2.9,
      armor: [0.2, 0.96, 0.5],
      costWood: 300,
      costGold: 200,
      buildTicks: 480,
      populationCost: 4,
      attack: {
        kind: "projectile",
        damage: [0, 5, 17],
        range: 10,
        cooldownTicks: 40,
        launchDelayTicks: 16,
        projectileCount: 3,
        projectile: { type: PROJECTILE_BALLISTA_BOLT, speed: 30, lifespanTicks: 40 },
      },
      garrison: { capacity: 5, enterRange: 4, attackMultiplierPerOccupant: 0.05 },
    });
  });

  test("admits villagers, heroes, infantry, and archers but not cavalry", () => {
    const world = setup();
    const helepolis = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HELEPOLIS);
    const eligible = [TYPE_GREEK_VILLAGER, TYPE_JASON, TYPE_HOPLITE, TYPE_TOXOTES].map(
      (type, offset) => spawnUnit(world, 20 + offset * 0.2, 20, 0, 0, 0, type),
    );
    const cavalry = spawnUnit(world, 20, 20.5, 0, 0, 0, TYPE_HIPPIKON);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [...eligible, cavalry],
      targetId: helepolis,
    });
    tickWorld(world);
    expect(countGarrisonedUnits(world, resolveId(world, helepolis))).toBe(4);
    for (const id of eligible) expect(world.containedBy[resolveId(world, id)]).toBe(helepolis);
    expect(world.containedBy[resolveId(world, cavalry)]).toBe(NO_TARGET);
  });

  test("caps occupancy at five and freezes +5% per occupant into a released volley", () => {
    const world = setup();
    const helepolis = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HELEPOLIS);
    const occupants = Array.from({ length: 6 }, (_, index) =>
      spawnUnit(world, 20 + index * 0.1, 20, 0, 0, 0, TYPE_HOPLITE),
    );
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: occupants,
      targetId: helepolis,
    });
    tickWorld(world);
    expect(countGarrisonedUnits(world, resolveId(world, helepolis))).toBe(5);

    const target = spawnUnit(world, 28, 20, 0, 0, 1, TYPE_HOPLITE);
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [helepolis],
      targetId: target,
    });
    tickWorld(world);
    expect(world.projectiles.count).toBe(3);
    expect([...world.projectiles.damageMultipliers.subarray(0, 3)]).toEqual([1.25, 1.25, 1.25]);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_UNGARRISON,
      containerId: helepolis,
    });
    tickWorld(world);
    expect(countGarrisonedUnits(world, resolveId(world, helepolis))).toBe(0);
    expect([...world.projectiles.damageMultipliers.subarray(0, 3)]).toEqual([1.25, 1.25, 1.25]);
  });

  test("ejects occupants before the destroyed container handle is invalidated", () => {
    const world = setup();
    const helepolis = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HELEPOLIS);
    const hoplite = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HOPLITE);
    world.containedBy[resolveId(world, hoplite)] = helepolis;
    world.selectable[resolveId(world, hoplite)] = 0;
    killUnit(world, resolveId(world, helepolis));
    tickWorld(world);
    const released = resolveId(world, hoplite);
    expect(released).toBeGreaterThanOrEqual(0);
    expect(world.containedBy[released]).toBe(NO_TARGET);
    expect(world.selectable[released]).toBe(1);
  });

  test("hashes the frozen projectile damage multiplier", () => {
    const a = setup(901);
    const b = setup(901);
    for (const world of [a, b]) {
      const source = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HELEPOLIS);
      const target = spawnUnit(world, 28, 20, 0, 0, 1, TYPE_HOPLITE);
      enqueueCommand(world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_ATTACK,
        unitIds: [source],
        targetId: target,
      });
      tickWorld(world);
    }
    expect(hashWorld(a)).toBe(hashWorld(b));
    b.projectiles.damageMultipliers[0] = 1.05;
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});
