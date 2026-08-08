import {
  getAgeAdvanceAvailability,
  getAgeAdvanceProducerType,
  getAgeAdvanceRuleByResearchId,
  isMinorGodAvailableForAgeAdvance,
  NO_RESEARCH,
  type AgeAdvanceRule,
  type ResourceAmounts,
} from "./age-advancement";
import { hasCompletedBuilding } from "./availability";
import { cultureForMajorGod } from "../content/culture-types";
import { CULTURE_EGYPTIAN } from "../content/unit-type-schema";
import { AGE_COUNT, NO_AGE, NO_GOD } from "./progression";
import { FAVOR, FOOD, GOLD, RESOURCE_COUNT, UNIT_TYPES, WOOD } from "./types";
import { empowermentAt } from "./support-actions";
import { effectiveMaxHp } from "./unit-age";
import { effectiveMaxHpForPlayer, playerHasTechnology } from "./building-technology-effects";
import {
  getTechnology,
  RESEARCH_WATCH_TOWER,
  setTechnology,
  technologyAppliesToCulture,
  technologyCanBeResearchedAt,
  technologyCost,
  type TechnologyDefinition,
} from "./technologies";
import type { World } from "./world";

type ActiveResearch =
  | { readonly kind: "age"; readonly definition: AgeAdvanceRule }
  | { readonly kind: "technology"; readonly definition: TechnologyDefinition };

function activeResearch(world: World, building: number): ActiveResearch | undefined {
  const researchId = world.researchId[building]!;

  if (researchId === NO_RESEARCH) {
    return undefined;
  }

  const ageRule = getAgeAdvanceRuleByResearchId(researchId);

  if (ageRule) {
    return { kind: "age", definition: ageRule };
  }

  const technology = getTechnology(researchId);

  if (!technology) {
    throw new RangeError(`Unknown research id ${researchId}.`);
  }

  return { kind: "technology", definition: technology };
}

function activeAgeAdvanceRule(world: World, building: number): AgeAdvanceRule | undefined {
  const active = activeResearch(world, building);
  return active?.kind === "age" ? active.definition : undefined;
}

function clearBuildingResearch(world: World, building: number): void {
  world.researchId[building] = NO_RESEARCH;
  world.researchChoice[building] = NO_GOD;
  world.researchRemaining[building] = 0;
  world.empowerResearchProgress[building] = 0;
}

function playerResources(world: World, playerId: number): ResourceAmounts {
  const start = playerId * RESOURCE_COUNT;

  return [
    world.stockpiles[start + FOOD]!,
    world.stockpiles[start + WOOD]!,
    world.stockpiles[start + GOLD]!,
    world.stockpiles[start + FAVOR]!,
  ];
}

export function findAgeAdvanceResearch(world: World, playerId: number): number {
  for (let building = 0; building < world.count; building += 1) {
    if (world.owner[building] === playerId && activeAgeAdvanceRule(world, building)) {
      return building;
    }
  }

  return -1;
}

export function isBuildingResearching(world: World, building: number): boolean {
  return world.researchId[building] !== NO_RESEARCH;
}

export function findTechnologyResearch(world: World, playerId: number, researchId: number): number {
  for (let building = 0; building < world.count; building += 1) {
    if (
      world.owner[building] === playerId &&
      world.researchId[building] === researchId &&
      activeResearch(world, building)?.kind === "technology"
    ) {
      return building;
    }
  }

  return -1;
}

export function tryStartTechnology(
  world: World,
  playerId: number,
  building: number,
  researchId: number,
): boolean {
  const technology = getTechnology(researchId);
  if (
    !technology ||
    playerId < 0 ||
    playerId >= world.playerSlotById.length ||
    world.playerSlotById[playerId] === -1 ||
    building < 0 ||
    building >= world.count ||
    world.dying[building] === 1 ||
    world.hp[building] === 0 ||
    world.owner[building] !== playerId ||
    isBuildingResearching(world, building) ||
    playerHasTechnology(world, playerId, researchId) ||
    findTechnologyResearch(world, playerId, researchId) >= 0
  ) {
    return false;
  }

  const buildingType = world.unitType[building]!;
  const buildingStats = UNIT_TYPES[buildingType]!;
  const culture = cultureForMajorGod(world.playerMajorGod[playerId]!);
  if (
    world.buildProgress[building]! < buildingStats.buildTicks ||
    world.playerAge[playerId]! < technology.requiredAge ||
    !technologyAppliesToCulture(technology, culture) ||
    !technologyCanBeResearchedAt(technology, buildingType)
  ) {
    return false;
  }

  for (const prerequisite of technology.prerequisiteResearch) {
    if (!playerHasTechnology(world, playerId, prerequisite)) return false;
  }

  const cost = technologyCost(technology, world.playerMajorGod[playerId]!);
  const resourceStart = playerId * RESOURCE_COUNT;
  for (let resource = 0; resource < RESOURCE_COUNT; resource += 1) {
    if (world.stockpiles[resourceStart + resource]! < cost[resource]!) return false;
  }
  for (let resource = 0; resource < RESOURCE_COUNT; resource += 1) {
    world.stockpiles[resourceStart + resource] =
      world.stockpiles[resourceStart + resource]! - cost[resource]!;
  }

  world.researchId[building] = technology.id;
  world.researchChoice[building] = NO_GOD;
  world.researchRemaining[building] = technology.durationTicks;
  return true;
}

