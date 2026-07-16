import { heroUnitExpected, type UnitReferenceSpec } from "../unit-reference-schema";

const TRIAL_PROTO_SHA256 = "464520f1ea00b36e1872bf5a59831408c819c205e56f055c7b2e8bdf53719da2";
const GREEK_ASSET_INVENTORY_SHA256 =
  "b87dbdf96d2d020b4f885edff58c96df028064fc00f012124a597495e14b6c34";

export const GATE_C_UNIT_REFERENCES = [
  {
    family: "hero",
    attackKind: "melee",
    id: 96,
    key: "greek-jason",
    source: {
      stage: "candidate",
      culture: "greek",
      ruleset: "Age of Mythology Classic",
      trialProto: {
        sha256: TRIAL_PROTO_SHA256,
        unitId: 478,
        unitName: "Hero Greek Jason",
      },
      assetInventory: {
        sha256: GREEK_ASSET_INVENTORY_SHA256,
        rosterName: "Jason",
        rootAnimation: "hero greek jason_anim.txt",
      },
      trialDeltas: [
        {
          field: "label",
          trial: "Hero Greek Jason",
          final: "Jason",
          reason: "The runtime label uses the localized Classic display name, not the proto key.",
        },
      ],
    },
    expected: heroUnitExpected({
      label: "Jason",
      culture: 1,
      classes: 2096,
      hero: {
        trainLimit: 1,
        relicCapacity: 1,
        relicPickupRange: 1,
        relicDropOffRange: 1,
      },
      maxHp: 250,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.25, 0.35, 0.99],
      attack: {
        kind: "melee",
        damage: [9, 0, 0],
        range: 0.1,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [{ target: { kind: "classes", classes: 8192 }, multiplier: 7 }],
      },
      bodyRadius: 0.7,
      cost: [100, 0, 50, 0],
      buildTicks: 180,
      populationCost: 2,
      requiredAge: 0,
      requiredGod: 0,
      prerequisiteBuildings: [34],
      trainedAt: [
        { type: 18, commandSlot: 1 },
        { type: 26, commandSlot: 0 },
      ],
    }),
  },
] as const satisfies readonly UnitReferenceSpec[];
