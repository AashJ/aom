import { TICK_HZ } from "../clock";
import type { HasCompletedBuilding } from "./availability";
import {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  AGE_HEROIC,
  AGE_MYTHIC,
  GOD_ANUBIS,
  GOD_APHRODITE,
  GOD_APOLLO,
  GOD_ARES,
  GOD_ARTEMIS,
  GOD_ATHENA,
  GOD_BAST,
  GOD_DIONYSUS,
  GOD_HADES,
  GOD_HATHOR,
  GOD_HEPHAESTUS,
  GOD_HERA,
  GOD_HERMES,
  GOD_HORUS,
  GOD_ISIS,
  GOD_NEPHTHYS,
  GOD_OSIRIS,
  GOD_POSEIDON,
  GOD_PTAH,
  GOD_RA,
  GOD_SEKHMET,
  GOD_SET,
  GOD_THOTH,
  GOD_ZEUS,
  NO_AGE,
} from "./progression";
import {
  FOOD,
  GOLD,
  RESOURCE_COUNT,
  TYPE_EGYPTIAN_ARMORY,
  TYPE_EGYPTIAN_MARKET,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GREEK_ARMORY,
  TYPE_GREEK_MARKET,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
} from "./types";

export const NO_RESEARCH = 255;
export const RESEARCH_CLASSICAL_AGE = 0;
export const RESEARCH_HEROIC_AGE = 1;
export const RESEARCH_MYTHIC_AGE = 2;

export type ResourceAmounts = readonly [food: number, wood: number, gold: number, favor: number];

export interface AgeAdvanceRule {
  readonly researchId: number;
  readonly fromAge: number;
  readonly targetAge: number;
  readonly producerTypeByMajorGod: Readonly<Record<number, number | undefined>>;
  readonly prerequisiteBuildingsByMajorGod: Readonly<Record<number, readonly number[] | undefined>>;
  readonly cost: ResourceAmounts;
  readonly durationTicks: number;
  readonly minorGodsByMajorGod: Readonly<Record<number, readonly number[] | undefined>>;
}

const GREEK_TOWN_CENTER_PRODUCERS = {
  [GOD_ZEUS]: TYPE_GREEK_TOWN_CENTER,
  [GOD_POSEIDON]: TYPE_GREEK_TOWN_CENTER,
  [GOD_HADES]: TYPE_GREEK_TOWN_CENTER,
} as const;
const EGYPTIAN_TOWN_CENTER_PRODUCERS = {
  [GOD_RA]: TYPE_EGYPTIAN_TOWN_CENTER,
  [GOD_ISIS]: TYPE_EGYPTIAN_TOWN_CENTER,
  [GOD_SET]: TYPE_EGYPTIAN_TOWN_CENTER,
} as const;
const AGE_ADVANCE_PRODUCERS = {
  ...GREEK_TOWN_CENTER_PRODUCERS,
  ...EGYPTIAN_TOWN_CENTER_PRODUCERS,
} as const;

const CLASSICAL_PREREQUISITES = {
  [GOD_ZEUS]: [TYPE_GREEK_TEMPLE],
  [GOD_POSEIDON]: [TYPE_GREEK_TEMPLE],
  [GOD_HADES]: [TYPE_GREEK_TEMPLE],
  [GOD_RA]: [TYPE_EGYPTIAN_TEMPLE],
  [GOD_ISIS]: [TYPE_EGYPTIAN_TEMPLE],
  [GOD_SET]: [TYPE_EGYPTIAN_TEMPLE],
} as const;
const HEROIC_PREREQUISITES = {
  [GOD_ZEUS]: [TYPE_GREEK_ARMORY],
  [GOD_POSEIDON]: [TYPE_GREEK_ARMORY],
  [GOD_HADES]: [TYPE_GREEK_ARMORY],
  [GOD_RA]: [TYPE_EGYPTIAN_ARMORY],
  [GOD_ISIS]: [TYPE_EGYPTIAN_ARMORY],
  [GOD_SET]: [TYPE_EGYPTIAN_ARMORY],
} as const;
const MYTHIC_PREREQUISITES = {
  [GOD_ZEUS]: [TYPE_GREEK_MARKET],
  [GOD_POSEIDON]: [TYPE_GREEK_MARKET],
  [GOD_HADES]: [TYPE_GREEK_MARKET],
  [GOD_RA]: [TYPE_EGYPTIAN_MARKET],
  [GOD_ISIS]: [TYPE_EGYPTIAN_MARKET],
  [GOD_SET]: [TYPE_EGYPTIAN_MARKET],
} as const;

