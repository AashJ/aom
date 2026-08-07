import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage, resolveMeleeDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { TARGET_REACTION_THROWN } from "../../../ecs/target-reactions";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_GREEK_TRANSPORT_SHIP, TYPE_WAR_TURTLE } from "../../unit-type-ids";
import { UNIT_TYPES } from "../../generated/unit-types";
import { definition } from "./war-turtle";

describe("Egyptian War Turtle unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins launch naval balance, source cycles, and Buck parameters", () => {
    expect(definition).toMatchObject({
      maxHp: 960,
      lineOfSight: 22,
      movementSpeed: 5.3,
      armor: [0.4, 0.7, 0.8],
      costFood: 300,
      costFavor: 20,
      buildTicks: 180,
      populationCost: 5,
      attack: {
        damage: [25, 0, 20],
        cycleVariants: [{ actionTicks: 33, impactDelayTicks: 18 }],
      },
      specialAttack: {
        kind: "charged-cone-throw",
        damage: [100, 0, 30],
        range: 3,
        radius: 7,
        coneHalfAngleDegrees: 45,
        rechargeTicks: 300,
        actionTicks: 30,
        impactDelayTicks: 18,
        targetReaction: {
          randomDrawOrder: ["maxVelocity", "maxHeight", "distance"],
          distanceBase: 5,
          distanceRandomRange: 1.5,
          maxVelocityBase: 14,
          maxVelocityRandomRange: 4,
          maxHeightBase: 6,
          maxHeightRandomRange: 2,
          bounceBase: 0,
          bounceRandomRange: 0,
        },
      },
    });
    expect(resolveMeleeDamage(definition.attack, definition)).toBe(19);
  });

  test("Buck hits and throws every enemy ship in the forward cone only", () => {
    const world = createWorld(734);
    world.waterNavigable.fill(1);
    world.waterWalkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const turtle = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_WAR_TURTLE);
    const locked = spawnUnit(world, 24, 20, 0, 0, 1, TYPE_GREEK_TRANSPORT_SHIP);
    const diagonal = spawnUnit(world, 24, 24, 0, 0, 1, TYPE_GREEK_TRANSPORT_SHIP);
    const side = spawnUnit(world, 20, 24, 0, 0, 1, TYPE_GREEK_TRANSPORT_SHIP);
    const behind = spawnUnit(world, 17, 20, 0, 0, 1, TYPE_GREEK_TRANSPORT_SHIP);
    const ally = spawnUnit(world, 23, 22, 0, 0, 0, TYPE_GREEK_TRANSPORT_SHIP);
    const nonShip = spawnUnit(world, 23, 19, 0, 0, 1, TYPE_HOPLITE);
    world.attackCooldown[resolveId(world, nonShip)] = 0xffff;
    const ids = [locked, diagonal, side, behind, ally, nonShip];
    const startingHp = new Map(ids.map((id) => [id, world.hp[resolveId(world, id)]!] as const));

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [turtle],
      targetId: locked,
    });
    tickWorld(world);
    expect(world.specialActionRemaining[resolveId(world, turtle)]).toBe(30);
    for (let tick = 0; tick < 17; tick += 1) tickWorld(world);
    for (const id of ids) expect(world.hp[resolveId(world, id)]).toBe(startingHp.get(id)!);

    tickWorld(world);
    const specialDamage = resolveDamage(
      definition.specialAttack,
      UNIT_TYPES[TYPE_GREEK_TRANSPORT_SHIP]!,
    );
    for (const id of [locked, diagonal]) {
      const index = resolveId(world, id);
      expect(world.hp[index]).toBe(startingHp.get(id)! - specialDamage);
      expect(world.targetReactions.kind[index]).toBe(TARGET_REACTION_THROWN);
      expect(world.targetReactions.numberBounces[index]).toBe(0);
    }
    for (const id of [side, behind, ally, nonShip]) {
      const index = resolveId(world, id);
      expect(world.hp[index]).toBe(startingHp.get(id)!);
      expect(world.targetReactions.kind[index]).toBe(0);
    }
    expect(world.specialRecharge[resolveId(world, turtle)]).toBe(300);
  });
});
