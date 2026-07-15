import {
  getAgeAdvanceAvailability,
  getAgeAdvanceRuleByResearchId,
  isMinorGodAvailableForAgeAdvance,
  NO_RESEARCH,
  type AgeAdvanceRule,
  type ResourceAmounts,
} from "./age-advancement";
import { hasCompletedBuilding } from "./availability";
import { AGE_COUNT, NO_AGE, NO_GOD } from "./progression";
import { FAVOR, FOOD, GOLD, RESOURCE_COUNT, UNIT_TYPES, WOOD } from "./types";
import type { World } from "./world";

function activeAgeAdvanceRule(world: World, building: number): AgeAdvanceRule | undefined {
  const researchId = world.researchId[building]!;

  if (researchId === NO_RESEARCH) {
    return undefined;
  }

  const rule = getAgeAdvanceRuleByResearchId(researchId);

  if (!rule) {
    throw new RangeError(`Unknown research id ${researchId}.`);
  }

  return rule;
}

function clearBuildingResearch(world: World, building: number): void {
  world.researchId[building] = NO_RESEARCH;
  world.researchChoice[building] = NO_GOD;
  world.researchRemaining[building] = 0;
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
  const producer = UNIT_TYPES[rule.producerType]!;

  if (
    world.dying[building] === 1 ||
    world.hp[building] === 0 ||
    world.owner[building] !== playerId ||
    world.unitType[building] !== rule.producerType ||
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
  const rule = activeAgeAdvanceRule(world, building);

  if (!rule) {
    return false;
  }

  if (world.dying[building] === 1 || world.hp[building] === 0) {
    return true;
  }

  if (world.researchRemaining[building]! > 0) {
    world.researchRemaining[building] = world.researchRemaining[building]! - 1;
  }

  if (world.researchRemaining[building] !== 0) {
    return true;
  }

  const playerId = world.owner[building]!;
  const minorGod = world.researchChoice[building]!;

  world.playerAge[playerId] = rule.targetAge;
  world.playerMinorGods[playerId * AGE_COUNT + rule.targetAge] = minorGod;
  clearBuildingResearch(world, building);
  return false;
}

export function cancelBuildingResearch(world: World, building: number): void {
  const rule = activeAgeAdvanceRule(world, building);

  if (!rule) {
    return;
  }

  const resourceStart = world.owner[building]! * RESOURCE_COUNT;

  for (let resource = 0; resource < RESOURCE_COUNT; resource += 1) {
    world.stockpiles[resourceStart + resource] = Math.min(
      0xffffffff,
      world.stockpiles[resourceStart + resource]! + rule.cost[resource]!,
    );
  }

  clearBuildingResearch(world, building);
}
