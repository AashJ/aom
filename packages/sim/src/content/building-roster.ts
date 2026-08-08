import {
  TYPE_EGYPTIAN_ARMORY,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_DOCK,
  TYPE_EGYPTIAN_FARM,
  TYPE_EGYPTIAN_GATE,
  TYPE_EGYPTIAN_GRANARY,
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_LIGHTHOUSE,
  TYPE_EGYPTIAN_LUMBER_CAMP,
  TYPE_EGYPTIAN_MARKET,
  TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
  TYPE_EGYPTIAN_MINING_CAMP,
  TYPE_EGYPTIAN_MONUMENT_TO_GODS,
  TYPE_EGYPTIAN_MONUMENT_TO_PHARAOHS,
  TYPE_EGYPTIAN_MONUMENT_TO_PRIESTS,
  TYPE_EGYPTIAN_MONUMENT_TO_SOLDIERS,
  TYPE_EGYPTIAN_MONUMENT_TO_VILLAGERS,
  TYPE_EGYPTIAN_OUTPOST,
  TYPE_EGYPTIAN_SIEGE_WORKS,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWER,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_EGYPTIAN_WALL_CONNECTOR,
  TYPE_EGYPTIAN_WALL_LONG,
  TYPE_EGYPTIAN_WALL_MEDIUM,
  TYPE_EGYPTIAN_WALL_SHORT,
  TYPE_EGYPTIAN_WONDER,
  TYPE_GREEK_ARCHERY_RANGE,
  TYPE_GREEK_ARMORY,
  TYPE_GREEK_DOCK,
  TYPE_GREEK_FARM,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_GATE,
  TYPE_GREEK_GRANARY,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_MARKET,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_STABLE,
  TYPE_GREEK_STOREHOUSE,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWER,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_WALL_CONNECTOR,
  TYPE_GREEK_WALL_LONG,
  TYPE_GREEK_WALL_MEDIUM,
  TYPE_GREEK_WALL_SHORT,
  TYPE_GREEK_WONDER,
} from "./unit-type-ids";
import { CULTURE_EGYPTIAN, CULTURE_GREEK } from "./unit-type-schema";

export interface ClassicBuildingRosterEntry {
  readonly id: number;
  readonly protoName: string;
  readonly culture: typeof CULTURE_GREEK | typeof CULTURE_EGYPTIAN;
}

function greek(id: number, protoName: string): ClassicBuildingRosterEntry {
  return { id, protoName, culture: CULTURE_GREEK };
}

function egyptian(id: number, protoName: string): ClassicBuildingRosterEntry {
  return { id, protoName, culture: CULTURE_EGYPTIAN };
}

// Complete playable building roster from the Classic proto database. Wall
// connector/short/medium/long/gate rows are distinct authored identities.
export const GREEK_BUILDING_ROSTER = [
  greek(TYPE_GREEK_TOWN_CENTER, "Settlement Level 1"),
  greek(TYPE_GREEK_HOUSE, "House"),
  greek(TYPE_GREEK_GRANARY, "Granary"),
  greek(TYPE_GREEK_STOREHOUSE, "Storehouse"),
  greek(TYPE_GREEK_DOCK, "Dock"),
  greek(TYPE_GREEK_TEMPLE, "Temple"),
  greek(TYPE_GREEK_WALL_CONNECTOR, "Wall Connector"),
  greek(TYPE_GREEK_WALL_SHORT, "Wall Short"),
  greek(TYPE_GREEK_WALL_MEDIUM, "Wall Medium"),
  greek(TYPE_GREEK_WALL_LONG, "Wall Long"),
  greek(TYPE_GREEK_GATE, "Gate"),
  greek(TYPE_GREEK_FARM, "Farm"),
  greek(TYPE_GREEK_ARMORY, "Armory"),
  greek(TYPE_GREEK_MILITARY_ACADEMY, "Academy"),
  greek(TYPE_GREEK_ARCHERY_RANGE, "Archery Range"),
  greek(TYPE_GREEK_STABLE, "Stable"),
  greek(TYPE_GREEK_TOWER, "Tower"),
  greek(TYPE_GREEK_FORTRESS, "Fortress"),
  greek(TYPE_GREEK_MARKET, "Market"),
  greek(TYPE_GREEK_WONDER, "Wonder"),
] as const;

export const EGYPTIAN_BUILDING_ROSTER = [
  egyptian(TYPE_EGYPTIAN_TOWN_CENTER, "Settlement Level 1"),
  egyptian(TYPE_EGYPTIAN_HOUSE, "House"),
  egyptian(TYPE_EGYPTIAN_GRANARY, "Granary"),
  egyptian(TYPE_EGYPTIAN_LUMBER_CAMP, "Lumber Camp"),
  egyptian(TYPE_EGYPTIAN_MINING_CAMP, "Mining Camp"),
  egyptian(TYPE_EGYPTIAN_DOCK, "Dock"),
  egyptian(TYPE_EGYPTIAN_TEMPLE, "Temple"),
  egyptian(TYPE_EGYPTIAN_OUTPOST, "Outpost"),
  egyptian(TYPE_EGYPTIAN_FARM, "Farm"),
  egyptian(TYPE_EGYPTIAN_WALL_CONNECTOR, "Wall Connector"),
  egyptian(TYPE_EGYPTIAN_WALL_SHORT, "Wall Short"),
  egyptian(TYPE_EGYPTIAN_WALL_MEDIUM, "Wall Medium"),
  egyptian(TYPE_EGYPTIAN_WALL_LONG, "Wall Long"),
  egyptian(TYPE_EGYPTIAN_GATE, "Gate"),
  egyptian(TYPE_EGYPTIAN_ARMORY, "Armory"),
  egyptian(TYPE_EGYPTIAN_TOWER, "Tower"),
  egyptian(TYPE_EGYPTIAN_BARRACKS, "Barracks"),
  egyptian(TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, "Migdol Stronghold"),
  egyptian(TYPE_EGYPTIAN_MARKET, "Market"),
  egyptian(TYPE_EGYPTIAN_SIEGE_WORKS, "Siege Camp"),
  egyptian(TYPE_EGYPTIAN_LIGHTHOUSE, "Lighthouse"),
  egyptian(TYPE_EGYPTIAN_WONDER, "Wonder"),
  egyptian(TYPE_EGYPTIAN_MONUMENT_TO_VILLAGERS, "Monument"),
  egyptian(TYPE_EGYPTIAN_MONUMENT_TO_SOLDIERS, "Monument 2"),
  egyptian(TYPE_EGYPTIAN_MONUMENT_TO_PRIESTS, "Monument 3"),
  egyptian(TYPE_EGYPTIAN_MONUMENT_TO_PHARAOHS, "Monument 4"),
  egyptian(TYPE_EGYPTIAN_MONUMENT_TO_GODS, "Monument 5"),
] as const;

export const CLASSIC_BUILDING_ROSTER = [
  ...GREEK_BUILDING_ROSTER,
  ...EGYPTIAN_BUILDING_ROSTER,
] as const;