const CLASSICAL_MINOR_GODS = {
  [GOD_ZEUS]: [GOD_ATHENA, GOD_HERMES],
  [GOD_POSEIDON]: [GOD_ARES, GOD_HERMES],
  [GOD_HADES]: [GOD_ATHENA, GOD_ARES],
  [GOD_RA]: [GOD_BAST, GOD_PTAH],
  [GOD_ISIS]: [GOD_ANUBIS, GOD_BAST],
  [GOD_SET]: [GOD_ANUBIS, GOD_PTAH],
} as const;
const HEROIC_MINOR_GODS = {
  [GOD_ZEUS]: [GOD_APOLLO, GOD_DIONYSUS],
  [GOD_POSEIDON]: [GOD_APHRODITE, GOD_DIONYSUS],
  [GOD_HADES]: [GOD_APOLLO, GOD_APHRODITE],
  [GOD_RA]: [GOD_HATHOR, GOD_SEKHMET],
  [GOD_ISIS]: [GOD_HATHOR, GOD_NEPHTHYS],
  [GOD_SET]: [GOD_NEPHTHYS, GOD_SEKHMET],
} as const;
const MYTHIC_MINOR_GODS = {
  [GOD_ZEUS]: [GOD_HERA, GOD_HEPHAESTUS],
  [GOD_POSEIDON]: [GOD_ARTEMIS, GOD_HEPHAESTUS],
  [GOD_HADES]: [GOD_ARTEMIS, GOD_HEPHAESTUS],
  [GOD_RA]: [GOD_HORUS, GOD_OSIRIS],
  [GOD_ISIS]: [GOD_OSIRIS, GOD_THOTH],
  [GOD_SET]: [GOD_HORUS, GOD_THOTH],
} as const;

export const CLASSICAL_AGE_ADVANCE_RULE = {
  researchId: RESEARCH_CLASSICAL_AGE,
  fromAge: AGE_ARCHAIC,
  targetAge: AGE_CLASSICAL,
  producerTypeByMajorGod: AGE_ADVANCE_PRODUCERS,
  prerequisiteBuildingsByMajorGod: CLASSICAL_PREREQUISITES,
  cost: [400, 0, 0, 0],
  // Extended Edition / The Titans: 60 seconds at the deterministic sim rate.
  durationTicks: 60 * TICK_HZ,
  minorGodsByMajorGod: CLASSICAL_MINOR_GODS,
} as const satisfies AgeAdvanceRule;

export const HEROIC_AGE_ADVANCE_RULE = {
  researchId: RESEARCH_HEROIC_AGE,
  fromAge: AGE_CLASSICAL,
  targetAge: AGE_HEROIC,
  producerTypeByMajorGod: AGE_ADVANCE_PRODUCERS,
  prerequisiteBuildingsByMajorGod: HEROIC_PREREQUISITES,
  cost: [800, 0, 500, 0],
  durationTicks: 75 * TICK_HZ,
  minorGodsByMajorGod: HEROIC_MINOR_GODS,
} as const satisfies AgeAdvanceRule;

export const MYTHIC_AGE_ADVANCE_RULE = {
  researchId: RESEARCH_MYTHIC_AGE,
  fromAge: AGE_HEROIC,
  targetAge: AGE_MYTHIC,
  producerTypeByMajorGod: AGE_ADVANCE_PRODUCERS,
  prerequisiteBuildingsByMajorGod: MYTHIC_PREREQUISITES,
  cost: [1_000, 0, 1_000, 0],
  durationTicks: 90 * TICK_HZ,
  minorGodsByMajorGod: MYTHIC_MINOR_GODS,
} as const satisfies AgeAdvanceRule;

export const CLASSICAL_AGE_COST_FOOD = CLASSICAL_AGE_ADVANCE_RULE.cost[FOOD];
export const CLASSICAL_AGE_ADVANCE_TICKS = CLASSICAL_AGE_ADVANCE_RULE.durationTicks;
export const HEROIC_AGE_COST_FOOD = HEROIC_AGE_ADVANCE_RULE.cost[FOOD];
export const HEROIC_AGE_COST_GOLD = HEROIC_AGE_ADVANCE_RULE.cost[GOLD];
export const HEROIC_AGE_ADVANCE_TICKS = HEROIC_AGE_ADVANCE_RULE.durationTicks;
export const MYTHIC_AGE_COST_FOOD = MYTHIC_AGE_ADVANCE_RULE.cost[FOOD];
export const MYTHIC_AGE_COST_GOLD = MYTHIC_AGE_ADVANCE_RULE.cost[GOLD];
export const MYTHIC_AGE_ADVANCE_TICKS = MYTHIC_AGE_ADVANCE_RULE.durationTicks;

