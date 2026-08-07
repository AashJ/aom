import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { UNIT_CLASS_AIR } from "../../unit-type-schema";
import { TYPE_BELLEROPHON, TYPE_HOPLITE, TYPE_MINOTAUR } from "../../unit-type-ids";
import { definition } from "./bellerophon";

function duel() {
  const world = createWorld(99);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const bellerophon = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_BELLEROPHON);
  const target = spawnUnit(world, 30, 20, 0, 0, 1, TYPE_MINOTAUR);
  const bystander = spawnUnit(world, 30, 20.5, 0, 0, 1, TYPE_HOPLITE);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [bellerophon],
    targetId: target,
  });
  return { world, target, bystander };
}

describe("Greek Bellerophon unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins the launch Classic hero and single-cycle leap", () => {
    expect(definition).toMatchObject({
      maxHp: 400,
      movementSpeed: 6,
      armor: [0.2, 0.4, 0.99],
      costGold: 400,
      costFavor: 6,
      buildTicks: 540,
      populationCost: 4,
      attack: {
        damage: [20, 0, 0],
        cycleVariants: [{ actionTicks: 25, impactDelayTicks: 13 }],
      },
      specialAttack: {
        kind: "charged-jump",
        delivery: "target",
        damage: [100, 0, 0],
        minimumRange: 4,
        range: 14,
        rechargeTicks: 100,
        actionTicks: 26,
        impactDelayTicks: 26,
      },
    });
  });

  test("leaps to the locked landing point and damages only its target at cycle end", () => {
    const { world, target, bystander } = duel();
    const targetStartHp = world.hp[resolveId(world, target)]!;
    const bystanderStartHp = world.hp[resolveId(world, bystander)]!;
    tickWorld(world);
    expect(world.specialActionRemaining[0]).toBe(26);
    expect(world.moveTargetX[0]).toBe(30);

    for (let tick = 0; tick < 25; tick += 1) tickWorld(world);
    expect(world.hp[resolveId(world, target)]).toBe(targetStartHp);
    tickWorld(world);

    const targetIndex = resolveId(world, target);
    // The leap reaches its locked point before the same-tick ground-contact
    // pass separates the overlapping attacker and target bodies.
    expect(Math.hypot(world.posX[0]! - 30, world.posZ[0]! - 20)).toBeLessThan(0.1);
    expect(world.hp[targetIndex]).toBeCloseTo(
      targetStartHp - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_MINOTAUR]!),
      10,
    );
    expect(world.hp[resolveId(world, bystander)]).toBe(bystanderStartHp);
    expect(world.specialRecharge[0]).toBe(100);
  });

  test("cannot leap onto an airborne unit", () => {
    const airborne = {
      ...UNIT_TYPES[TYPE_MINOTAUR]!,
      classes: UNIT_TYPES[TYPE_MINOTAUR]!.classes | UNIT_CLASS_AIR,
    };
    expect(isValidSpecialTarget(definition.specialAttack, airborne)).toBe(false);
  });

  test("keeps leap movement and impact deterministic", () => {
    const a = duel().world;
    const b = duel().world;
    for (let tick = 0; tick < 150; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
