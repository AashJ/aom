import {
  CULTURE_EGYPTIAN,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_CAVALRY,
  type Attack,
  type UnitTypeStats,
} from "../content/unit-type-schema";
import { cultureForMajorGod } from "../content/culture-types";
import {
  TYPE_EGYPTIAN_FARM,
  TYPE_EGYPTIAN_GATE,
  TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
  TYPE_EGYPTIAN_TOWER,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_EGYPTIAN_WALL_CONNECTOR,
  TYPE_EGYPTIAN_WALL_LONG,
  TYPE_EGYPTIAN_WALL_MEDIUM,
  TYPE_EGYPTIAN_WALL_SHORT,
  TYPE_GREEK_FARM,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_GATE,
  TYPE_GREEK_TOWER,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_WALL_CONNECTOR,
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_WALL_MEDIUM,
  TYPE_GREEK_WALL_SHORT,
} from "../content/unit-type-ids";
import { GOD_HADES } from "./progression";
import { resolveDamage, resolveDamageWithArmor, type DamageSource } from "./combat";
import { UNIT_TYPES } from "./types";
import {
  hasTechnology,
  RESEARCH_ARCHITECTS,
  RESEARCH_BALLISTA_TOWER,
  RESEARCH_BOILING_OIL,
  RESEARCH_CARRIER_PIGEONS,
  RESEARCH_CITADEL_WALL,
  RESEARCH_CRENELLATIONS,
  RESEARCH_FORTIFIED_TOWN_CENTER,
  RESEARCH_FORTIFIED_WALL,
  RESEARCH_GUARD_TOWER,
  RESEARCH_MASONS,
  RESEARCH_SIGNAL_FIRES,
  RESEARCH_STONE_WALL,
  RESEARCH_WATCH_TOWER,
} from "./technologies";
import {
  effectiveAttackDamageMultiplier,
  effectiveAttackRange,
  effectiveLineOfSight,
  effectiveMaxHp,
} from "./unit-age";
interface BuildingTechnologyState {
  readonly playerAge?: Uint8Array;
  readonly playerMajorGod?: Uint8Array;
  readonly playerResearch?: Uint8Array;
}

interface BuildingDamageState extends BuildingTechnologyState {
  readonly owner: Uint8Array;
  readonly unitType: Uint16Array;
}

export function playerHasTechnology(
  world: BuildingTechnologyState,
  playerId: number,
  researchId: number,
): boolean {
  if (
    world.playerResearch !== undefined &&
    hasTechnology(world.playerResearch, playerId, researchId)
  ) {
    return true;
  }
  return (
    researchId === RESEARCH_WATCH_TOWER &&
    world.playerMajorGod !== undefined &&
    cultureForMajorGod(world.playerMajorGod[playerId]!) === CULTURE_EGYPTIAN &&
    (world.playerAge?.[playerId] ?? 0) >= 1
  );
}

export function isTowerType(type: number): boolean {
  return type === TYPE_GREEK_TOWER || type === TYPE_EGYPTIAN_TOWER;
}

export function isWallOrGateType(type: number): boolean {
  return (
    type === TYPE_GREEK_WALL_CONNECTOR ||
    type === TYPE_GREEK_WALL_SHORT ||
    type === TYPE_GREEK_WALL_MEDIUM ||
    type === TYPE_GREEK_WALL_LONG ||
    type === TYPE_GREEK_GATE ||
    type === TYPE_EGYPTIAN_WALL_CONNECTOR ||
    type === TYPE_EGYPTIAN_WALL_SHORT ||
    type === TYPE_EGYPTIAN_WALL_MEDIUM ||
    type === TYPE_EGYPTIAN_WALL_LONG ||
    type === TYPE_EGYPTIAN_GATE
  );
}

export function isTownCenterType(type: number): boolean {
  return type === TYPE_GREEK_TOWN_CENTER || type === TYPE_EGYPTIAN_TOWN_CENTER;
}

export function isFortressType(type: number): boolean {
  return type === TYPE_GREEK_FORTRESS || type === TYPE_EGYPTIAN_MIGDOL_STRONGHOLD;
}

function towerTier(world: BuildingTechnologyState, playerId: number): number {
  if (playerHasTechnology(world, playerId, RESEARCH_BALLISTA_TOWER)) return 3;
  if (playerHasTechnology(world, playerId, RESEARCH_GUARD_TOWER)) return 2;
  if (playerHasTechnology(world, playerId, RESEARCH_WATCH_TOWER)) return 1;
  return 0;
}

function wallTier(world: BuildingTechnologyState, playerId: number): number {
  if (playerHasTechnology(world, playerId, RESEARCH_CITADEL_WALL)) return 3;
  if (playerHasTechnology(world, playerId, RESEARCH_FORTIFIED_WALL)) return 2;
  if (playerHasTechnology(world, playerId, RESEARCH_STONE_WALL)) return 1;
  return 0;
}

