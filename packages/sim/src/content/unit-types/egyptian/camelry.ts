import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { TYPE_CAMELRY, TYPE_EGYPTIAN_MIGDOL_STRONGHOLD } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_CAMELRY,
  key: "egyptian-camelry",
  label: "Camelry",
  culture: CULTURE_EGYPTIAN,
  classes:
    UNIT_CLASS_HUMAN |
    UNIT_CLASS_CAVALRY |
    UNIT_CLASS_MILITARY |
    UNIT_CLASS_MELEE |
    UNIT_CLASS_NON_GREEK_UNIT,
  maxHp: 125,
  lineOfSight: 16,
  movementSpeed: 6,
  armor: [0.15, 0.3, 0.99],
  attack: {
    kind: "melee",
    damage: [8, 0, 0],
    range: 0.3,
    aggroRange: 16,
    cooldownTicks: 30,
    bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_CAVALRY }, multiplier: 1.75 }],
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.7,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 50,
  costWood: 0,
  costGold: 70,
  costFavor: 0,
  buildTicks: 9 * 20,
  populationCost: 3,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: NO_GOD,
  prerequisiteBuildings: [TYPE_EGYPTIAN_MIGDOL_STRONGHOLD],
  trainedAt: [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 1 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
