import { describe, expect, test } from "bun:test";
import type { ProjectileAttack, UnitTypeStats } from "../content/unit-type-schema";
import { TYPE_HOPLITE, TYPE_SPEARMAN } from "../content/unit-type-ids";
import { UNIT_TYPES } from "./types";
import { registerPlayer } from "./players";
import { rebuildUnitSpatialGrid } from "./spatial-grid";
import { createWorld, NEUTRAL_OWNER, spawnUnit } from "./world";
import { hashWorld } from "../hash";
import { createSnapshot, writeProjectileSnapshot } from "../snapshot";
import { NO_TARGET } from "./id";
import {
  PROJECTILE_ARROW,
  beginProjectileAttack,
  createProjectileStore,
  tickProjectileStore,
} from "./projectiles";
import { maximumProjectileBodyRadius } from "./unit-catalog-bounds";

const projectileAttack: ProjectileAttack = {
  kind: "projectile",
  damage: [0, 10, 0],
  range: 15,
  aggroRange: 20,
  cooldownTicks: 20,
  bonuses: [],
  launchDelayTicks: 2,
  accuracy: 0.8,
  accuracyReductionFactor: 1.5,
  aimBonus: 15,
  spreadFactor: 0.25,
  maxSpread: 5,
  trackRating: 5,
  unintentionalDamageMultiplier: 0.3,
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
  const maxProjectileBodyRadius = maximumProjectileBodyRadius(unitTypes);
  return { world, unitTypes, sourceId, targetId, maxProjectileBodyRadius };
}

function queueTestShot(state: ReturnType<typeof projectileWorld>, priorShots = 2): void {
  state.world.attackAimTarget[0] = state.targetId;
  state.world.attackAimShots[0] = priorShots;
  beginProjectileAttack(state.world, 0, 1, state.unitTypes);
}

function applyDamage(
  world: ReturnType<typeof createWorld>,
  targetIndex: number,
  damage: number,
): void {
  world.hp[targetIndex] = Math.max(0, world.hp[targetIndex]! - damage);
}

function advanceProjectilesTo(state: ReturnType<typeof projectileWorld>, targetTick: number): void {
  if (targetTick < state.world.tick) {
    throw new RangeError("Projectile tests cannot move simulation time backward.");
  }
  while (state.world.tick < targetTick) {
    state.world.tick += 1;
    rebuildUnitSpatialGrid(state.world);
    tickProjectileStore(
      state.world,
      state.world.projectiles,
      state.unitTypes,
      state.maxProjectileBodyRadius,
      applyDamage,
    );
  }
}