export function tryStartAgeAdvance(
  world: World,
  playerId: number,
  building: number,
  minorGod: number,
): boolean {
  if (
    playerId < 0 ||
    playerId >= world.playerSlotById.length ||
    world.playerSlotById[playerId] === -1 ||
    building < 0
  ) {
    return false;
  }

  const activeBuilding = findAgeAdvanceResearch(world, playerId);
  const activeRule = activeBuilding >= 0 ? activeAgeAdvanceRule(world, activeBuilding) : undefined;
  const availability = getAgeAdvanceAvailability({
    age: world.playerAge[playerId]!,
    majorGod: world.playerMajorGod[playerId]!,
    activeTargetAge: activeRule?.targetAge ?? NO_AGE,
    resources: playerResources(world, playerId),
    hasCompletedBuilding: (buildingType) => hasCompletedBuilding(world, playerId, buildingType),
  });

  if (
    !availability.available ||
    !isMinorGodAvailableForAgeAdvance(availability.rule, world.playerMajorGod[playerId]!, minorGod)
  ) {
    return false;
  }

  const rule = availability.rule;
  const producerType = getAgeAdvanceProducerType(rule, world.playerMajorGod[playerId]!);
  const producer = producerType === undefined ? undefined : UNIT_TYPES[producerType];

  if (
    producer === undefined ||
    world.dying[building] === 1 ||
    world.hp[building] === 0 ||
    world.owner[building] !== playerId ||
    world.unitType[building] !== producerType ||
    world.buildProgress[building]! < producer.buildTicks ||
    isBuildingResearching(world, building)
  ) {
    return false;
  }

  const resourceStart = playerId * RESOURCE_COUNT;

  for (let resource = 0; resource < RESOURCE_COUNT; resource += 1) {
    world.stockpiles[resourceStart + resource] =
      world.stockpiles[resourceStart + resource]! - rule.cost[resource]!;
  }

  world.researchId[building] = rule.researchId;
  world.researchChoice[building] = minorGod;
  world.researchRemaining[building] = rule.durationTicks;
  return true;
}

// Returns true while research still occupies the building. Completing research
// returns false so an existing unit queue resumes later in the same production tick.
export function tickBuildingResearch(world: World, building: number): boolean {
  const active = activeResearch(world, building);

  if (!active) {
    return false;
  }

  if (world.dying[building] === 1 || world.hp[building] === 0) {
    return true;
  }

  if (world.researchRemaining[building]! > 0) {
    const researchWork = empowermentAt(world, building)?.trainWorkMultiplier ?? 1;
    world.empowerResearchProgress[building] =
      world.empowerResearchProgress[building]! + researchWork;
    const completedWork = Math.floor(world.empowerResearchProgress[building]!);
    world.empowerResearchProgress[building] =
      world.empowerResearchProgress[building]! - completedWork;
    world.researchRemaining[building] = Math.max(
      0,
      world.researchRemaining[building]! - completedWork,
    );
  }

  if (world.researchRemaining[building] !== 0) {
    return true;
  }

  const playerId = world.owner[building]!;

  if (active.kind === "technology") {
    const oldMaxHp = new Float64Array(world.count);
    for (let unit = 0; unit < world.count; unit += 1) {
      if (world.owner[unit] === playerId && world.dying[unit] === 0 && world.hp[unit]! > 0) {
        oldMaxHp[unit] = effectiveMaxHpForPlayer(
          world,
          playerId,
          UNIT_TYPES[world.unitType[unit]!]!,
        );
      }
    }
    setTechnology(world.playerResearch, playerId, active.definition.id);
    for (let unit = 0; unit < world.count; unit += 1) {
      if (oldMaxHp[unit]! <= 0) continue;
      const nextMaxHp = effectiveMaxHpForPlayer(
        world,
        playerId,
        UNIT_TYPES[world.unitType[unit]!]!,
      );
      if (nextMaxHp !== oldMaxHp[unit]) {
        world.hp[unit] = (world.hp[unit]! / oldMaxHp[unit]!) * nextMaxHp;
      }
    }
    clearBuildingResearch(world, building);
    return false;
  }

  const rule = active.definition;
  const minorGod = world.researchChoice[building]!;
  const oldAge = world.playerAge[playerId]!;

  for (let unit = 0; unit < world.count; unit += 1) {
    if (world.owner[unit] !== playerId || world.dying[unit] === 1 || world.hp[unit]! <= 0) continue;
    const stats = UNIT_TYPES[world.unitType[unit]!]!;
    const oldMaxHp = effectiveMaxHp(stats, oldAge);
    const newMaxHp = effectiveMaxHp(stats, rule.targetAge);
    if (newMaxHp !== oldMaxHp) world.hp[unit] = (world.hp[unit]! / oldMaxHp) * newMaxHp;
  }

  world.playerAge[playerId] = rule.targetAge;
  world.playerMinorGods[playerId * AGE_COUNT + rule.targetAge] = minorGod;
  if (
    rule.targetAge >= 1 &&
    cultureForMajorGod(world.playerMajorGod[playerId]!) === CULTURE_EGYPTIAN
  ) {
    setTechnology(world.playerResearch, playerId, RESEARCH_WATCH_TOWER);
  }
  clearBuildingResearch(world, building);
  return false;
}

export function cancelBuildingResearch(world: World, building: number): void {
  const active = activeResearch(world, building);

  if (!active) {
    return;
  }

  const playerId = world.owner[building]!;
  const cost =
    active.kind === "age"
      ? active.definition.cost
      : technologyCost(active.definition, world.playerMajorGod[playerId]!);
  const resourceStart = playerId * RESOURCE_COUNT;

  for (let resource = 0; resource < RESOURCE_COUNT; resource += 1) {
    world.stockpiles[resourceStart + resource] = Math.min(
      0xffffffff,
      world.stockpiles[resourceStart + resource]! + cost[resource]!,
    );
  }

  clearBuildingResearch(world, building);
}
