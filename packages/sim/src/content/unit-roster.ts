import { GOD_HADES, GOD_POSEIDON, GOD_ZEUS, NO_GOD } from "../ecs/progression";
import { EGYPTIAN_FUTURE_ROSTER } from "./unit-roster/egyptian";
import { GREEK_FUTURE_ROSTER } from "./unit-roster/greek";
import {
  defineUnitLane,
  validateRosterReservations,
  validateUnitRoster,
  type UnitFamily,
  type UnitGate,
  type UnitRosterEntry,
} from "./unit-roster-schema";
import {
  RESERVED_ROSTER_UNIT_TYPE_IDS,
  TYPE_AXEMAN,
  TYPE_CAMELRY,
  TYPE_CHARIOT_ARCHER,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
  TYPE_GASTRAPHETES,
  TYPE_GREEK_ARCHERY_RANGE,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_STABLE,
  TYPE_HETAIROI,
  TYPE_HIPPIKON,
  TYPE_HOPLITE,
  TYPE_HYPASPIST,
  TYPE_MYRMIDON,
  TYPE_PELTAST,
  TYPE_PRODROMOS,
  TYPE_SLINGER,
  TYPE_SPEARMAN,
  TYPE_TOXOTES,
  TYPE_WAR_ELEPHANT,
} from "./unit-type-ids";
import { CULTURE_EGYPTIAN, CULTURE_GREEK, type TypeCommandRelationship } from "./unit-type-schema";

export {
  gateLabel,
  unitPackOwnedPaths,
  validateRosterReservations,
  validateUnitRoster,
} from "./unit-roster-schema";
export type {
  LaneOwnedPath,
  UnitFamily,
  UnitGate,
  UnitLaneStatus,
  UnitRosterEntry,
} from "./unit-roster-schema";

const DIRECT_HIT_MELEE_FOUNDATION = "serial-direct-hit-melee-foundation";
const PROJECTILE_FOUNDATION = "serial-projectile-foundation";

function implementedOrdinaryUnit(
  id: number,
  key: string,
  label: string,
  culture: number,
  family: Extract<UnitFamily, "ordinary-melee" | "ordinary-projectile">,
  requiredGod: number,
  trainedAt: readonly TypeCommandRelationship[],
): UnitRosterEntry {
  const gate: UnitGate = family === "ordinary-melee" ? "A" : "B";
  return defineUnitLane({
    id,
    key,
    label,
    culture,
    family,
    gates: [gate],
    foundationLanes: [
      family === "ordinary-melee" ? DIRECT_HIT_MELEE_FOUNDATION : PROJECTILE_FOUNDATION,
    ],
    status: "implemented",
    blocker: null,
    requiredGod,
    trainedAt,
  });
}

const implementedMeleeEntries = [
  implementedOrdinaryUnit(
    TYPE_HOPLITE,
    "greek-hoplite",
    "Hoplite",
    CULTURE_GREEK,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 0 }],
  ),
  implementedOrdinaryUnit(
    TYPE_HYPASPIST,
    "greek-hypaspist",
    "Hypaspist",
    CULTURE_GREEK,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 1 }],
  ),
  implementedOrdinaryUnit(
    TYPE_HIPPIKON,
    "greek-hippikon",
    "Hippikon",
    CULTURE_GREEK,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_GREEK_STABLE, commandSlot: 0 }],
  ),
  implementedOrdinaryUnit(
    TYPE_PRODROMOS,
    "greek-prodromos",
    "Prodromos",
    CULTURE_GREEK,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_GREEK_STABLE, commandSlot: 1 }],
  ),
  implementedOrdinaryUnit(
    TYPE_MYRMIDON,
    "greek-myrmidon",
    "Myrmidon",
    CULTURE_GREEK,
    "ordinary-melee",
    GOD_ZEUS,
    [
      { type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 2 },
      { type: TYPE_GREEK_FORTRESS, commandSlot: 2 },
    ],
  ),
  implementedOrdinaryUnit(
    TYPE_HETAIROI,
    "greek-hetairoi",
    "Hetairoi",
    CULTURE_GREEK,
    "ordinary-melee",
    GOD_POSEIDON,
    [
      { type: TYPE_GREEK_STABLE, commandSlot: 2 },
      { type: TYPE_GREEK_FORTRESS, commandSlot: 2 },
    ],
  ),
  implementedOrdinaryUnit(
    TYPE_SPEARMAN,
    "egyptian-spearman",
    "Spearman",
    CULTURE_EGYPTIAN,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 0 }],
  ),
  implementedOrdinaryUnit(
    TYPE_AXEMAN,
    "egyptian-axeman",
    "Axeman",
    CULTURE_EGYPTIAN,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 1 }],
  ),
  implementedOrdinaryUnit(
    TYPE_CAMELRY,
    "egyptian-camelry",
    "Camelry",
    CULTURE_EGYPTIAN,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 1 }],
  ),
  implementedOrdinaryUnit(
    TYPE_WAR_ELEPHANT,
    "egyptian-war-elephant",
    "War Elephant",
    CULTURE_EGYPTIAN,
    "ordinary-melee",
    NO_GOD,
    [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 2 }],
  ),
];

const implementedProjectileEntries = [
  implementedOrdinaryUnit(
    TYPE_TOXOTES,
    "greek-toxotes",
    "Toxotes",
    CULTURE_GREEK,
    "ordinary-projectile",
    NO_GOD,
    [{ type: TYPE_GREEK_ARCHERY_RANGE, commandSlot: 0 }],
  ),
  implementedOrdinaryUnit(
    TYPE_PELTAST,
    "greek-peltast",
    "Peltast",
    CULTURE_GREEK,
    "ordinary-projectile",
    NO_GOD,
    [{ type: TYPE_GREEK_ARCHERY_RANGE, commandSlot: 1 }],
  ),
  implementedOrdinaryUnit(
    TYPE_GASTRAPHETES,
    "greek-gastraphetes",
    "Gastraphetes",
    CULTURE_GREEK,
    "ordinary-projectile",
    GOD_HADES,
    [{ type: TYPE_GREEK_FORTRESS, commandSlot: 2 }],
  ),
  implementedOrdinaryUnit(
    TYPE_SLINGER,
    "egyptian-slinger",
    "Slinger",
    CULTURE_EGYPTIAN,
    "ordinary-projectile",
    NO_GOD,
    [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 2 }],
  ),
  implementedOrdinaryUnit(
    TYPE_CHARIOT_ARCHER,
    "egyptian-chariot-archer",
    "Chariot Archer",
    CULTURE_EGYPTIAN,
    "ordinary-projectile",
    NO_GOD,
    [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 0 }],
  ),
];

export const UNIT_ROSTER = [
  ...implementedMeleeEntries,
  ...implementedProjectileEntries,
  ...GREEK_FUTURE_ROSTER,
  ...EGYPTIAN_FUTURE_ROSTER,
].sort((left, right) => left.id - right.id) as readonly UnitRosterEntry[];

validateUnitRoster(UNIT_ROSTER);
validateRosterReservations(UNIT_ROSTER, RESERVED_ROSTER_UNIT_TYPE_IDS);

export function unitRosterEntry(lane: string): UnitRosterEntry | undefined {
  return UNIT_ROSTER.find((entry) => entry.lane === lane);
}
