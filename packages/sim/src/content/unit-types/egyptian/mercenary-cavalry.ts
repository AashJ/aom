import { TICK_HZ } from "../../../clock";
import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TOWN_CENTER, TYPE_MERCENARY_CAVALRY } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_DAMAGE_BONUSES,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_MERCENARY_CAVALRY,
  key: "egyptian-mercenary-cavalry",
  label: "Mercenary Cavalry",
  culture: CULTURE_EGYPTIAN,
  classes:
    UNIT_CLASS_HUMAN |
    UNIT_CLASS_CAVALRY |
    UNIT_CLASS_MILITARY |
    UNIT_CLASS_MELEE |
    UNIT_CLASS_NON_GREEK_UNIT,
  maxHp: 190,
  lineOfSight: 22,
  movementSpeed: 5.3,
  armor: [0.6, 0.7, 0.99],
  attack: {
    kind: "melee",
    damage: [8, 0, 0],
    range: 0.3,
    aggroRange: 22,
    cooldownTicks: TICK_HZ,
    bonuses: NO_DAMAGE_BONUSES,
    cycleVariants: [
      { actionTicks: 20, impactDelayTicks: 10 },
      { actionTicks: 24, impactDelayTicks: 17 },
      { actionTicks: 17, impactDelayTicks: 11 },
    ],
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.7,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 120,
  costFavor: 0,
  buildTicks: 3 * TICK_HZ,
  lifespanTicks: 45 * TICK_HZ,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: NO_GOD,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: [{ type: TYPE_EGYPTIAN_TOWN_CENTER, commandSlot: 3 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
