import { TICK_HZ } from "../../clock";
import { AGE_ARCHAIC, AGE_MYTHIC, GOD_OSIRIS, NO_GOD } from "../../ecs/progression";
import { PROJECTILE_PRIEST } from "../../ecs/projectiles";
import {
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_PHARAOH,
  TYPE_PRIEST,
  TYPE_SON_OF_OSIRIS,
} from "../unit-type-ids";
import { heroUnitExpected, type UnitReferenceSpec } from "../unit-reference-schema";
import {
  CULTURE_EGYPTIAN,
  UNIT_CLASS_HERO,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_NON_GREEK_UNIT,
  UNIT_CLASS_SCOUT,
} from "../unit-type-schema";

const TRIAL_PROTO_SHA256 = "464520f1ea00b36e1872bf5a59831408c819c205e56f055c7b2e8bdf53719da2";
const EGYPTIAN_ASSET_INVENTORY_SHA256 =
  "ba7b5c96ff3f7977d28ec97ca699e479b2d38fff9d5f7a605516a2dfe2b62d8e";

const pharaohProjectile = {
  kind: "projectile",
  damage: [0, 12, 0],
  range: 4,
  aggroRange: 10,
  cooldownTicks: 24,
  bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 5 }],
  launchDelayTicks: 10,
  accuracy: 1,
  accuracyReductionFactor: 0,
  aimBonus: 0,
  spreadFactor: 0,
  maxSpread: 0,
  trackRating: 5,
  unintentionalDamageMultiplier: 0.1,
  projectile: { type: PROJECTILE_PRIEST, speed: 30, lifespanTicks: 40, collisionRadius: 0 },
} as const;

const priestProjectile = {
  ...pharaohProjectile,
  damage: [0, 3, 0],
  range: 3,
  aggroRange: 8,
  cooldownTicks: TICK_HZ,
  bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 7 }],
  launchDelayTicks: 12,
  trackRating: 6,
} as const;

