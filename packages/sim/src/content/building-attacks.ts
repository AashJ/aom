import { TICK_HZ } from "../clock";
import { PROJECTILE_ARROW } from "../ecs/projectiles";
import {
  NO_DAMAGE_BONUSES,
  UNIT_CLASS_AIR,
  UNIT_CLASS_SHIP,
  type DamageBonus,
  type ProjectileAttack,
} from "./unit-type-schema";

const SHIP_BONUS = {
  target: { kind: "classes", classes: UNIT_CLASS_SHIP },
  multiplier: 5,
} as const satisfies DamageBonus;
const AIR_BONUS = {
  target: { kind: "classes", classes: UNIT_CLASS_AIR },
  multiplier: 3,
} as const satisfies DamageBonus;

export interface BuildingArrowAttackOptions {
  readonly damage: number;
  readonly range: number;
  readonly projectileCount: number;
  readonly trackRating: number;
  readonly minimumRange?: number;
  readonly bonusShips?: boolean;
  readonly bonusAir?: boolean;
}

export function buildingArrowAttack(options: BuildingArrowAttackOptions): ProjectileAttack {
  const bonuses: DamageBonus[] = [];
  if (options.bonusShips === true) bonuses.push(SHIP_BONUS);
  if (options.bonusAir === true) bonuses.push(AIR_BONUS);

  return {
    kind: "projectile",
    damage: [0, options.damage, 0],
    range: options.range,
    minimumRange: options.minimumRange,
    aggroRange: options.range,
    cooldownTicks: TICK_HZ,
    bonuses: bonuses.length === 0 ? NO_DAMAGE_BONUSES : bonuses,
    launchDelayTicks: 0,
    accuracy: 0.9,
    accuracyReductionFactor: 1.5,
    aimBonus: 15,
    spreadFactor: 0.1,
    maxSpread: 5,
    trackRating: options.trackRating,
    unintentionalDamageMultiplier: 0.5,
    projectileCount: options.projectileCount,
    projectile: {
      type: PROJECTILE_ARROW,
      speed: 30,
      lifespanTicks: 2 * TICK_HZ,
      collisionRadius: 0.1,
    },
  };
}
