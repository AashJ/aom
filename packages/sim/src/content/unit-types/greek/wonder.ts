import { TICK_HZ } from "../../../clock";
import { AGE_MYTHIC, NO_GOD } from "../../../ecs/progression";
import { poseidonMilitiaDeathSpawn } from "../../death-spawns";
import { TYPE_GREEK_VILLAGER, TYPE_GREEK_WONDER } from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_GREEK_WONDER,
  key: "greek-wonder",
  label: "Wonder",
  culture: CULTURE_GREEK,
  classes: UNIT_CLASS_BUILDING,
  maxHp: 9999,
  lineOfSight: 9,
  movementSpeed: 0,
  armor: [0.3, 0.96, 0.05],
  attack: null,
  deathSpawn: poseidonMilitiaDeathSpawn(10),
  isStatic: true,
  resource: -1,
  bodyRadius: 8,
  collidesWithProjectiles: true,
  footprint: 8,
  costFood: 1000,
  costWood: 1000,
  costGold: 1000,
  costFavor: 50,
  buildTicks: 1800 * TICK_HZ,
  buildLimit: 1,
  wonderVictoryTicks: 10 * 60 * TICK_HZ,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_MYTHIC,
  requiredGod: NO_GOD,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: NO_TYPE_RELATIONSHIPS,
  builtBy: [{ type: TYPE_GREEK_VILLAGER, commandSlot: 15 }],
} as const satisfies UnitTypeStats;