export const GATE_F_UNIT_REFERENCES = [
  {
    family: "hero",
    attackKind: "projectile",
    id: TYPE_PHARAOH,
    key: "egyptian-pharaoh",
    source: {
      stage: "candidate",
      culture: "egyptian",
      ruleset: "Age of Mythology Classic",
      trialProto: { sha256: TRIAL_PROTO_SHA256, unitId: 433, unitName: "Pharaoh" },
      assetInventory: {
        sha256: EGYPTIAN_ASSET_INVENTORY_SHA256,
        rosterName: "Pharaoh",
        rootAnimation: "pharaoh_anim.txt",
        attackRelease: {
          sha256: "33e2017ed75eb0e9a0026a62018b3abe5938f340a91234a24ec66047425415a5",
          action: "RangedAttack",
          tag: "Attack",
          fraction: 0.4,
        },
      },
      trialDeltas: [
        {
          field: "lineOfSight",
          trial: 16,
          final: 10,
          reason: "The shipped Archaic Pharaoh starts at 10 LOS and gains the age effects encoded separately by the simulation.",
        },
      ],
    },
    expected: heroUnitExpected({
      label: "Pharaoh",
      culture: CULTURE_EGYPTIAN,
      classes: UNIT_CLASS_HERO | UNIT_CLASS_MILITARY | UNIT_CLASS_NON_GREEK_UNIT,
      hero: { trainLimit: 1, relicCapacity: 1, relicPickupRange: 1, relicDropOffRange: 1 },
      maxHp: 100,
      lineOfSight: 10,
      movementSpeed: 4,
      armor: [0.15, 0.15, 0.99],
      attack: pharaohProjectile,
      bodyRadius: 0.7,
      cost: [0, 0, 0, 0],
      buildTicks: 0,
      populationCost: 0,
      requiredAge: AGE_ARCHAIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [],
      trainedAt: [],
    }),
  },
  {
    family: "hero",
    attackKind: "projectile",
    id: TYPE_PRIEST,
    key: "egyptian-priest",
    source: {
      stage: "candidate",
      culture: "egyptian",
      ruleset: "Age of Mythology Classic",
      trialProto: { sha256: TRIAL_PROTO_SHA256, unitId: 447, unitName: "Priest" },
      assetInventory: {
        sha256: EGYPTIAN_ASSET_INVENTORY_SHA256,
        rosterName: "Priest",
        rootAnimation: "priest_anim.txt",
        attackRelease: {
          sha256: "ecc3d70a5db8759ddf15075f22adf1aa34f1783a930a997874d690a6ff317737",
          action: "RangedAttack",
          tag: "Attack",
          fraction: 0.61,
        },
      },
      trialDeltas: [
        {
          field: "classes",
          trial: UNIT_CLASS_HERO | UNIT_CLASS_MILITARY | UNIT_CLASS_SCOUT,
          final:
            UNIT_CLASS_HERO |
            UNIT_CLASS_MILITARY |
            UNIT_CLASS_SCOUT |
            UNIT_CLASS_NON_GREEK_UNIT,
          reason: "The canonical runtime classifies Egyptian units as non-Greek in addition to the Trial combat classes.",
        },
      ],
    },
    expected: heroUnitExpected({
      label: "Priest",
      culture: CULTURE_EGYPTIAN,
      classes:
        UNIT_CLASS_HERO | UNIT_CLASS_MILITARY | UNIT_CLASS_SCOUT | UNIT_CLASS_NON_GREEK_UNIT,
      hero: { relicCapacity: 0, relicPickupRange: 1, relicDropOffRange: 1 },
      maxHp: 90,
      lineOfSight: 8,
      movementSpeed: 3.6,
      armor: [0.1, 0, 0.99],
      attack: priestProjectile,
      bodyRadius: 0.7,
      cost: [0, 0, 100, 0],
      buildTicks: 9 * TICK_HZ,
      populationCost: 2,
      requiredAge: AGE_ARCHAIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_EGYPTIAN_TEMPLE],
      trainedAt: [
        { type: TYPE_EGYPTIAN_TEMPLE, commandSlot: 0 },
        { type: TYPE_EGYPTIAN_TOWN_CENTER, commandSlot: 1 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "beam",
    id: TYPE_SON_OF_OSIRIS,
    key: "egyptian-son-of-osiris",
    source: {
      stage: "candidate",
      culture: "egyptian",
      ruleset: "Age of Mythology Classic",
      trialProto: { sha256: TRIAL_PROTO_SHA256, unitId: 523, unitName: "Pharaoh of Osiris" },
      assetInventory: {
        sha256: EGYPTIAN_ASSET_INVENTORY_SHA256,
        rosterName: "Son of Osiris",
        rootAnimation: "pharaoh of osiris_anim.txt",
        beamAttackCycle: {
          sha256: "d3aa1809ff160b51b4f9e5c1888ff5a420e8476493db56221b0e149e22451151",
          action: "Charging",
          tag: "Attack",
          fraction: 0.55,
          durationTicks: 60,
          model: "sfx e son of osiris_attacka.glb",
          modelSha256: "8f96d2e7a1de7ca6c90c7eb71c02eefa5563b47abe3046d0e47c801037290ca2",
        },
        beamVisual: {
          beamAnimationFile: "osiris lightning_anim.txt",
          beamAnimationSha256: "accef2f095e01b18f632b43ee95f0a24f62ac26b6ddff82284a4e7caaee4abc3",
          beamVisual: "VisualLightning SFX A Osiris",
          headAnimationFile: "osiris lightning_anim.txt",
          headAnimationSha256: "accef2f095e01b18f632b43ee95f0a24f62ac26b6ddff82284a4e7caaee4abc3",
          headVisual: "VisualLightning SFX A Osiris",
          beamTextureFile: "lightning.ddt",
          beamTextureSha256: "b816dc2fefe981ed5c01d70a0e46d68789c261436b0a3eddc815c8c58d3a9845",
          beamTextureWidth: 32,
          beamTextureHeight: 32,
          headTextureFile: "lightning.ddt",
          headTextureSha256: "b816dc2fefe981ed5c01d70a0e46d68789c261436b0a3eddc815c8c58d3a9845",
          headTextureWidth: 32,
          headTextureHeight: 32,
        },
      },
      trialDeltas: [
        { field: "label", trial: "Pharaoh of Osiris", final: "Son of Osiris", reason: "The runtime uses the shipped localized unit name." },
        { field: "attack.damage", trial: null, final: [60, 0, 0], reason: "The Classic controller injects the Son's chain-lightning attack outside the proto row." },
        { field: "attack.range", trial: null, final: 18, reason: "The Classic controller injects the Son's chain-lightning attack outside the proto row." },
        { field: "attack.bonuses", trial: null, final: [{ target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 5 }], reason: "The Classic controller injects the Son's myth bonus outside the proto row." },
      ],
    },
    expected: heroUnitExpected({
      label: "Son of Osiris",
      culture: CULTURE_EGYPTIAN,
      classes: UNIT_CLASS_HERO | UNIT_CLASS_MILITARY | UNIT_CLASS_NON_GREEK_UNIT,
      hero: { trainLimit: 1, relicCapacity: 1, relicPickupRange: 1, relicDropOffRange: 1 },
      maxHp: 420,
      lineOfSight: 25,
      movementSpeed: 3.6,
      armor: [0.3, 0.5, 0.99],
      attack: {
        kind: "beam",
        damage: [60, 0, 0],
        range: 18,
        aggroRange: 25,
        cooldownTicks: 60,
        bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier: 5 }],
        impactDelayTicks: 33,
        chain: { maxTargets: 4, radius: 8, damageMultiplier: 1 },
      },
      bodyRadius: 0.7,
      cost: [0, 0, 0, 0],
      buildTicks: 0,
      populationCost: 0,
      requiredAge: AGE_MYTHIC,
      requiredGod: GOD_OSIRIS,
      prerequisiteBuildings: [],
      trainedAt: [],
    }),
  },
] as const satisfies readonly UnitReferenceSpec[];