const AGE_ADVANCE_RULES: readonly AgeAdvanceRule[] = [
  CLASSICAL_AGE_ADVANCE_RULE,
  HEROIC_AGE_ADVANCE_RULE,
  MYTHIC_AGE_ADVANCE_RULE,
];
const NO_MINOR_GODS: readonly number[] = [];

export type AgeAdvanceAvailability =
  | {
      readonly available: true;
      readonly rule: AgeAdvanceRule;
      readonly minorGods: readonly number[];
    }
  | { readonly available: false; readonly reason: "max-age" }
  | { readonly available: false; readonly reason: "in-progress"; readonly rule: AgeAdvanceRule }
  | { readonly available: false; readonly reason: "minor-god"; readonly rule: AgeAdvanceRule }
  | {
      readonly available: false;
      readonly reason: "building";
      readonly rule: AgeAdvanceRule;
      readonly buildingType: number;
    }
  | {
      readonly available: false;
      readonly reason: "resource";
      readonly rule: AgeAdvanceRule;
      readonly resource: number;
      readonly required: number;
    };

export interface AgeAdvanceAvailabilityState {
  readonly age: number;
  readonly majorGod: number;
  readonly activeTargetAge: number;
  readonly resources: ResourceAmounts;
  readonly hasCompletedBuilding: HasCompletedBuilding;
}

export function getNextAgeAdvanceRule(currentAge: number): AgeAdvanceRule | undefined {
  for (let index = 0; index < AGE_ADVANCE_RULES.length; index += 1) {
    if (AGE_ADVANCE_RULES[index]!.fromAge === currentAge) {
      return AGE_ADVANCE_RULES[index];
    }
  }

  return undefined;
}

export function getAgeAdvanceRuleByResearchId(researchId: number): AgeAdvanceRule | undefined {
  for (let index = 0; index < AGE_ADVANCE_RULES.length; index += 1) {
    if (AGE_ADVANCE_RULES[index]!.researchId === researchId) {
      return AGE_ADVANCE_RULES[index];
    }
  }

  return undefined;
}

export function getMinorGodsForAgeAdvance(
  rule: AgeAdvanceRule,
  majorGod: number,
): readonly number[] {
  return rule.minorGodsByMajorGod[majorGod] ?? NO_MINOR_GODS;
}

export function getAgeAdvanceProducerType(
  rule: AgeAdvanceRule,
  majorGod: number,
): number | undefined {
  return rule.producerTypeByMajorGod[majorGod];
}

export function getAgeAdvancePrerequisiteBuildings(
  rule: AgeAdvanceRule,
  majorGod: number,
): readonly number[] {
  return rule.prerequisiteBuildingsByMajorGod[majorGod] ?? [];
}

export function isMinorGodAvailableForAgeAdvance(
  rule: AgeAdvanceRule,
  majorGod: number,
  minorGod: number,
): boolean {
  const minorGods = getMinorGodsForAgeAdvance(rule, majorGod);

  for (let index = 0; index < minorGods.length; index += 1) {
    if (minorGods[index] === minorGod) {
      return true;
    }
  }

  return false;
}

export function getAgeAdvanceAvailability(
  state: AgeAdvanceAvailabilityState,
): AgeAdvanceAvailability {
  const rule = getNextAgeAdvanceRule(state.age);

  if (!rule) {
    return { available: false, reason: "max-age" };
  }

  if (state.activeTargetAge !== NO_AGE) {
    return { available: false, reason: "in-progress", rule };
  }

  const minorGods = getMinorGodsForAgeAdvance(rule, state.majorGod);

  if (minorGods.length === 0) {
    return { available: false, reason: "minor-god", rule };
  }

  const prerequisiteBuildings = getAgeAdvancePrerequisiteBuildings(rule, state.majorGod);

  for (let index = 0; index < prerequisiteBuildings.length; index += 1) {
    const buildingType = prerequisiteBuildings[index]!;

    if (!state.hasCompletedBuilding(buildingType)) {
      return { available: false, reason: "building", rule, buildingType };
    }
  }

  for (let resource = 0; resource < RESOURCE_COUNT; resource += 1) {
    if (state.resources[resource]! < rule.cost[resource]!) {
      return {
        available: false,
        reason: "resource",
        rule,
        resource,
        required: rule.cost[resource]!,
      };
    }
  }

  return { available: true, rule, minorGods };
}