describe("deterministic projectile lifecycle", () => {
  test("queues only the canonical projectile attack owned by the source type", () => {
    const state = projectileWorld();
    state.unitTypes[TYPE_HOPLITE] = UNIT_TYPES[TYPE_HOPLITE];

    expect(() => queueTestShot(state)).toThrow(
      "Projectile source type has no canonical projectile attack.",
    );
    expect(state.world.projectiles.count).toBe(0);
    expect(state.world.projectiles.nextId).toBe(1);
  });

  test("derives queued identity, ownership, aim, and cooldown from the source unit", () => {
    const state = projectileWorld();
    queueTestShot(state, 2);

    expect(state.world.projectiles.sourceIds[0]).toBe(state.sourceId);
    expect(state.world.projectiles.sourceTypes[0]).toBe(TYPE_HOPLITE);
    expect(state.world.projectiles.owners[0]).toBe(0);
    expect(state.world.projectiles.targetIds[0]).toBe(state.targetId);
    expect(state.world.projectiles.priorShots[0]).toBe(2);
    expect(state.world.attackAimTarget[0]).toBe(state.targetId);
    expect(state.world.attackAimShots[0]).toBe(3);
    expect(state.world.attackCooldown[0]).toBe(projectileAttack.cooldownTicks);
  });

  test("rejects dead participants without partially advancing the attack cycle", () => {
    const state = projectileWorld();
    state.world.hp[1] = 0;

    expect(() => beginProjectileAttack(state.world, 0, 1, state.unitTypes)).toThrow(
      "Projectile attack indices must identify live dense units.",
    );
    expect(state.world.projectiles.count).toBe(0);
    expect(state.world.projectiles.nextId).toBe(1);
    expect(state.world.attackAimTarget[0]).toBe(NO_TARGET);
    expect(state.world.attackAimShots[0]).toBe(0);
    expect(state.world.attackCooldown[0]).toBe(0);
  });

  test("queues an animation-timed release and damages only when flight reaches the body", () => {
    const state = projectileWorld();
    const initialHp = state.world.hp[1]!;
    queueTestShot(state);

    advanceProjectilesTo(state, 1);
    expect(state.world.projectiles.impactTicks[0]).toBe(0xffff_ffff);

    advanceProjectilesTo(state, 2);
    expect(state.world.projectiles.launchX[0]).toBe(100);
    expect(state.world.projectiles.impactX[0]).toBe(105);
    expect(state.world.projectiles.impactTicks[0]).toBe(12);
    expect(state.world.hp[1]).toBe(initialHp);

    advanceProjectilesTo(state, 10);
    expect(state.world.hp[1]).toBe(initialHp);

    advanceProjectilesTo(state, 11);
    expect(state.world.hp[1]).toBeLessThan(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("cancels a queued release when its target dies during the windup", () => {
    const state = projectileWorld();
    queueTestShot(state);
    state.world.hp[1] = 0;
    advanceProjectilesTo(state, 2);

    expect(state.world.projectiles.count).toBe(0);
  });

  test("a target can dodge the fixed impact point during flight", () => {
    const state = projectileWorld();
    queueTestShot(state);
    advanceProjectilesTo(state, 2);
    const impactTick = state.world.projectiles.impactTicks[0]!;
    const initialHp = state.world.hp[1]!;

    state.world.posZ[1] = 104;
    advanceProjectilesTo(state, impactTick);
    expect(state.world.hp[1]).toBe(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("captures Classic tracking lead once at release", () => {
    const state = projectileWorld();
    state.world.velX[1] = 1;
    queueTestShot(state);
    advanceProjectilesTo(state, 2);

    expect(state.world.projectiles.impactX[0]).toBe(105.5);
    expect(state.world.projectiles.impactZ[0]).toBe(100);
  });

  test("samples a deterministic square miss point from the shared RNG", () => {
    const alwaysMiss = { ...projectileAttack, accuracy: 0 };
    const a = projectileWorld(alwaysMiss);
    const b = projectileWorld(alwaysMiss);
    queueTestShot(a, 0);
    queueTestShot(b, 0);
    advanceProjectilesTo(a, 2);
    advanceProjectilesTo(b, 2);

    expect(a.world.projectiles.impactX[0]).toBe(b.world.projectiles.impactX[0]);
    expect(a.world.projectiles.impactZ[0]).toBe(b.world.projectiles.impactZ[0]);
    expect(a.world.projectiles.impactX[0] !== 105 || a.world.projectiles.impactZ[0] !== 100).toBe(
      true,
    );
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
  });

  test("sweeps the intended body between ticks instead of tunneling past it", () => {
    const attack = {
      ...projectileAttack,
      projectile: { ...projectileAttack.projectile, speed: 100 },
    };
    const state = projectileWorld(attack);
    queueTestShot(state);
    advanceProjectilesTo(state, 2);
    const initialHp = state.world.hp[1]!;

    // The shot was aimed at x=105. Moving back onto its swept segment must be
    // a physical hit even though the target no longer overlaps that aim point.
    state.world.posX[1] = 102;
    advanceProjectilesTo(state, 3);

    expect(state.world.hp[1]).toBeLessThan(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("honors the authored projectile-collision flag on the intended body", () => {
    const state = projectileWorld();
    state.unitTypes[TYPE_SPEARMAN] = {
      ...state.unitTypes[TYPE_SPEARMAN]!,
      collidesWithProjectiles: false,
    };
    queueTestShot(state);
    advanceProjectilesTo(state, 2);
    const initialHp = state.world.hp[1]!;

    advanceProjectilesTo(state, state.world.projectiles.impactTicks[0]!);

    expect(state.world.hp[1]).toBe(initialHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("hits the earliest unintended hostile body for Classic reduced damage", () => {
    const state = projectileWorld();
    spawnUnit(state.world, 102, 100, 0, 0, 1, TYPE_SPEARMAN);
    const intendedHp = state.world.hp[1]!;
    const interveningHp = state.world.hp[2]!;
    queueTestShot(state);

    advanceProjectilesTo(state, 12);

    expect(state.world.hp[1]).toBe(intendedHp);
    expect(state.world.hp[2]).toBeLessThan(interveningHp);
    expect(interveningHp - state.world.hp[2]!).toBeLessThan(10);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("passes through same-owner bodies before hitting the intended enemy", () => {
    const state = projectileWorld();
    spawnUnit(state.world, 102, 100, 0, 0, 0, TYPE_SPEARMAN);
    const intendedHp = state.world.hp[1]!;
    const friendlyHp = state.world.hp[2]!;
    queueTestShot(state);

    advanceProjectilesTo(state, 12);

    expect(state.world.hp[1]).toBeLessThan(intendedHp);
    expect(state.world.hp[2]).toBe(friendlyHp);
    expect(state.world.projectiles.count).toBe(0);
  });

  test("allows an authored neutral body to obstruct the path", () => {
    const state = projectileWorld();
    spawnUnit(state.world, 102, 100, 0, 0, NEUTRAL_OWNER, TYPE_SPEARMAN);
    const intendedHp = state.world.hp[1]!;
    const neutralHp = state.world.hp[2]!;
    queueTestShot(state);

    advanceProjectilesTo(state, 12);

    expect(state.world.hp[1]).toBe(intendedHp);
    expect(state.world.hp[2]).toBeLessThan(neutralHp);
  });

  test("projects only released projectiles into interpolable render state", () => {
    const state = projectileWorld();
    const snapshot = createSnapshot(2, 4);
    queueTestShot(state);
    writeProjectileSnapshot(state.world, snapshot, 0, state.unitTypes);
    expect(snapshot.projectileCount).toBe(0);

    advanceProjectilesTo(state, 2);
    writeProjectileSnapshot(state.world, snapshot, 0, state.unitTypes);
    expect(snapshot.projectileCount).toBe(1);
    expect(snapshot.projectileIds[0]).toBe(1);
    expect(snapshot.projectileTypes[0]).toBe(PROJECTILE_ARROW);
    expect(snapshot.projectilePosX[0]).toBe(100);
    expect(snapshot.projectileFacingX[0]).toBe(1);
    expect(snapshot.projectileVisible[0]).toBe(1);

    writeProjectileSnapshot(state.world, snapshot, 1, state.unitTypes);
    expect(snapshot.projectileVisible[0]).toBe(0);

    advanceProjectilesTo(state, 7);
    writeProjectileSnapshot(state.world, snapshot, 0, state.unitTypes);
    expect(snapshot.projectilePosX[0]).toBe(102.5);
    expect(snapshot.projectileProgress[0]).toBe(0.5);
  });

  test("expires deterministically when flight would outlive the projectile", () => {
    const attack = {
      ...projectileAttack,
      projectile: {
        ...projectileAttack.projectile,
        speed: 1,
        lifespanTicks: 5,
      },
    };
    const state = projectileWorld(attack);
    queueTestShot(state);
    advanceProjectilesTo(state, 2);
    expect(state.world.projectiles.expiresBeforeImpact[0]).toBe(1);
    expect(state.world.projectiles.impactTicks[0]).toBe(7);

    const initialHp = state.world.hp[1]!;
    advanceProjectilesTo(state, 7);
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
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));

    advanceProjectilesTo(a, 2);
    expect(hashWorld(a.world)).not.toBe(hashWorld(b.world));

    const beforeAim = hashWorld(b.world);
    b.world.attackAimTarget[0] = b.targetId;
    b.world.attackAimShots[0] = 2;
    expect(hashWorld(b.world)).not.toBe(beforeAim);

    const beforeRng = hashWorld(b.world);
    b.world.rng.state ^= 1n;
    expect(hashWorld(b.world)).not.toBe(beforeRng);
  });
});