export function effectiveMaxHpForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
): number {
  let maximum = effectiveMaxHp(stats, world.playerAge?.[playerId] ?? 0);
  if ((stats.classes & UNIT_CLASS_BUILDING) === 0) return maximum;

  if (isTowerType(stats.id)) {
    const tier = towerTier(world, playerId);
    if (tier === 2) maximum *= 850 / 550;
    else if (tier === 3) maximum *= 1_150 / 550;
  } else if (isWallOrGateType(stats.id)) {
    maximum *= [1, 2, 3, 4][wallTier(world, playerId)]!;
    if (world.playerMajorGod?.[playerId] === GOD_HADES) maximum *= 1.25;
  } else if (
    isTownCenterType(stats.id) &&
    playerHasTechnology(world, playerId, RESEARCH_FORTIFIED_TOWN_CENTER)
  ) {
    maximum *= 3_500 / 2_400;
  }

  let structuralBonus = 0;
  if (playerHasTechnology(world, playerId, RESEARCH_MASONS)) structuralBonus += 0.15;
  if (playerHasTechnology(world, playerId, RESEARCH_ARCHITECTS)) structuralBonus += 0.15;
  return maximum * (1 + structuralBonus);
}

export function effectiveLineOfSightForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
): number {
  let sight = effectiveLineOfSight(stats, world.playerAge?.[playerId] ?? 0);
  if (
    (stats.classes & UNIT_CLASS_BUILDING) === 0 ||
    isWallOrGateType(stats.id) ||
    stats.id === TYPE_GREEK_FARM ||
    stats.id === TYPE_EGYPTIAN_FARM
  ) {
    return sight;
  }
  if (playerHasTechnology(world, playerId, RESEARCH_SIGNAL_FIRES)) sight += 6;
  if (playerHasTechnology(world, playerId, RESEARCH_CARRIER_PIGEONS)) sight += 6;
  return sight;
}

export function effectivePopBonusForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
): number {
  return (
    stats.popBonus +
    (isTownCenterType(stats.id) &&
    playerHasTechnology(world, playerId, RESEARCH_FORTIFIED_TOWN_CENTER)
      ? 5
      : 0)
  );
}

export function armorAdjustedDamage(
  world: BuildingDamageState,
  target: number,
  source: DamageSource,
  resolvedDamage: number,
): number {
  const targetStats = UNIT_TYPES[world.unitType[target]!]!;
  const playerId = world.owner[target]!;
  if ((targetStats.classes & UNIT_CLASS_BUILDING) === 0) return resolvedDamage;

  let crushArmorBonus = 0;
  if (playerHasTechnology(world, playerId, RESEARCH_MASONS)) crushArmorBonus += 0.05;
  if (playerHasTechnology(world, playerId, RESEARCH_ARCHITECTS)) crushArmorBonus += 0.05;
  if (crushArmorBonus === 0) return resolvedDamage;

  const baseDamage = resolveDamage(source, targetStats);
  if (baseDamage <= 0) return resolvedDamage;
  const adjustedDamage = resolveDamageWithArmor(source, targetStats, [
    targetStats.armor[0],
    targetStats.armor[1],
    Math.min(0.99, targetStats.armor[2] + crushArmorBonus),
  ]);
  return resolvedDamage * (adjustedDamage / baseDamage);
}

export function primaryAttackForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
): Attack | null {
  if (isTowerType(stats.id) && towerTier(world, playerId) === 0) return null;
  return stats.attack;
}

export function closeAttackForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
): Attack | undefined {
  if (
    (isTowerType(stats.id) || isFortressType(stats.id)) &&
    !playerHasTechnology(world, playerId, RESEARCH_BOILING_OIL)
  ) {
    return undefined;
  }
  return stats.closeAttack;
}

export function attackDamageMultiplierForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
): number {
  let multiplier = effectiveAttackDamageMultiplier(stats, world.playerAge?.[playerId] ?? 0);
  if (isTowerType(stats.id)) {
    const tier = towerTier(world, playerId);
    if (tier === 2) multiplier *= 17 / 10;
    else if (tier === 3) multiplier *= 22 / 10;
  }
  if (
    isTownCenterType(stats.id) &&
    playerHasTechnology(world, playerId, RESEARCH_FORTIFIED_TOWN_CENTER)
  ) {
    multiplier *= 1.5;
  }
  return multiplier;
}

export function attackRangeForPlayer(
  world: BuildingTechnologyState,
  playerId: number,
  stats: UnitTypeStats,
  attack: Attack,
): number {
  return (
    effectiveAttackRange(stats, attack, world.playerAge?.[playerId] ?? 0) +
    (isTownCenterType(stats.id) &&
    playerHasTechnology(world, playerId, RESEARCH_FORTIFIED_TOWN_CENTER)
      ? 2
      : 0)
  );
}

export function buildingProjectileTargetMultiplier(
  world: BuildingTechnologyState,
  playerId: number,
  sourceType: number,
  targetStats: UnitTypeStats,
): number {
  return isTowerType(sourceType) &&
    (targetStats.classes & UNIT_CLASS_CAVALRY) !== 0 &&
    playerHasTechnology(world, playerId, RESEARCH_CRENELLATIONS)
    ? 2
    : 1;
}
