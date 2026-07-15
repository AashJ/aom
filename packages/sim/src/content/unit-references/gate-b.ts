import { ordinaryUnitExpected, type UnitReferenceSpec } from "../unit-reference-schema";

const TRIAL_PROTO_SHA256 = "464520f1ea00b36e1872bf5a59831408c819c205e56f055c7b2e8bdf53719da2";
const GREEK_ASSET_INVENTORY_SHA256 =
  "b87dbdf96d2d020b4f885edff58c96df028064fc00f012124a597495e14b6c34";
const TOXOTES_ANIMATION_SHA256 = "1115ec498271c3afd8b18d7056796f578657228e2e4db55f0ddf9e5fa7882483";
const REVIEW_COMMIT = "5614ca84f2407d2c5bea9872950669cc90b82e80";

export const GATE_B_UNIT_REFERENCES = [
  {
    family: "ordinary-projectile",
    id: 81,
    key: "greek-toxotes",
    source: {
      culture: "greek",
      ruleset: "Age of Mythology Classic",
      trialProto: {
        sha256: TRIAL_PROTO_SHA256,
        unitId: 444,
        unitName: "Toxotes",
      },
      assetInventory: {
        sha256: GREEK_ASSET_INVENTORY_SHA256,
        rosterName: "Toxotes",
        rootAnimation: "toxotes_anim.txt",
        attackRelease: {
          sha256: TOXOTES_ANIMATION_SHA256,
          action: "RangedAttack",
          tag: "Attack",
          fraction: 0.4,
        },
      },
      trialDeltas: [],
      finalRulesetReview: {
        commit: REVIEW_COMMIT,
        scope:
          "Complete Toxotes runtime reference, including its producer assignment, attack-cycle timing, projectile identity, and fields absent from the Trial proto.",
      },
    },
    expected: ordinaryUnitExpected({
      label: "Toxotes",
      culture: 1,
      classes: 1042,
      maxHp: 60,
      lineOfSight: 19,
      movementSpeed: 4,
      armor: [0.15, 0.15, 0.99],
      attack: {
        kind: "projectile",
        damage: [0, 6.5, 0],
        range: 15,
        aggroRange: 19,
        cooldownTicks: 20,
        bonuses: [{ target: { kind: "unit", key: "norse-raiding-cavalry" }, multiplier: 0.9 }],
        launchDelayTicks: 8,
        accuracy: 0.8,
        accuracyReductionFactor: 1.5,
        aimBonus: 15,
        spreadFactor: 0.25,
        maxSpread: 5,
        trackRating: 5,
        unintentionalDamageMultiplier: 0.3,
        projectile: {
          type: 0,
          speed: 30,
          lifespanTicks: 40,
          collisionRadius: 0.1,
        },
      },
      bodyRadius: 0.49,
      cost: [0, 55, 35, 0],
      buildTicks: 300,
      populationCost: 2,
      requiredAge: 1,
      requiredGod: 255,
      prerequisiteBuildings: [24],
      trainedAt: [{ type: 24, commandSlot: 0 }],
    }),
  },
] as const satisfies readonly UnitReferenceSpec[];
