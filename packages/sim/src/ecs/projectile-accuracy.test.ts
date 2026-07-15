import { describe, expect, test } from "bun:test";
import type { ProjectileAttack } from "../content/unit-type-schema";
import {
  classicProjectileHits,
  classicProjectileHitScore,
  classicProjectileLeadSeconds,
  classicProjectileSpread,
} from "./projectile-accuracy";
import { PROJECTILE_ARROW } from "./projectiles";

const classicArrow: ProjectileAttack = {
  kind: "projectile",
  damage: [0, 6.5, 0],
  range: 15,
  aggroRange: 20,
  cooldownTicks: 30,
  bonuses: [],
  launchDelayTicks: 5,
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

describe("Classic projectile accuracy", () => {
  test("combines base accuracy, range reduction, and consecutive-shot aim", () => {
    expect(classicProjectileHitScore(classicArrow, 15, 0)).toBe(57.5);
    expect(classicProjectileHitScore(classicArrow, 15, 2)).toBe(87.5);
  });

  test("uses Classic's guaranteed bounds and inclusive integer roll", () => {
    expect(classicProjectileHits(0, 0)).toBe(false);
    expect(classicProjectileHits(57.5, 57)).toBe(true);
    expect(classicProjectileHits(57.5, 58)).toBe(false);
    expect(classicProjectileHits(101, 100)).toBe(true);
  });

  test("caps square miss spread and shrinks it with accumulated aim", () => {
    expect(classicProjectileSpread(classicArrow, 16, 0)).toBe(4);
    expect(classicProjectileSpread(classicArrow, 40, 0)).toBe(5);
    expect(classicProjectileSpread(classicArrow, 16, 2)).toBe(2.8);
  });

  test("leads only targets moving below the authored track rating", () => {
    expect(classicProjectileLeadSeconds(0, 0, 10, 0, 0.5, 0, 10, 5)).toBe(1);
    expect(classicProjectileLeadSeconds(0, 0, 10, 0, 5, 0, 10, 5)).toBe(0);
  });
});
