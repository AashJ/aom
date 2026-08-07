import { AGE_ARCHAIC, NO_GOD } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_LABORER, TYPE_EGYPTIAN_WALL_CONNECTOR } from "../../unit-type-ids";
import { CULTURE_EGYPTIAN, NO_PREREQUISITE_BUILDINGS, NO_TYPE_RELATIONSHIPS, UNIT_CLASS_BUILDING, type UnitTypeStats } from "../../unit-type-schema";

export const definition = {
  id: TYPE_EGYPTIAN_WALL_CONNECTOR, key: "egyptian-wall-connector", label: "Wall Connector",
  culture: CULTURE_EGYPTIAN, classes: UNIT_CLASS_BUILDING, maxHp: 600, lineOfSight: 5,
  movementSpeed: 0, armor: [0.65, 0.96, 0.05], attack: null, isStatic: true, resource: -1,
  bodyRadius: 1, collidesWithProjectiles: true, footprint: 1, footprintDepth: 1,
  costFood: 0, costWood: 0, costGold: 3, costFavor: 0, buildTicks: 3 * 20,
  populationCost: 0, popBonus: 0, trainExitOffset: 0, isDropsite: false,
  requiredAge: AGE_ARCHAIC, requiredGod: NO_GOD, prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: NO_TYPE_RELATIONSHIPS, builtBy: [{ type: TYPE_EGYPTIAN_LABORER, commandSlot: 21 }],
} as const satisfies UnitTypeStats;
