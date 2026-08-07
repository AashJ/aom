import { TICK_HZ } from "../../../clock";
import { AGE_HEROIC, GOD_NEPHTHYS } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TEMPLE, TYPE_SCORPION_MAN } from "../../unit-type-ids";
import {
  AREA_DAMAGE_ENEMIES,
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_HERO,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_WORKER,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_SCORPION_MAN,
  key: "egyptian-scorpion-man",
  label: "Scorpion Man",
  culture: CULTURE_EGYPTIAN,
  classes: UNIT_CLASS_MYTH | UNIT_CLASS_INFANTRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
  maxHp: 500,
  lineOfSight: 16,
  movementSpeed: 5,
  armor: [0.5, 0.4, 0.8],
  attack: {
    kind: "melee",
    damage: [25, 0, 0],
    range: 1,
    aggroRange: 16,
    cooldownTicks: TICK_HZ,
    bonuses: [
      { target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 2 },
      {
        target: { kind: "classes", classes: UNIT_CLASS_HERO },
        multiplier: 0.8,
      },
    ],
    cycleVariants: [
      { actionTicks: 22, impactDelayTicks: 17 },
      { actionTicks: 26, impactDelayTicks: 20 },
    ],
  },
  specialAttack: {
    kind: "charged-area-poison",
    // Classic's launch poison deals 18 hack damage over fifteen seconds.
    // This stored per-second rate is integrated at the fixed 20 Hz sim tick.
    damage: [1.2, 0, 0],
    range: 1,
    radius: 3,
    falloff: "linear",
    damageRelations: AREA_DAMAGE_ENEMIES,
    bonuses: [],
    rechargeTicks: 12 * TICK_HZ,
    actionTicks: 22,
    impactDelayTicks: 11,
    validTargets: [
      {
        kind: "classes",
        classes: UNIT_CLASS_HUMAN,
        excludedClasses: UNIT_CLASS_WORKER,
      },
    ],
    poisonDurationTicks: 15 * TICK_HZ,
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.99,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 150,
  costGold: 0,
  costFavor: 25,
  buildTicks: 20 * TICK_HZ,
  populationCost: 4,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: GOD_NEPHTHYS,
  prerequisiteBuildings: [TYPE_EGYPTIAN_TEMPLE],
  trainedAt: [{ type: TYPE_EGYPTIAN_TEMPLE, commandSlot: 2 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
