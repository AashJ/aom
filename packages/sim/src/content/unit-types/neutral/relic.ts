import { AGE_ARCHAIC, NO_GOD } from "../../../ecs/progression";
import { TYPE_RELIC } from "../../unit-type-ids";
import {
  CULTURE_SHARED,
  NO_ARMOR,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_RELIC,
  type UnitTypeStats,
} from "../../unit-type-schema";

// Shared map object rather than an agentic roster lane. Relic powers are
// separate content; Gate C owns only the deterministic carry lifecycle.
export const definition = {
  id: TYPE_RELIC,
  key: "relic",
  label: "Relic",
  culture: CULTURE_SHARED,
  classes: UNIT_CLASS_RELIC,
  maxHp: 1,
  lineOfSight: 0,
  movementSpeed: 0,
  armor: NO_ARMOR,
  attack: null,
  isStatic: true,
  resource: -1,
  bodyRadius: 1,
  collidesWithProjectiles: false,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 0,
  costFavor: 0,
  buildTicks: 0,
  populationCost: 0,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_ARCHAIC,
  requiredGod: NO_GOD,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: NO_TYPE_RELATIONSHIPS,
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
