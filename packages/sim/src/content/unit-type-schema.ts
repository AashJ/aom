export interface UnitTypeStats {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly culture: number;
  readonly classes: number;
  readonly maxHp: number;
  readonly lineOfSight: number;
  readonly movementSpeed: number;
  readonly workRange?: number;
  readonly armor: ArmorProfile;
  // Exactly one primary attack shape or none. The discriminant is authoritative:
  // combat never guesses delivery behavior from classes, range, or presentation.
  readonly attack: Attack | null;
  readonly isStatic: boolean;
  readonly resource: number;
  // Melee reach measures to the target's surface, not center.
  readonly bodyRadius: number;
  // Mirrors the authored CollidesWithProjectiles flag. Body radius alone does
  // not make resources or other explicitly excluded entities projectile-solid.
  readonly collidesWithProjectiles: boolean;
  // Tiles per side, square; 0 = no footprint.
  readonly footprint: number;
  readonly costFood: number;
  readonly costWood: number;
  readonly costGold: number;
  readonly costFavor: number;
  readonly buildTicks: number;
  readonly populationCost: number;
  readonly popBonus: number;
  // Distance along the building's forward (-Z) axis where trained units emerge.
  readonly trainExitOffset: number;
  readonly isDropsite: boolean;
  readonly requiredAge: number;
  readonly requiredGod: number;
  readonly prerequisiteBuildings: readonly number[];
  readonly trainedAt: readonly TypeCommandRelationship[];
  readonly builtBy: readonly TypeCommandRelationship[];
}

export type DamageProfile = readonly [hack: number, pierce: number, crush: number];
export type ArmorProfile = readonly [hack: number, pierce: number, crush: number];

interface AttackBase {
  readonly damage: DamageProfile;
  readonly range: number;
  readonly aggroRange: number;
  readonly cooldownTicks: number;
  readonly bonuses: readonly DamageBonus[];
}

export interface MeleeAttack extends AttackBase {
  readonly kind: "melee";
}

export interface ProjectileFlight {
  // Stable simulation/presentation identity. Projectile kinds are append-only.
  readonly type: number;
  readonly speed: number;
  readonly lifespanTicks: number;
  readonly collisionRadius: number;
}

export interface ProjectileAttack extends AttackBase {
  readonly kind: "projectile";
  // Ticks from attack-cycle start to the animation's release event.
  readonly launchDelayTicks: number;
  // Classic proto accuracy fields. Keep the source names visible so generated
  // unit definitions can be checked directly against hashed reference data.
  readonly accuracy: number;
  readonly accuracyReductionFactor: number;
  readonly aimBonus: number;
  readonly spreadFactor: number;
  readonly maxSpread: number;
  readonly trackRating: number;
  readonly unintentionalDamageMultiplier: number;
  readonly projectile: ProjectileFlight;
}

export type Attack = MeleeAttack | ProjectileAttack;

export interface DamageBonus {
  // Every bit must be present. Target classes and optional culture gates cover
  // Classic logical target sets without inventing a second attack shape.
  readonly requiredClasses: number;
  readonly requiredCulture?: number;
  readonly excludedCulture?: number;
  readonly multiplier: number;
}

export interface TypeCommandRelationship {
  readonly type: number;
  readonly commandSlot: number;
}

export const CULTURE_SHARED = 0;
export const CULTURE_GREEK = 1;
export const CULTURE_EGYPTIAN = 2;
export const CULTURE_NORSE = 3;

export const UNIT_CLASS_WORKER = 1 << 0;
export const UNIT_CLASS_HUMAN = 1 << 1;
export const UNIT_CLASS_INFANTRY = 1 << 2;
export const UNIT_CLASS_CAVALRY = 1 << 3;
export const UNIT_CLASS_MILITARY = 1 << 4;
export const UNIT_CLASS_MELEE = 1 << 5;
export const UNIT_CLASS_BUILDING = 1 << 6;
export const UNIT_CLASS_RESOURCE = 1 << 7;
export const UNIT_CLASS_TEMPLE = 1 << 8;
export const UNIT_CLASS_SIEGE = 1 << 9;
export const UNIT_CLASS_ARCHER = 1 << 10;
export const UNIT_CLASS_HERO = 1 << 11;
// Mirrors Classic's curated LogicalTypeNonGreekUnit membership. This is not
// derivable from culture: counter-infantry and civilian exceptions exist.
export const UNIT_CLASS_NON_GREEK_UNIT = 1 << 12;

export const DAMAGE_HACK = 0;
export const DAMAGE_PIERCE = 1;
export const DAMAGE_CRUSH = 2;
export const DAMAGE_CLASS_COUNT = 3;

// Fixed resource ids are shared by costs, carrying, stockpiles, snapshots, and UI.
export const FOOD = 0;
export const WOOD = 1;
export const GOLD = 2;
export const FAVOR = 3;
export const RESOURCE_COUNT = 4;

export const NO_UNIT_TYPE = 0xffff;
export const NO_PREREQUISITE_BUILDINGS: readonly number[] = Object.freeze([]);
export const NO_TYPE_RELATIONSHIPS: readonly TypeCommandRelationship[] = Object.freeze([]);
export const NO_ARMOR: ArmorProfile = Object.freeze([0, 0, 0]);
export const NO_DAMAGE: DamageProfile = Object.freeze([0, 0, 0]);
export const NO_DAMAGE_BONUSES: readonly DamageBonus[] = Object.freeze([]);
