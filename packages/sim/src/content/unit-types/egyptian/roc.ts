import { TICK_HZ } from "../../../clock";
import { AGE_HEROIC, GOD_HATHOR } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TEMPLE, TYPE_ROC } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  MOVEMENT_DOMAIN_AIR,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_AIR,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_RELIC,
  UNIT_CLASS_SHIP,
  UNIT_CLASS_TITAN,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_ROC,
  key: "egyptian-roc",
  label: "Roc",
  culture: CULTURE_EGYPTIAN,
  classes: UNIT_CLASS_MYTH | UNIT_CLASS_MILITARY | UNIT_CLASS_AIR,
  maxHp: 350,
  lineOfSight: 20,
  movementSpeed: 5.3,
  movementDomain: MOVEMENT_DOMAIN_AIR,
  armor: [0.4, 0.25, 0.8],
  attack: null,
  garrison: {
    capacity: 15,
    enterRange: 4,
    validOccupants: [
      {
        kind: "classes",
        classes: 0,
        excludedClasses:
          UNIT_CLASS_BUILDING |
          UNIT_CLASS_RELIC |
          UNIT_CLASS_SHIP |
          UNIT_CLASS_AIR |
          UNIT_CLASS_TITAN,
      },
    ],
    attackMultiplierPerOccupant: 0,
    ejectOnDeath: false,
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.99,
  collidesWithUnits: false,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 150,
  costFavor: 15,
  buildTicks: 14 * TICK_HZ,
  populationCost: 3,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: GOD_HATHOR,
  prerequisiteBuildings: [TYPE_EGYPTIAN_TEMPLE],
  trainedAt: [{ type: TYPE_EGYPTIAN_TEMPLE, commandSlot: 3 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
