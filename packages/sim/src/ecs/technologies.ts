import { TICK_HZ } from "../clock";
import { CULTURE_EGYPTIAN, CULTURE_GREEK } from "../content/unit-type-schema";
import {
  TYPE_EGYPTIAN_GATE,
  TYPE_EGYPTIAN_TOWER,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_EGYPTIAN_WALL_CONNECTOR,
  TYPE_EGYPTIAN_WALL_LONG,
  TYPE_EGYPTIAN_WALL_MEDIUM,
  TYPE_EGYPTIAN_WALL_SHORT,
  TYPE_GREEK_GATE,
  TYPE_GREEK_TOWER,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_WALL_CONNECTOR,
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_WALL_MEDIUM,
  TYPE_GREEK_WALL_SHORT,
} from "../content/unit-type-ids";
import { AGE_CLASSICAL, AGE_HEROIC, AGE_MYTHIC, GOD_ISIS } from "./progression";
import { RESOURCE_COUNT, type UnitTypeStats } from "./types";
import type { ResourceAmounts } from "./age-advancement";

export const PLAYER_RESEARCH_STRIDE = 64;

export const RESEARCH_WATCH_TOWER = 16;
export const RESEARCH_GUARD_TOWER = 17;
export const RESEARCH_BALLISTA_TOWER = 18;
export const RESEARCH_STONE_WALL = 19;
export const RESEARCH_FORTIFIED_WALL = 20;
export const RESEARCH_CITADEL_WALL = 21;
export const RESEARCH_MASONS = 22;
export const RESEARCH_ARCHITECTS = 23;
export const RESEARCH_FORTIFIED_TOWN_CENTER = 24;
export const RESEARCH_SIGNAL_FIRES = 25;
export const RESEARCH_CARRIER_PIGEONS = 26;
export const RESEARCH_CRENELLATIONS = 27;
export const RESEARCH_BOILING_OIL = 28;

export interface TechnologyDefinition {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly requiredAge: number;
  readonly cultures: readonly number[];
  readonly producerTypes: readonly number[];
  readonly cost: ResourceAmounts;
  readonly durationTicks: number;
  readonly prerequisiteResearch: readonly number[];
  readonly commandSlot: number;
}

const BOTH_CULTURES = [CULTURE_GREEK, CULTURE_EGYPTIAN] as const;
const GREEK_ONLY = [CULTURE_GREEK] as const;
const EGYPTIAN_ONLY = [CULTURE_EGYPTIAN] as const;
const NO_RESEARCH_PREREQUISITES: readonly number[] = [];
const TOWERS = [TYPE_GREEK_TOWER, TYPE_EGYPTIAN_TOWER] as const;
const TOWN_CENTERS = [TYPE_GREEK_TOWN_CENTER, TYPE_EGYPTIAN_TOWN_CENTER] as const;
const WALLS = [
  TYPE_GREEK_WALL_CONNECTOR,
  TYPE_GREEK_WALL_SHORT,
  TYPE_GREEK_WALL_MEDIUM,
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_GATE,
  TYPE_EGYPTIAN_WALL_CONNECTOR,
  TYPE_EGYPTIAN_WALL_SHORT,
  TYPE_EGYPTIAN_WALL_MEDIUM,
  TYPE_EGYPTIAN_WALL_LONG,
  TYPE_EGYPTIAN_GATE,
] as const;

