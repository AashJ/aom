import { TICK_HZ } from "../../../clock";
import { AGE_MYTHIC, GOD_THOTH } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TEMPLE, TYPE_PHOENIX, TYPE_PHOENIX_EGG } from "../../unit-type-ids";
import {
  AREA_DAMAGE_ALLIES,
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_BUILDINGS,
  AREA_DAMAGE_NEUTRAL_UNITS,
  CULTURE_EGYPTIAN,
  MOVEMENT_DOMAIN_AIR,
  MOVEMENT_DOMAIN_LAND,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_AIR,
  UNIT_CLASS_HERO,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  type UnitTypeStats,
} from "../../unit-type-schema";

const ENEMIES_AND_GAIA_UNITS = AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS;

export const definition = {
  id: TYPE_PHOENIX,
  key: "egyptian-phoenix",
  label: "Phoenix",
  culture: CULTURE_EGYPTIAN,
  classes: UNIT_CLASS_MYTH | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE | UNIT_CLASS_AIR,
  maxHp: 400,
  lineOfSight: 20,
  movementSpeed: 3.6,
  movementDomain: MOVEMENT_DOMAIN_AIR,
  armor: [0.15, 0.55, 0.8],
  attack: {
    kind: "melee",
    damage: [30, 0, 30],
    range: 4,
    aggroRange: 20,
    cooldownTicks: 54,
    bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_HERO }, multiplier: 0.5 }],
    canTargetAir: true,
    impactArea: {
      radius: 3,
      falloff: "constant",
      components: [
        { damage: [30, 0, 0], damageRelations: ENEMIES_AND_GAIA_UNITS },
        {
          damage: [0, 0, 30],
          // Launch Classic omitted the Crush action's target options. Preserve
          // the resulting friendly fire and damage to neutral buildings.
          damageRelations:
            ENEMIES_AND_GAIA_UNITS | AREA_DAMAGE_ALLIES | AREA_DAMAGE_NEUTRAL_BUILDINGS,
        },
      ],
    },
    cycleVariants: [{ actionTicks: 54, impactDelayTicks: 43 }],
  },
  deathReplacement: {
    trigger: "death",
    unitType: TYPE_PHOENIX_EGG,
    placementDomain: MOVEMENT_DOMAIN_LAND,
    requireNavigableOrigin: true,
  },
  isStatic: false,
  resource: -1,
  bodyRadius: 0.99,
  collidesWithUnits: false,
  collidesWithProjectiles: true,
  footprint: 0,
  costFood: 0,
  costWood: 0,
  costGold: 200,
  costFavor: 30,
  buildTicks: 6 * TICK_HZ,
  populationCost: 5,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_MYTHIC,
  requiredGod: GOD_THOTH,
  prerequisiteBuildings: [TYPE_EGYPTIAN_TEMPLE],
  trainedAt: [
    { type: TYPE_EGYPTIAN_TEMPLE, commandSlot: 4 },
    { type: TYPE_PHOENIX_EGG, commandSlot: 0 },
  ],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
