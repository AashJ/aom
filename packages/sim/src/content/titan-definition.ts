import { TICK_HZ } from "../clock";
import { AGE_MYTHIC, NO_GOD } from "../ecs/progression";
import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  NO_PREREQUISITE_BUILDINGS,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_TITAN,
  type UnitTypeStats,
} from "./unit-type-schema";

type TitanDefinitionOptions = Pick<UnitTypeStats, "id" | "key" | "label" | "culture"> & {
  readonly additionalClasses?: number;
};

const TITAN_DAMAGE_RELATIONS = AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS;

export function titanDefinition(options: TitanDefinitionOptions): UnitTypeStats {
  return {
    id: options.id,
    key: options.key,
    label: options.label,
    culture: options.culture,
    classes:
      UNIT_CLASS_MYTH |
      UNIT_CLASS_TITAN |
      UNIT_CLASS_MILITARY |
      UNIT_CLASS_MELEE |
      (options.additionalClasses ?? 0),
    maxHp: 7_000,
    lineOfSight: 25,
    movementSpeed: 3.75,
    armor: [0.9, 0.95, 0.9],
    attack: {
      kind: "melee",
      damage: [70, 0, 70],
      range: 2,
      aggroRange: 25,
      cooldownTicks: 70,
      bonuses: [
        { target: { kind: "classes", classes: UNIT_CLASS_HUMAN }, multiplier: 2 },
        { target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 2 },
        { target: { kind: "classes", classes: UNIT_CLASS_BUILDING }, multiplier: 5 },
        { target: { kind: "classes", classes: UNIT_CLASS_TITAN }, multiplier: 20 },
      ],
      impactArea: {
        radius: 8,
        falloff: "linear",
        components: [
          { damage: [70, 0, 0], damageRelations: TITAN_DAMAGE_RELATIONS },
          { damage: [0, 0, 70], damageRelations: TITAN_DAMAGE_RELATIONS },
        ],
      },
      cycleVariants: [{ actionTicks: 70, impactDelayTicks: 35 }],
    },
    specialAttack: {
      kind: "charged-area-pulse",
      damage: [200, 0, 0],
      range: 0.5,
      bonuses: [
        { target: { kind: "classes", classes: UNIT_CLASS_HUMAN }, multiplier: 3 },
        { target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 3 },
      ],
      rechargeTicks: 20 * TICK_HZ,
      actionTicks: 70,
      impactDelayTicks: 35,
      validTargets: [
        { kind: "classes", classes: UNIT_CLASS_HUMAN },
        { kind: "classes", classes: UNIT_CLASS_MYTH, excludedClasses: UNIT_CLASS_TITAN },
      ],
      radius: 10,
      falloff: "linear",
      damageRelations: TITAN_DAMAGE_RELATIONS,
    },
    healable: false,
    isStatic: false,
    resource: -1,
    bodyRadius: 2.5,
    collidesWithProjectiles: true,
    footprint: 0,
    costFood: 0,
    costWood: 0,
    costGold: 0,
    costFavor: 0,
    buildTicks: 0,
    populationCost: 20,
    popBonus: 0,
    trainExitOffset: 0,
    isDropsite: false,
    requiredAge: AGE_MYTHIC,
    requiredGod: NO_GOD,
    prerequisiteBuildings: NO_PREREQUISITE_BUILDINGS,
    trainedAt: NO_TYPE_RELATIONSHIPS,
    builtBy: NO_TYPE_RELATIONSHIPS,
  };
}
