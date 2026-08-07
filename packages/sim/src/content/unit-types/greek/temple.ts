import { AGE_ARCHAIC, NO_GOD } from "../../../ecs/progression";
import { poseidonMilitiaDeathSpawn } from "../../death-spawns";
import { TYPE_GREEK_TEMPLE, TYPE_GREEK_VILLAGER } from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_TEMPLE,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_GREEK_TEMPLE,
  key: "greek-temple",
  label: "Temple",
  culture: CULTURE_GREEK,
  classes: UNIT_CLASS_BUILDING | UNIT_CLASS_TEMPLE,
  maxHp: 1200,
  lineOfSight: 9,
  movementSpeed: 0,
  armor: [0.3, 0.96, 0.05],
  attack: null,
  deathSpawn: poseidonMilitiaDeathSpawn(4),
  isStatic: true,
  resource: -1,
  bodyRadius: 5,
  collidesWithProjectiles: true,
  footprint: 5,
  costFood: 0,
  costWood: 100,
  costGold: 100,
  costFavor: 0,
  buildTicks: 800,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_ARCHAIC,
  requiredGod: NO_GOD,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: NO_TYPE_RELATIONSHIPS,
  builtBy: [{ type: TYPE_GREEK_VILLAGER, commandSlot: 2 }],
} as const satisfies UnitTypeStats;
