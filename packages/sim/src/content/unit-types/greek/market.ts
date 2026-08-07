import { AGE_CLASSICAL, NO_GOD } from "../../../ecs/progression";
import { poseidonMilitiaDeathSpawn } from "../../death-spawns";
import { TYPE_GREEK_MARKET, TYPE_GREEK_VILLAGER } from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_GREEK_MARKET,
  key: "greek-market",
  label: "Market",
  culture: CULTURE_GREEK,
  classes: UNIT_CLASS_BUILDING,
  maxHp: 1200,
  lineOfSight: 9,
  movementSpeed: 0,
  armor: [0.3, 0.96, 0.05],
  attack: null,
  tradeSite: "market",
  deathSpawn: poseidonMilitiaDeathSpawn(4),
  isStatic: true,
  resource: -1,
  bodyRadius: 4,
  collidesWithProjectiles: true,
  footprint: 4,
  costFood: 0,
  costWood: 300,
  costGold: 0,
  costFavor: 0,
  buildTicks: 40 * 20,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 6.5,
  isDropsite: false,
  requiredAge: AGE_CLASSICAL,
  requiredGod: NO_GOD,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: NO_TYPE_RELATIONSHIPS,
  builtBy: [{ type: TYPE_GREEK_VILLAGER, commandSlot: 7 }],
} as const satisfies UnitTypeStats;
