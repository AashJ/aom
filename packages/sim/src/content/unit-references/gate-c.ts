import {
  heroUnitExpected,
  type TrialFidelityDelta,
  type UnitReferenceSpec,
} from "../unit-reference-schema";
import type {
  ArmorProfile,
  Attack,
  ProjectileAttack,
  TypeCommandRelationship,
} from "../unit-type-schema";

const TRIAL_PROTO_SHA256 = "464520f1ea00b36e1872bf5a59831408c819c205e56f055c7b2e8bdf53719da2";
const GREEK_ASSET_INVENTORY_SHA256 =
  "b87dbdf96d2d020b4f885edff58c96df028064fc00f012124a597495e14b6c34";

const HERO_TRAITS = {
  trainLimit: 1,
  relicCapacity: 1,
  relicPickupRange: 1,
  relicDropOffRange: 1,
} as const;

function displayNameDelta(trialName: string, label: string): TrialFidelityDelta {
  return {
    field: "label",
    trial: trialName,
    final: label,
    reason: "The runtime label uses the localized Classic display name, not the proto key.",
  };
}

function candidateHeroSource(
  unitId: number,
  trialName: string,
  label: string,
  rootAnimation: string,
  trialDeltas: readonly TrialFidelityDelta[] = [],
) {
  return {
    stage: "candidate",
    culture: "greek",
    ruleset: "Age of Mythology Classic",
    trialProto: {
      sha256: TRIAL_PROTO_SHA256,
      unitId,
      unitName: trialName,
    },
    assetInventory: {
      sha256: GREEK_ASSET_INVENTORY_SHA256,
      rosterName: label,
      rootAnimation,
    },
    trialDeltas: [displayNameDelta(trialName, label), ...trialDeltas],
  } as const;
}

function candidateProjectileHeroSource(
  unitId: number,
  trialName: string,
  label: string,
  rootAnimation: string,
  animationSha256: string,
  releaseFraction: number,
  trialDeltas: readonly TrialFidelityDelta[] = [],
) {
  const common = candidateHeroSource(unitId, trialName, label, rootAnimation, trialDeltas);
  return {
    ...common,
    assetInventory: {
      ...common.assetInventory,
      attackRelease: {
        sha256: animationSha256,
        action: "RangedAttack",
        tag: "Attack",
        fraction: releaseFraction,
      },
    },
  } as const;
}

function finalHeroSource(unitId: number, trialName: string, label: string, rootAnimation: string) {
  const candidate = candidateHeroSource(unitId, trialName, label, rootAnimation);
  return {
    ...candidate,
    stage: "final",
    finalRulesetReview: {
      commit: "8a0d41d72aed100520c8ee9fc403cb6f723b5bc3",
      scope:
        "Complete Jason hero pack and Gate C lifecycle foundation, including uniqueness, retraining, myth counter damage, relic containment, production, deterministic state, and original media.",
    },
  } as const;
}

interface GreekHeroExpectedOptions<A extends Attack> {
  readonly label: string;
  readonly maxHp: number;
  readonly lineOfSight: number;
  readonly movementSpeed: number;
  readonly armor: ArmorProfile;
  readonly attack: A;
  readonly cost: readonly [food: number, wood: number, gold: number, favor: number];
  readonly buildTicks: number;
  readonly populationCost: number;
  readonly requiredAge: number;
  readonly requiredGod: number;
  readonly trainedAt: readonly TypeCommandRelationship[];
}

function greekHeroExpected<A extends Attack>(options: GreekHeroExpectedOptions<A>) {
  return heroUnitExpected({
    ...options,
    culture: 1,
    classes: options.attack.kind === "melee" ? 2096 : 2064,
    hero: HERO_TRAITS,
    bodyRadius: 0.7,
    prerequisiteBuildings: [34],
  });
}

function meleeHeroAttack(damage: number, aggroRange: number, cooldownTicks: number) {
  return {
    kind: "melee",
    damage: [damage, 0, 0],
    range: 0.1,
    aggroRange,
    cooldownTicks,
    bonuses: [{ target: { kind: "classes", classes: 8192 }, multiplier: 7 }],
  } as const;
}

