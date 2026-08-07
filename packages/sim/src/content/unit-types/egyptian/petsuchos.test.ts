import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, COMMAND_MOVE, enqueueCommand } from "../../../commands";
import { resolveDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_JASON, TYPE_PETSUCHOS } from "../../unit-type-ids";
import { definition } from "./petsuchos";

function attackWorld(targetType = TYPE_HOPLITE) {
  const world = createWorld(529);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const petsuchos = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PETSUCHOS);
  const target = spawnUnit(world, 30, 20, 0, 0, 1, targetType);
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [petsuchos],
    targetId: target,
  });
  return { world, petsuchos, target };
}

describe("Egyptian Petsuchos unit pack", () => {
  test("matches the integration-owned Classic reference", () => {
    const reference = GATE_C_MYTH_UNIT_REFERENCES.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance and the three-second LightningAttack cycle", () => {
    expect(definition).toMatchObject({
      maxHp: 480,
      lineOfSight: 24,
      movementSpeed: 3.6,
      armor: [0.3, 0.5, 0.8],
      costGold: 200,
      costFavor: 20,
      buildTicks: 400,
      populationCost: 4,
      attack: {
        kind: "beam",
        damage: [0, 50, 20],
        range: 20,
        cooldownTicks: 60,
        impactDelayTicks: 27,
      },
    });
  });

  test("applies one full, unscaled damage packet at the authored Attack tag", () => {
    const { world } = attackWorld();
    const startHp = world.hp[1]!;

    for (let tick = 0; tick < 27; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startHp);
    expect(world.attackCooldown[0]).toBe(34);

    tickWorld(world);
    expect(world.attackCooldown[0]).toBe(33);
    expect(world.hp[1]).toBeCloseTo(
      startHp - resolveDamage(definition.attack, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );

    const afterImpact = world.hp[1]!;
    for (let tick = 0; tick < 32; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(afterImpact);
    expect(world.attackCooldown[0]).toBe(1);
  });

  test("tracks the stable target but misses if it leaves range before impact", () => {
    const { world } = attackWorld();
    tickWorld(world);
    const startHp = world.hp[1]!;
    world.posX[1] = 60;
    world.posZ[1] = 20;

    for (let tick = 0; tick < 27; tick += 1) tickWorld(world);

    expect(world.hp[1]).toBe(startHp);
    expect(world.beamActionImpactPending[0]).toBe(0);
    expect(world.attackCooldown[0]).toBe(33);
  });

  test("a replacement order interrupts the beam wind-up without landing damage", () => {
    const { world, petsuchos } = attackWorld();
    tickWorld(world);
    const startHp = world.hp[1]!;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [petsuchos],
      targetX: 15,
      targetZ: 20,
    });
    tickWorld(world);

    expect(world.beamActionActive[0]).toBe(0);
    expect(world.beamActionImpactPending[0]).toBe(0);
    expect(world.moving[0]).toBe(1);
    for (let tick = 0; tick < 30; tick += 1) tickWorld(world);
    expect(world.hp[1]).toBe(startHp);
  });

  test("uses the launch hero penalty after resolving pierce and crush armor", () => {
    const normal = resolveDamage(definition.attack, UNIT_TYPES[TYPE_HOPLITE]!);
    const hero = resolveDamage(definition.attack, UNIT_TYPES[TYPE_JASON]!);
    expect(hero).toBeCloseTo(
      (50 * (1 - UNIT_TYPES[TYPE_JASON]!.armor[1]) + 20 * (1 - UNIT_TYPES[TYPE_JASON]!.armor[2])) *
        0.25,
      10,
    );
    expect(hero).toBeLessThan(normal);
  });

  test("projects the active stable target for source-to-target beam presentation", () => {
    const { world, target } = attackWorld();
    const snapshot = createSnapshot(4);
    tickWorld(world);
    writeSnapshot(world, snapshot, 0);

    expect(snapshot.actionCooldown[0]).toBe(60);
    expect(snapshot.beamTargetId[0]).toBe(target);
    expect(snapshot.beamTargetVisible[0]).toBe(1);
  });

  test("keeps target tracking, impact state, and damage deterministic", () => {
    const a = attackWorld().world;
    const b = attackWorld().world;
    for (let tick = 0; tick < 180; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
    expect(a.hp[1]).toBe(b.hp[1]);
  });
});
