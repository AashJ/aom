import { describe, expect, test } from "bun:test";
import type { ProjectileAttack, UnitTypeStats } from "../content/unit-type-schema";
import { TYPE_HOPLITE, TYPE_SPEARMAN } from "../content/unit-type-ids";
import { UNIT_TYPES } from "./types";
import { registerPlayer } from "./players";
import { createWorld, spawnUnit } from "./world";
import { hashWorld } from "../hash";
import { createSnapshot, writeProjectileSnapshot } from "../snapshot";
import {
  PROJECTILE_ARROW,
  createProjectileStore,
  queueProjectile,
  tickProjectileStore,
} from "./projectiles";

const projectileAttack: ProjectileAttack = {
  kind: "projectile",
  damage: [0, 10, 0],
  range: 15,
  aggroRange: 20,
  cooldownTicks: 20,
  bonuses: [],
  launchDelayTicks: 2,
  projectile: {
    type: PROJECTILE_ARROW,
    speed: 10,
    lifespanTicks: 40,
    collisionRadius: 0.1,
  },
};

function projectileWorld(attack = projectileAttack) {
  const world = createWorld(42);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const sourceId = spawnUnit(world, 100, 100, 0, 0, 0, TYPE_HOPLITE);
  const targetId = spawnUnit(world, 105, 100, 0, 0, 1, TYPE_SPEARMAN);
  const unitTypes: (UnitTypeStats | undefined)[] = [...UNIT_TYPES];
  unitTypes[TYPE_HOPLITE] = { ...UNIT_TYPES[TYPE_HOPLITE]!, attack };
  world.projectiles = createProjectileStore(8);
  return { world, unitTypes, sourceId, targetId };
}

function queueTestShot(
  state: ReturnType<typeof projectileWorld>,
  attack: ProjectileAttack = projectileAttack,
): void {
  queueProjectile(state.world.projectiles, {
    sourceId: state.sourceId,
    sourceType: TYPE_HOPLITE,
    owner: 0,
    targetId: state.targetId,
    attackTick: state.world.tick,
    attack,
  });
}

function applyDamage(
  world: ReturnType<typeof createWorld>,
  targetIndex: number,
  damage: number,
): void {
  world.hp[targetIndex] = Math.max(0, world.hp[targetIndex]! - damage);
}

describe("deterministic projectile lifecycle", () => {
  test("queues an animation-timed release and applies damage only at impact", () => {
    const state = projectileWorld();
    const initialHp = state.world.hp[1]!;
    queueTestShot(state);

    state.world.tick = 1;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.projectiles.impactTicks[0]).toBe(0xffff_ffff);

    state.world.tick = 2;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.projectiles.launchX[0]).toBe(100);
    expect(state.world.projectiles.impactX[0]).toBe(105);
    expect(state.world.projectiles.impactTicks[0]).toBe(12);
    expect(state.world.hp[1]).toBe(initialHp);

    state.world.tick = 11;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.hp[1]).toBe(initialHp);

    state.world.tick = 12;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.hp[1]).toBeLessThan(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("cancels a queued release when its target dies during the windup", () => {
    const state = projectileWorld();
    queueTestShot(state);
    state.world.hp[1] = 0;
    state.world.tick = 2;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);

    expect(state.world.projectiles.count).toBe(0);
  });

  test("a target can dodge the fixed impact point during flight", () => {
    const state = projectileWorld();
    queueTestShot(state);
    state.world.tick = 2;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    const impactTick = state.world.projectiles.impactTicks[0]!;
    const initialHp = state.world.hp[1]!;

    state.world.posZ[1] = 104;
    state.world.tick = impactTick;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.hp[1]).toBe(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("projects only released projectiles into interpolable render state", () => {
    const state = projectileWorld();
    const snapshot = createSnapshot(2, 4);
    queueTestShot(state);
    writeProjectileSnapshot(state.world, snapshot, 0, state.unitTypes);
    expect(snapshot.projectileCount).toBe(0);

    state.world.tick = 2;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    writeProjectileSnapshot(state.world, snapshot, 0, state.unitTypes);
    expect(snapshot.projectileCount).toBe(1);
    expect(snapshot.projectileIds[0]).toBe(1);
    expect(snapshot.projectileTypes[0]).toBe(PROJECTILE_ARROW);
    expect(snapshot.projectilePosX[0]).toBe(100);
    expect(snapshot.projectileFacingX[0]).toBe(1);
    expect(snapshot.projectileVisible[0]).toBe(1);

    writeProjectileSnapshot(state.world, snapshot, 1, state.unitTypes);
    expect(snapshot.projectileVisible[0]).toBe(0);

    state.world.tick = 7;
    writeProjectileSnapshot(state.world, snapshot, 0, state.unitTypes);
    expect(snapshot.projectilePosX[0]).toBe(102.5);
    expect(snapshot.projectileProgress[0]).toBe(0.5);
  });

  test("expires deterministically when flight would outlive the projectile", () => {
    const attack = {
      ...projectileAttack,
      projectile: { ...projectileAttack.projectile, speed: 1, lifespanTicks: 5 },
    };
    const state = projectileWorld(attack);
    queueTestShot(state, attack);
    state.world.tick = 2;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.projectiles.expiresBeforeImpact[0]).toBe(1);
    expect(state.world.projectiles.impactTicks[0]).toBe(7);

    const initialHp = state.world.hp[1]!;
    state.world.tick = 7;
    tickProjectileStore(state.world, state.world.projectiles, state.unitTypes, applyDamage);
    expect(state.world.hp[1]).toBe(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("hashes queued and in-flight projectile state", () => {
    const a = projectileWorld();
    const b = projectileWorld();
    queueTestShot(a);
    queueTestShot(b);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));

    b.world.projectiles.launchTicks[0] = b.world.projectiles.launchTicks[0]! + 1;
    expect(hashWorld(a.world)).not.toBe(hashWorld(b.world));
    b.world.projectiles.launchTicks[0] = b.world.projectiles.launchTicks[0]! - 1;

    a.world.tick = 2;
    tickProjectileStore(a.world, a.world.projectiles, a.unitTypes, applyDamage);
    expect(hashWorld(a.world)).not.toBe(hashWorld(b.world));
  });
});