function projectileHeroAttack(options: {
  readonly damage: number;
  readonly range: number;
  readonly aggroRange: number;
  readonly cooldownTicks: number;
  readonly launchDelayTicks: number;
  readonly trackRating: number;
}): ProjectileAttack {
  return {
    kind: "projectile",
    damage: [0, options.damage, 0],
    range: options.range,
    aggroRange: options.aggroRange,
    cooldownTicks: options.cooldownTicks,
    bonuses: [{ target: { kind: "classes", classes: 8192 }, multiplier: 7 }],
    launchDelayTicks: options.launchDelayTicks,
    accuracy: 0.9,
    accuracyReductionFactor: 1.5,
    aimBonus: 15,
    spreadFactor: 0.25,
    maxSpread: 5,
    trackRating: options.trackRating,
    unintentionalDamageMultiplier: 0.3,
    projectile: {
      type: 0,
      speed: 30,
      lifespanTicks: 40,
      collisionRadius: 0.1,
    },
  };
}

export const GATE_C_UNIT_REFERENCES = [
  {
    family: "hero",
    attackKind: "melee",
    id: 96,
    key: "greek-jason",
    source: finalHeroSource(478, "Hero Greek Jason", "Jason", "hero greek jason_anim.txt"),
    expected: greekHeroExpected({
      label: "Jason",
      maxHp: 250,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.25, 0.35, 0.99],
      attack: meleeHeroAttack(9, 16, 30),
      cost: [100, 0, 50, 0],
      buildTicks: 180,
      populationCost: 2,
      requiredAge: 0,
      requiredGod: 0,
      trainedAt: [
        { type: 18, commandSlot: 1 },
        { type: 26, commandSlot: 0 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "projectile",
    id: 97,
    key: "greek-odysseus",
    source: candidateProjectileHeroSource(
      436,
      "Hero Greek Odysseus",
      "Odysseus",
      "hero greek odysseus_anim.txt",
      "4cbb53ba559a2e49543217f442b6d9b7065ae14d664cb034fe1175efca86a4e8",
      0.4,
    ),
    expected: greekHeroExpected({
      label: "Odysseus",
      maxHp: 320,
      lineOfSight: 20,
      movementSpeed: 4,
      armor: [0.2, 0.3, 0.99],
      attack: projectileHeroAttack({
        damage: 8,
        range: 18,
        aggroRange: 20,
        cooldownTicks: 24,
        launchDelayTicks: 10,
        trackRating: 6,
      }),
      cost: [0, 200, 0, 2],
      buildTicks: 340,
      populationCost: 2,
      requiredAge: 1,
      requiredGod: 0,
      trainedAt: [
        { type: 18, commandSlot: 2 },
        { type: 26, commandSlot: 1 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "melee",
    id: 98,
    key: "greek-heracles",
    source: candidateHeroSource(
      477,
      "Hero Greek Heracles",
      "Heracles",
      "hero greek heracles_anim.txt",
    ),
    expected: greekHeroExpected({
      label: "Heracles",
      maxHp: 400,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.25, 0.4, 0.99],
      attack: meleeHeroAttack(10, 16, 24),
      cost: [350, 0, 0, 4],
      buildTicks: 460,
      populationCost: 3,
      requiredAge: 2,
      requiredGod: 0,
      trainedAt: [
        { type: 18, commandSlot: 3 },
        { type: 26, commandSlot: 2 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "melee",
    id: 100,
    key: "greek-theseus",
    source: candidateHeroSource(
      487,
      "Hero Greek Theseus",
      "Theseus",
      "hero greek theseus_anim.txt",
    ),
    expected: greekHeroExpected({
      label: "Theseus",
      maxHp: 240,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.25, 0.4, 0.99],
      attack: meleeHeroAttack(9, 16, 20),
      cost: [100, 0, 50, 0],
      buildTicks: 180,
      populationCost: 2,
      requiredAge: 0,
      requiredGod: 1,
      trainedAt: [
        { type: 18, commandSlot: 1 },
        { type: 26, commandSlot: 0 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "projectile",
    id: 101,
    key: "greek-hippolyta",
    source: candidateProjectileHeroSource(
      486,
      "Hero Greek Hippolyta",
      "Hippolyta",
      "hero greek hippolyta_anim.txt",
      "be31989d114178e2fa1485cc5a0115fc3084e518a0ab27b32dff3913810072cf",
      0.6,
      [
        {
          field: "lineOfSight",
          trial: 20,
          final: 24,
          reason:
            "The shipped Classic random-map Hippolyta has 24 Line of Sight; the 2002 Trial row still has 20.",
        },
      ],
    ),
    expected: greekHeroExpected({
      label: "Hippolyta",
      maxHp: 240,
      lineOfSight: 24,
      movementSpeed: 4.3,
      armor: [0.2, 0.3, 0.99],
      attack: projectileHeroAttack({
        damage: 9,
        range: 18,
        aggroRange: 24,
        cooldownTicks: 40,
        launchDelayTicks: 24,
        trackRating: 6,
      }),
      cost: [0, 200, 0, 2],
      buildTicks: 340,
      populationCost: 2,
      requiredAge: 1,
      requiredGod: 1,
      trainedAt: [
        { type: 18, commandSlot: 2 },
        { type: 26, commandSlot: 1 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "melee",
    id: 102,
    key: "greek-atalanta",
    source: candidateHeroSource(
      490,
      "Hero Greek Atalanta",
      "Atalanta",
      "hero greek atalanta_anim.txt",
    ),
    expected: greekHeroExpected({
      label: "Atalanta",
      maxHp: 350,
      lineOfSight: 16,
      movementSpeed: 6,
      armor: [0.35, 0.4, 0.99],
      attack: meleeHeroAttack(8, 16, 28),
      cost: [0, 350, 0, 4],
      buildTicks: 460,
      populationCost: 3,
      requiredAge: 2,
      requiredGod: 1,
      trainedAt: [
        { type: 18, commandSlot: 3 },
        { type: 26, commandSlot: 2 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "melee",
    id: 104,
    key: "greek-ajax",
    source: candidateHeroSource(489, "Hero Greek Ajax", "Ajax", "hero greek ajax_anim.txt"),
    expected: greekHeroExpected({
      label: "Ajax",
      maxHp: 240,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.3, 0.35, 0.99],
      attack: meleeHeroAttack(9, 16, 20),
      cost: [100, 0, 50, 0],
      buildTicks: 180,
      populationCost: 2,
      requiredAge: 0,
      requiredGod: 2,
      trainedAt: [
        { type: 18, commandSlot: 1 },
        { type: 26, commandSlot: 0 },
      ],
    }),
  },
  {
    family: "hero",
    attackKind: "projectile",
    id: 105,
    key: "greek-chiron",
    source: candidateProjectileHeroSource(
      437,
      "Hero Greek Chiron",
      "Chiron",
      "hero greek chiron_anim.txt",
      "b48dd1ef83c1b0631c0d039cb75d7187f4b4269f5a792441f908a9a7dea8d1b2",
      0.6,
    ),
    expected: greekHeroExpected({
      label: "Chiron",
      maxHp: 300,
      lineOfSight: 20,
      movementSpeed: 5.3,
      armor: [0.2, 0.2, 0.99],
      attack: projectileHeroAttack({
        damage: 7,
        range: 14,
        aggroRange: 20,
        cooldownTicks: 30,
        launchDelayTicks: 18,
        trackRating: 5,
      }),
      cost: [0, 200, 0, 2],
      buildTicks: 340,
      populationCost: 2,
      requiredAge: 1,
      requiredGod: 2,
      trainedAt: [
        { type: 18, commandSlot: 2 },
        { type: 26, commandSlot: 1 },
      ],
    }),
  },
] as const satisfies readonly UnitReferenceSpec[];
