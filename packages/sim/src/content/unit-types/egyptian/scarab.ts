import { TICK_HZ } from "../../../clock";
import { AGE_HEROIC, GOD_SEKHMET } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TEMPLE, TYPE_SCARAB } from "../../unit-type-ids";
import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HERO,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_SIEGE,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_SCARAB,
  key: "egyptian-scarab",
  label: "Scarab",
  culture: CULTURE_EGYPTIAN,
  classes:
    UNIT_CLASS_MYTH |
    UNIT_CLASS_SIEGE |
    UNIT_CLASS_CAVALRY |
    UNIT_CLASS_MILITARY |
    UNIT_CLASS_MELEE,
  maxHp: 670,
  lineOfSight: 16,
  movementSpeed: 3.2,
  armor: [0.3, 0.75, 0.8],
  attack: {
    kind: "melee",
    // The source stores per-second damage; the 1.5-second attack clip scales
    // each landed hit while preserving the Classic displayed damage rate.
    damage: [6, 0, 12],
    range: 0.1,
    aggroRange: 16,
    cooldownTicks: TICK_HZ,
    bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_BUILDING }, multiplier: 5 }],
    cycleVariants: [{ actionTicks: 30, impactDelayTicks: 13 }],
  },
  deathAreaAttack: {
    damage: [0, 30, 0],
    radius: 7.5,
    falloff: "constant",
    damageRelations: AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS,
    bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_HERO }, multiplier: 0.01 }],
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.99,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 200,
  costWood: 0,
  costGold: 0,
  costFavor: 20,
  buildTicks: 20 * TICK_HZ,
  populationCost: 5,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: GOD_SEKHMET,
  prerequisiteBuildings: [TYPE_EGYPTIAN_TEMPLE],
  trainedAt: [{ type: TYPE_EGYPTIAN_TEMPLE, commandSlot: 2 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
