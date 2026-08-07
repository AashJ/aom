import { AGE_MYTHIC, GOD_THOTH } from "../../../ecs/progression";
import { TYPE_PHOENIX_EGG } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_PHOENIX_EGG,
  key: "egyptian-phoenix-egg",
  label: "Phoenix Egg",
  culture: CULTURE_EGYPTIAN,
  // ForceBuildingData makes the Egg a training producer despite its zero
  // footprint; MythUnit and Military remain its source-authored target classes.
  classes: UNIT_CLASS_MYTH | UNIT_CLASS_MILITARY | UNIT_CLASS_BUILDING,
  maxHp: 300,
  lineOfSight: 4,
  movementSpeed: 0,
  armor: [0.15, 0.55, 0.99],
  attack: null,
  isStatic: true,
  resource: -1,
  bodyRadius: 0.99,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 0,
  costFavor: 0,
  buildTicks: 0,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 0,
  trainingSite: {
    consumeOnCompletion: true,
    substitutesForPrerequisites: true,
  },
  isDropsite: false,
  requiredAge: AGE_MYTHIC,
  requiredGod: GOD_THOTH,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: NO_TYPE_RELATIONSHIPS,
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
