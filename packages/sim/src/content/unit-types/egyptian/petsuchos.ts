import { TICK_HZ } from "../../../clock";
import { AGE_HEROIC, GOD_HATHOR } from "../../../ecs/progression";
import { TYPE_EGYPTIAN_TEMPLE, TYPE_PETSUCHOS } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_HERO,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  type UnitTypeStats,
} from "../../unit-type-schema";

export const definition = {
  id: TYPE_PETSUCHOS,
  key: "egyptian-petsuchos",
  label: "Petsuchos",
  culture: CULTURE_EGYPTIAN,
  classes: UNIT_CLASS_MYTH | UNIT_CLASS_ARCHER | UNIT_CLASS_MILITARY,
  maxHp: 480,
  lineOfSight: 24,
  movementSpeed: 3.6,
  armor: [0.3, 0.5, 0.8],
  attack: {
    kind: "beam",
    // Classic LightningAttack applies the stored attack packet once, rather
    // than converting the row into DPS over the three-second charging clip.
    damage: [0, 50, 20],
    range: 20,
    aggroRange: 24,
    cooldownTicks: 3 * TICK_HZ,
    bonuses: [
      {
        target: { kind: "classes", classes: UNIT_CLASS_HERO },
        multiplier: 0.25,
      },
    ],
    impactDelayTicks: 27,
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
  buildTicks: 20 * TICK_HZ,
  populationCost: 4,
  popBonus: 0,
  trainExitOffset: 0,
  isDropsite: false,
  requiredAge: AGE_HEROIC,
  requiredGod: GOD_HATHOR,
  prerequisiteBuildings: [TYPE_EGYPTIAN_TEMPLE],
  trainedAt: [{ type: TYPE_EGYPTIAN_TEMPLE, commandSlot: 2 }],
  builtBy: NO_TYPE_RELATIONSHIPS,
} as const satisfies UnitTypeStats;
