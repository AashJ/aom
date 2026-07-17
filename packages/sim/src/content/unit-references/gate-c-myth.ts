import { GOD_ATHENA } from "../../ecs/progression";
import { TYPE_GREEK_TEMPLE, TYPE_MINOTAUR } from "../unit-type-ids";
import { mythUnitExpected, type UnitReferenceSpec } from "../unit-reference-schema";
import {
  CULTURE_GREEK,
  NO_DAMAGE_BONUSES,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
} from "../unit-type-schema";

const TRIAL_PROTO_SHA256 = "464520f1ea00b36e1872bf5a59831408c819c205e56f055c7b2e8bdf53719da2";
const GREEK_ASSET_INVENTORY_SHA256 =
  "b87dbdf96d2d020b4f885edff58c96df028064fc00f012124a597495e14b6c34";

export const GATE_C_MYTH_UNIT_REFERENCES = [
  {
    family: "myth",
    attackKind: "melee",
    id: TYPE_MINOTAUR,
    key: "greek-minotaur",
    source: {
      stage: "candidate",
      culture: "greek",
      ruleset: "Age of Mythology Classic",
      trialProto: {
        sha256: TRIAL_PROTO_SHA256,
        unitId: 355,
        unitName: "Minotaur",
      },
      assetInventory: {
        sha256: GREEK_ASSET_INVENTORY_SHA256,
        rosterName: "Minotaur",
        rootAnimation: "minotaur_anim.txt",
        specialImpact: {
          sha256: "383e1b29fdd95911777e86611d0288d79aafde08adcc345d13ec39562b857439",
          action: "Gore",
          tag: "Attack",
          fraction: 0.47,
          durationTicks: 40,
        },
      },
      trialDeltas: [],
    },
    expected: mythUnitExpected({
      label: "Minotaur",
      culture: CULTURE_GREEK,
      classes: UNIT_CLASS_MYTH | UNIT_CLASS_INFANTRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
      maxHp: 300,
      lineOfSight: 20,
      movementSpeed: 4,
      armor: [0.6, 0.5, 0.8],
      attack: {
        kind: "melee",
        damage: [15, 0, 10],
        range: 0.1,
        aggroRange: 20,
        cooldownTicks: 20,
        bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 3 }],
      },
      specialAttack: {
        kind: "charged-melee",
        damage: [60, 0, 0],
        range: 0.1,
        bonuses: NO_DAMAGE_BONUSES,
        rechargeTicks: 15 * 20,
        actionTicks: 2 * 20,
        impactDelayTicks: 19,
        validTargets: [
          { kind: "classes", classes: UNIT_CLASS_HUMAN },
          { kind: "classes", classes: UNIT_CLASS_MYTH | UNIT_CLASS_INFANTRY },
        ],
      },
      bodyRadius: 0.99,
      cost: [200, 0, 0, 16],
      buildTicks: 20 * 20,
      populationCost: 4,
      requiredAge: 1,
      requiredGod: GOD_ATHENA,
      prerequisiteBuildings: [TYPE_GREEK_TEMPLE],
      trainedAt: [{ type: TYPE_GREEK_TEMPLE, commandSlot: 1 }],
    }),
  },
] as const satisfies readonly UnitReferenceSpec[];
