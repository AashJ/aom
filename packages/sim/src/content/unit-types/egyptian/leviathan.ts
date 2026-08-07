import { TICK_HZ } from "../../../clock";
import { AGE_HEROIC, GOD_NEPHTHYS } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_DOCK, TYPE_LEVIATHAN } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  MOVEMENT_DOMAIN_WATER,
  NO_DAMAGE_BONUSES,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_RELIC,
  UNIT_CLASS_SHIP,
  UNIT_CLASS_TITAN,
  UNIT_CLASS_TRANSPORT_SHIP,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_LEVIATHAN,
  key: "egyptian-leviathan",
  label: "Leviathan",
  culture: CULTURE_EGYPTIAN,
  classes:
    UNIT_CLASS_MYTH |
    UNIT_CLASS_MILITARY |
    UNIT_CLASS_MELEE |
    UNIT_CLASS_SHIP |
    UNIT_CLASS_TRANSPORT_SHIP,
  maxHp: 1020,
  lineOfSight: 22,
  movementSpeed: 4.2,
  movementDomain: MOVEMENT_DOMAIN_WATER,
  armor: [0.4, 0.6, 0.8],
  attack: {
    kind: "melee",
    damage: [25, 0, 0],
    range: 0.1,
    aggroRange: 22,
    cooldownTicks: TICK_HZ,
    bonuses: NO_DAMAGE_BONUSES,
    cycleVariants: [{ actionTicks: 30, impactDelayTicks: 18 }],
  },
  garrison: {
    capacity: 20,
    enterRange: 4,
    validOccupants: [
      {
        kind: "classes",
        classes: 0,
        excludedClasses:
          UNIT_CLASS_BUILDING | UNIT_CLASS_RELIC | UNIT_CLASS_SHIP | UNIT_CLASS_TITAN,
      },
    ],
    attackMultiplierPerOccupant: 0,
    ejectOnDeath: false,
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.99,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 200,
  costFavor: 20,
  buildTicks: 10 * TICK_HZ,
  populationCost: 4,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: GOD_NEPHTHYS,
  prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
  trainedAt: [{ type: TYPE_EGYPTIAN_DOCK, commandSlot: 5 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
