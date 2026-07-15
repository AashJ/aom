import { TICK_HZ } from "../clock";
import type { HasCompletedBuilding } from "./availability";
import {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  GOD_ATHENA,
  GOD_BAST,
  GOD_HADES,
  GOD_HERMES,
  GOD_ISIS,
  GOD_POSEIDON,
  GOD_PTAH,
  GOD_RA,
  GOD_SET,
  GOD_ZEUS,
  NO_AGE,
} from "./progression";
import {
  FOOD,
  RESOURCE_COUNT,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
} from "./types";

export const NO_RESEARCH = 255;
export const RESEARCH_CLASSICAL_AGE = 0;

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

const ZEUS_CLASSICAL_MINOR_GODS = [GOD_ATHENA, GOD_HERMES] as const;
const RA_CLASSICAL_MINOR_GODS = [GOD_BAST, GOD_PTAH] as const;

export const CLASSICAL_AGE_ADVANCE_RULE = {
  researchId: RESEARCH_CLASSICAL_AGE,
  fromAge: AGE_ARCHAIC,
  targetAge: AGE_CLASSICAL,
  producerTypeByMajorGod: {
    [GOD_ZEUS]: TYPE_GREEK_TOWN_CENTER,
    [GOD_POSEIDON]: TYPE_GREEK_TOWN_CENTER,
    [GOD_HADES]: TYPE_GREEK_TOWN_CENTER,
    [GOD_RA]: TYPE_EGYPTIAN_TOWN_CENTER,
    [GOD_ISIS]: TYPE_EGYPTIAN_TOWN_CENTER,
    [GOD_SET]: TYPE_EGYPTIAN_TOWN_CENTER,
  },
  prerequisiteBuildingsByMajorGod: {
    [GOD_ZEUS]: [TYPE_GREEK_TEMPLE],
    [GOD_POSEIDON]: [TYPE_GREEK_TEMPLE],
    [GOD_HADES]: [TYPE_GREEK_TEMPLE],
    [GOD_RA]: [TYPE_EGYPTIAN_TEMPLE],
    [GOD_ISIS]: [TYPE_EGYPTIAN_TEMPLE],
    [GOD_SET]: [TYPE_EGYPTIAN_TEMPLE],
  },
  cost: [400, 0, 0, 0],
  // Extended Edition / The Titans: 60 seconds at the deterministic sim rate.
  durationTicks: 60 * TICK_HZ,
  minorGodsByMajorGod: {
    [GOD_ZEUS]: ZEUS_CLASSICAL_MINOR_GODS,
    [GOD_RA]: RA_CLASSICAL_MINOR_GODS,
  },
} as const satisfies AgeAdvanceRule;

export const CLASSICAL_AGE_COST_FOOD = CLASSICAL_AGE_ADVANCE_RULE.cost[FOOD];
export const CLASSICAL_AGE_ADVANCE_TICKS = CLASSICAL_AGE_ADVANCE_RULE.durationTicks;

const AGE_ADVANCE_RULES: readonly AgeAdvanceRule[] = [CLASSICAL_AGE_ADVANCE_RULE];
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
