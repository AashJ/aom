import { AGE_CLASSICAL, NO_GOD } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_BARRACKS, TYPE_SPEARMAN } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
  UNIT_CLASS_SIEGE,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_SPEARMAN,
  key: "egyptian-spearman",
  label: "Spearman",
  culture: CULTURE_EGYPTIAN,
  classes:
    UNIT_CLASS_HUMAN |
    UNIT_CLASS_INFANTRY |
    UNIT_CLASS_MILITARY |
    UNIT_CLASS_MELEE |
    UNIT_CLASS_NON_GREEK_UNIT,
  maxHp: 70,
  lineOfSight: 16,
  movementSpeed: 5,
  armor: [0.4, 0.2, 0.99],
  attack: {
    kind: "melee",
    damage: [7, 0, 0],
    range: 0.3,
    aggroRange: 16,
    cooldownTicks: 30,
    bonuses: [
      { target: { kind: "classes", classes: UNIT_CLASS_CAVALRY }, multiplier: 1.1 },
      { target: { kind: "classes", classes: UNIT_CLASS_SIEGE }, multiplier: 2 },
    ],
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.49,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 50,
  costWood: 0,
  costGold: 20,
  costFavor: 0,
  buildTicks: 9 * 20,
  populationCost: 2,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_CLASSICAL,
  requiredGod: NO_GOD,
  prerequisiteBuildings: [TYPE_EGYPTIAN_BARRACKS],
  trainedAt: [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 0 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