export const TECHNOLOGIES: readonly TechnologyDefinition[] = [
  {
    id: RESEARCH_WATCH_TOWER,
    key: "watch-tower",
    label: "Watch Tower",
    requiredAge: AGE_CLASSICAL,
    cultures: GREEK_ONLY,
    producerTypes: [TYPE_GREEK_TOWER],
    cost: [0, 200, 100, 0],
    durationTicks: 20 * TICK_HZ,
    prerequisiteResearch: NO_RESEARCH_PREREQUISITES,
    commandSlot: 0,
  },
  {
    id: RESEARCH_GUARD_TOWER,
    key: "guard-tower",
    label: "Guard Tower",
    requiredAge: AGE_HEROIC,
    cultures: BOTH_CULTURES,
    producerTypes: TOWERS,
    cost: [0, 300, 300, 0],
    durationTicks: 40 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_WATCH_TOWER],
    commandSlot: 1,
  },
  {
    id: RESEARCH_BALLISTA_TOWER,
    key: "ballista-tower",
    label: "Ballista Tower",
    requiredAge: AGE_MYTHIC,
    cultures: EGYPTIAN_ONLY,
    producerTypes: [TYPE_EGYPTIAN_TOWER],
    cost: [500, 800, 0, 0],
    durationTicks: 40 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_GUARD_TOWER],
    commandSlot: 2,
  },
  {
    id: RESEARCH_STONE_WALL,
    key: "stone-wall",
    label: "Stone Wall",
    requiredAge: AGE_CLASSICAL,
    cultures: BOTH_CULTURES,
    producerTypes: WALLS,
    cost: [200, 0, 200, 0],
    durationTicks: 40 * TICK_HZ,
    prerequisiteResearch: NO_RESEARCH_PREREQUISITES,
    commandSlot: 0,
  },
  {
    id: RESEARCH_FORTIFIED_WALL,
    key: "fortified-wall",
    label: "Fortified Wall",
    requiredAge: AGE_HEROIC,
    cultures: BOTH_CULTURES,
    producerTypes: WALLS,
    cost: [500, 0, 400, 0],
    durationTicks: 50 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_STONE_WALL],
    commandSlot: 1,
  },
  {
    id: RESEARCH_CITADEL_WALL,
    key: "citadel-wall",
    label: "Citadel Wall",
    requiredAge: AGE_MYTHIC,
    cultures: EGYPTIAN_ONLY,
    producerTypes: [
      TYPE_EGYPTIAN_WALL_CONNECTOR,
      TYPE_EGYPTIAN_WALL_SHORT,
      TYPE_EGYPTIAN_WALL_MEDIUM,
      TYPE_EGYPTIAN_WALL_LONG,
      TYPE_EGYPTIAN_GATE,
    ],
    cost: [800, 0, 500, 0],
    durationTicks: 50 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_FORTIFIED_WALL],
    commandSlot: 2,
  },
  {
    id: RESEARCH_MASONS,
    key: "masons",
    label: "Masons",
    requiredAge: AGE_CLASSICAL,
    cultures: BOTH_CULTURES,
    producerTypes: TOWN_CENTERS,
    cost: [200, 300, 0, 0],
    durationTicks: 20 * TICK_HZ,
    prerequisiteResearch: NO_RESEARCH_PREREQUISITES,
    commandSlot: 4,
  },
  {
    id: RESEARCH_ARCHITECTS,
    key: "architects",
    label: "Architects",
    requiredAge: AGE_HEROIC,
    cultures: BOTH_CULTURES,
    producerTypes: TOWN_CENTERS,
    cost: [400, 500, 0, 0],
    durationTicks: 30 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_MASONS],
    commandSlot: 5,
  },
  {
    id: RESEARCH_FORTIFIED_TOWN_CENTER,
    key: "fortified-town-center",
    label: "Fortified Town Center",
    requiredAge: AGE_HEROIC,
    cultures: BOTH_CULTURES,
    producerTypes: TOWN_CENTERS,
    cost: [0, 400, 400, 0],
    durationTicks: 60 * TICK_HZ,
    prerequisiteResearch: NO_RESEARCH_PREREQUISITES,
    commandSlot: 6,
  },
  {
    id: RESEARCH_SIGNAL_FIRES,
    key: "signal-fires",
    label: "Signal Fires",
    requiredAge: AGE_CLASSICAL,
    cultures: BOTH_CULTURES,
    producerTypes: TOWERS,
    cost: [0, 150, 0, 0],
    durationTicks: 30 * TICK_HZ,
    prerequisiteResearch: NO_RESEARCH_PREREQUISITES,
    commandSlot: 4,
  },
  {
    id: RESEARCH_CARRIER_PIGEONS,
    key: "carrier-pigeons",
    label: "Carrier Pigeons",
    requiredAge: AGE_HEROIC,
    cultures: BOTH_CULTURES,
    producerTypes: TOWERS,
    cost: [0, 400, 0, 0],
    durationTicks: 45 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_SIGNAL_FIRES],
    commandSlot: 5,
  },
  {
    id: RESEARCH_CRENELLATIONS,
    key: "crenellations",
    label: "Crenellations",
    requiredAge: AGE_CLASSICAL,
    cultures: BOTH_CULTURES,
    producerTypes: TOWERS,
    cost: [150, 150, 0, 0],
    durationTicks: 20 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_WATCH_TOWER],
    commandSlot: 6,
  },
  {
    id: RESEARCH_BOILING_OIL,
    key: "boiling-oil",
    label: "Boiling Oil",
    requiredAge: AGE_HEROIC,
    cultures: BOTH_CULTURES,
    producerTypes: TOWERS,
    cost: [100, 300, 0, 0],
    durationTicks: 40 * TICK_HZ,
    prerequisiteResearch: [RESEARCH_WATCH_TOWER],
    commandSlot: 7,
  },
];

const TECHNOLOGY_BY_ID = new Map(TECHNOLOGIES.map((technology) => [technology.id, technology]));

export function getTechnology(researchId: number): TechnologyDefinition | undefined {
  return TECHNOLOGY_BY_ID.get(researchId);
}

export function hasTechnology(
  playerResearch: Uint8Array,
  playerId: number,
  researchId: number,
): boolean {
  return playerResearch[playerId * PLAYER_RESEARCH_STRIDE + researchId] === 1;
}

export function setTechnology(
  playerResearch: Uint8Array,
  playerId: number,
  researchId: number,
): void {
  playerResearch[playerId * PLAYER_RESEARCH_STRIDE + researchId] = 1;
}

export function technologyCost(
  technology: TechnologyDefinition,
  majorGod: number,
): ResourceAmounts {
  if (majorGod !== GOD_ISIS) return technology.cost;
  return technology.cost.map((amount, resource) =>
    resource < RESOURCE_COUNT - 1 ? Math.floor(amount * 0.9) : amount,
  ) as unknown as ResourceAmounts;
}

export function technologyAppliesToCulture(
  technology: TechnologyDefinition,
  culture: number,
): boolean {
  return technology.cultures.includes(culture);
}

export function technologyCanBeResearchedAt(
  technology: TechnologyDefinition,
  producerType: number,
): boolean {
  return technology.producerTypes.includes(producerType);
}

export function technologyOptionsForProducer(
  producerType: number,
  culture: number,
): readonly TechnologyDefinition[] {
  return TECHNOLOGIES.filter(
    (technology) =>
      technologyCanBeResearchedAt(technology, producerType) &&
      technologyAppliesToCulture(technology, culture),
  );
}

export function isBuildingType(stats: UnitTypeStats): boolean {
  return stats.footprint > 0;
}
