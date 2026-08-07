import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { NO_PROJECTILE_TICK, PROJECTILE_WADJET_SPIT } from "../../../ecs/projectiles";
import { MODE_PRAYING, createWorld, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { UNIT_TYPES } from "../../generated/unit-types";
import { GATE_C_MYTH_UNIT_REFERENCES } from "../../unit-references/gate-c-myth";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_JASON, TYPE_MINOTAUR, TYPE_WADJET } from "../../unit-type-ids";
import { definition } from "./wadjet";

function wadjetWorld() {
  const world = createWorld(146);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const wadjet = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_WADJET);
  const target = spawnUnit(world, 30, 20, 0, 0, 1, TYPE_HOPLITE);
  world.mode[1] = MODE_PRAYING;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [wadjet],
    targetId: target,
  });
  return { world, wadjet, target };
}

describe("Egyptian Wadjet unit pack", () => {
  test("matches the integration-owned Classic reference", () => {
    const reference = GATE_C_MYTH_UNIT_REFERENCES.find(
      (candidate) => candidate.key === "egyptian-wadjet",
    )!;
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("pins Classic balance, projectile timing, and persistent regeneration", () => {
    expect(definition).toMatchObject({
      maxHp: 240,
      lineOfSight: 20,
      movementSpeed: 3.8,
      armor: [0.2, 0.3, 0.8],
      costWood: 150,
      costFavor: 15,
      buildTicks: 340,
      populationCost: 3,
      regenerationPerSecond: 1,
      attack: {
        damage: [0, 16, 0],
        range: 18,
        launchDelayTicks: 12,
        projectile: { type: PROJECTILE_WADJET_SPIT, speed: 30, lifespanTicks: 40 },
      },
    });
  });

  test("restores exactly one hit point per second without interrupting orders", () => {
    const { world } = wadjetWorld();
    world.hp[0] = 100;
    for (let tick = 0; tick < 20; tick += 1) tickWorld(world);

    expect(world.hp[0]).toBeCloseTo(101, 10);
    expect(world.projectiles.nextId).toBeGreaterThan(1);
  });

  test("releases perfect-accuracy venom on the source-authored animation tick", () => {
    const { world } = wadjetWorld();
    tickWorld(world);

    expect(world.projectiles.count).toBe(1);
    expect(world.projectiles.sourceTypes[0]).toBe(TYPE_WADJET);
    expect(world.projectiles.launchTicks[0]).toBe(12);
    expect(world.projectiles.impactTicks[0]).toBe(NO_PROJECTILE_TICK);
    while (world.tick < 12) tickWorld(world);
    tickWorld(world);

    expect(world.projectiles.impactTicks[0]).not.toBe(NO_PROJECTILE_TICK);
  });

  test("retains the Classic myth and hero attack multipliers", () => {
    const ordinary = { ...UNIT_TYPES[TYPE_HOPLITE]!, classes: 0 };
    const hopliteDamage = resolveAttackDamage(definition.attack, ordinary);
    const mythDamage = resolveAttackDamage(definition.attack, {
      ...ordinary,
      classes: UNIT_TYPES[TYPE_MINOTAUR]!.classes,
    });
    const heroDamage = resolveAttackDamage(definition.attack, {
      ...ordinary,
      classes: UNIT_TYPES[TYPE_JASON]!.classes,
    });

    expect(mythDamage).toBeCloseTo(hopliteDamage * 3, 10);
    expect(heroDamage).toBeCloseTo(hopliteDamage * 0.25, 10);
  });

  test("keeps regeneration and projectile combat deterministic", () => {
    const a = wadjetWorld().world;
    const b = wadjetWorld().world;
    a.hp[0] = b.hp[0] = 120;
    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
