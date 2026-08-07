import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { PROJECTILE_PETROBOLOS_STONE } from "../../../ecs/projectiles";
import { MODE_PRAYING, createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_GREEK_HOUSE, TYPE_HOPLITE, TYPE_PETROBOLOS } from "../../unit-type-ids";
import { definition } from "./petrobolos";

describe("Greek Petrobolos unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins the four-second three-stone Classic siege attack", () => {
    expect(definition).toMatchObject({
      classes: 528,
      maxHp: 110,
      lineOfSight: 40,
      movementSpeed: 2.4,
      armor: [0.3, 0.9, 0.9],
      costWood: 150,
      costGold: 200,
      buildTicks: 380,
      populationCost: 3,
      attack: {
        kind: "projectile",
        damage: [0, 5, 11],
        range: 28,
        minimumRange: 10,
        cooldownTicks: 80,
        launchDelayTicks: 2,
        projectileCount: 3,
        autoAcquireBuildings: true,
        projectile: { type: PROJECTILE_PETROBOLOS_STONE, speed: 20, lifespanTicks: 40 },
      },
    });
    expect(definition.attack).not.toHaveProperty("impactArea");
  });

  test("backs out of its ten-tile dead zone before firing", () => {
    const world = createWorld(445);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const petrobolos = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PETROBOLOS);
    const target = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    world.mode[1] = MODE_PRAYING;
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [petrobolos],
      targetId: target,
    });

    tickWorld(world);
    expect(world.projectiles.count).toBe(0);
    expect(world.moving[0]).toBe(1);
    expect(world.moveTargetX[0]).toBeLessThan(20);

    for (let tick = 0; tick < 80 && world.attackCooldown[0] === 0; tick += 1) tickWorld(world);
    expect(world.attackCooldown[0]).toBeGreaterThan(0);
  });

  test("prefers an enemy building over a nearer unit during automatic acquisition", () => {
    const world = createWorld(446);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    spawnUnit(world, 50, 50, 0, 0, 0, TYPE_PETROBOLOS);
    spawnUnit(world, 55, 50, 0, 0, 1, TYPE_HOPLITE);
    const building = spawnUnit(world, 65, 50, 0, 0, 1, TYPE_GREEK_HOUSE);

    tickWorld(world);

    expect(world.attackTarget[0]).toBe(building);
    expect(UNIT_TYPES[TYPE_GREEK_HOUSE]!.isStatic).toBe(true);
  });
});
