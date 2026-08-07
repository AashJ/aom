import { TICK_HZ } from "../../../clock";
import { AGE_ARCHAIC, NO_GOD } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TOWN_CENTER, TYPE_MERCENARY } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_DAMAGE_BONUSES,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_MERCENARY,
  key: "egyptian-mercenary",
  label: "Mercenary",
  culture: CULTURE_EGYPTIAN,
  classes:
    UNIT_CLASS_HUMAN |
    UNIT_CLASS_INFANTRY |
    UNIT_CLASS_MILITARY |
    UNIT_CLASS_MELEE |
    UNIT_CLASS_NON_GREEK_UNIT,
  maxHp: 85,
  lineOfSight: 20,
  movementSpeed: 4.3,
  armor: [0.45, 0.3, 0.99],
  attack: {
    kind: "melee",
    damage: [8, 0, 0],
    range: 0.3,
    aggroRange: 20,
    cooldownTicks: TICK_HZ,
    bonuses: NO_DAMAGE_BONUSES,
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.49,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 90,
  costFavor: 0,
  buildTicks: TICK_HZ,
  lifespanTicks: 45 * TICK_HZ,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_ARCHAIC,
  requiredGod: NO_GOD,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: [{ type: TYPE_EGYPTIAN_TOWN_CENTER, commandSlot: 2 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
