import { AGE_MYTHIC, GOD_ZEUS } from "../../../ecs/progression";
import {
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_MYRMIDON,
} from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_MYRMIDON,
  key: "greek-myrmidon",
  label: "Myrmidon",
  culture: CULTURE_GREEK,
  classes: UNIT_CLASS_HUMAN | UNIT_CLASS_INFANTRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
  maxHp: 110,
  lineOfSight: 16,
  movementSpeed: 4,
  armor: [0.45, 0.2, 0.99],
  attack: {
    kind: "melee",
    damage: [10, 0, 0],
    range: 0.3,
    aggroRange: 16,
    cooldownTicks: 30,
    bonuses: [
      {
        target: { kind: "classes", classes: UNIT_CLASS_NON_GREEK_UNIT },
        multiplier: 1.5,
      },
    ],
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.49,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 70,
  costWood: 0,
  costGold: 50,
  costFavor: 0,
  buildTicks: 14 * 20,
  populationCost: 2,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_MYTHIC,
  requiredGod: GOD_ZEUS,
  prerequisiteBuildings: [TYPE_GREEK_FORTRESS],
  trainedAt: [
    { type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 2 },
    { type: TYPE_GREEK_FORTRESS, commandSlot: 6 },
  ],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
