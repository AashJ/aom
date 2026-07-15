import { GOD_POSEIDON, GOD_ZEUS, NO_GOD } from "../ecs/progression";
import {
  TYPE_AXEMAN,
  TYPE_CAMELRY,
  TYPE_CHARIOT_ARCHER,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GASTRAPHETES,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_ARCHERY_RANGE,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_STABLE,
  TYPE_HETAIROI,
  TYPE_HIPPIKON,
  TYPE_HOPLITE,
  TYPE_HYPASPIST,
  TYPE_KATASKOPOS,
  TYPE_MERCENARY,
  TYPE_MERCENARY_CAVALRY,
  TYPE_MILITIA,
  TYPE_MYRMIDON,
  TYPE_PELTAST,
  TYPE_PRODROMOS,
  TYPE_SLINGER,
  TYPE_SPEARMAN,
  TYPE_TOXOTES,
  TYPE_WAR_ELEPHANT,
} from "./unit-type-ids";
import { CULTURE_EGYPTIAN, CULTURE_GREEK, type TypeCommandRelationship } from "./unit-type-schema";

export type UnitFamily =
  | "ordinary-melee"
  | "ordinary-projectile"
  | "exceptional-lifecycle"
  | "hero"
  | "myth"
  | "siege"
  | "trade"
  | "naval";

export type UnitGate = "A" | "B" | "C" | "D" | "E";
export type UnitLaneStatus = "blocked" | "ready" | "implemented";

export interface LaneOwnedPath {
  readonly kind: "file" | "directory";
  readonly path: string;
}

interface UnitRosterCore {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly culture: number;
  readonly family: UnitFamily;
  readonly gate: UnitGate;
  readonly foundationLane: string;
  readonly requiredGod: number;
}

type UnitRosterDraft = UnitRosterCore &
  (
    | {
        readonly status: "blocked";
        readonly blocker: string;
        readonly trainedAt: readonly TypeCommandRelationship[] | null;
      }
    | {
        readonly status: "ready" | "implemented";
        readonly blocker: null;
        readonly trainedAt: readonly TypeCommandRelationship[];
      }
  );

export type UnitRosterEntry = UnitRosterDraft & {
  readonly lane: string;
  readonly ownedPaths: readonly LaneOwnedPath[];
};

function cultureDirectory(culture: number): "greek" | "egyptian" {
  if (culture === CULTURE_GREEK) return "greek";
  if (culture === CULTURE_EGYPTIAN) return "egyptian";
  throw new Error(`Unit lanes do not support culture ${culture}.`);
}

function unitSlug(key: string): string {
  return key.replace(/^(greek|egyptian)-/, "");
}

export function unitPackOwnedPaths(culture: number, key: string): readonly LaneOwnedPath[] {
  const directory = cultureDirectory(culture);
  const slug = unitSlug(key);
  return [
    { kind: "file", path: `packages/sim/src/content/unit-types/${directory}/${slug}.ts` },
    { kind: "file", path: `packages/sim/src/content/unit-types/${directory}/${slug}.test.ts` },
    { kind: "file", path: `packages/engine/src/content/unit-media/${directory}/${slug}.ts` },
    { kind: "directory", path: `packages/engine/src/assets/units/${directory}/${slug}` },
  ];
}

function defineUnitLane(entry: UnitRosterDraft): UnitRosterEntry {
  return {
    ...entry,
    lane: entry.key,
    ownedPaths: unitPackOwnedPaths(entry.culture, entry.key),
  };
}

const DIRECT_HIT_MELEE_FOUNDATION = "serial-direct-hit-melee-foundation";
const PROJECTILE_FOUNDATION = "serial-projectile-foundation";
const PROJECTILE_BLOCKER =
  "Gate B: deterministic projectile launch, flight, impact, snapshot/hash, presentation, and a reviewed producer/slot assignment.";

const gateAEntries = [
  defineUnitLane({
    id: TYPE_HOPLITE,
    key: "greek-hoplite",
    label: "Hoplite",
    culture: CULTURE_GREEK,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 0 }],
  }),
  defineUnitLane({
    id: TYPE_HYPASPIST,
    key: "greek-hypaspist",
    label: "Hypaspist",
    culture: CULTURE_GREEK,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 1 }],
  }),
  defineUnitLane({
    id: TYPE_HIPPIKON,
    key: "greek-hippikon",
    label: "Hippikon",
    culture: CULTURE_GREEK,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_GREEK_STABLE, commandSlot: 0 }],
  }),
  defineUnitLane({
    id: TYPE_PRODROMOS,
    key: "greek-prodromos",
    label: "Prodromos",
    culture: CULTURE_GREEK,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_GREEK_STABLE, commandSlot: 1 }],
  }),
  defineUnitLane({
    id: TYPE_MYRMIDON,
    key: "greek-myrmidon",
    label: "Myrmidon",
    culture: CULTURE_GREEK,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: GOD_ZEUS,
    trainedAt: [
      { type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 2 },
      { type: TYPE_GREEK_FORTRESS, commandSlot: 2 },
    ],
  }),
  defineUnitLane({
    id: TYPE_HETAIROI,
    key: "greek-hetairoi",
    label: "Hetairoi",
    culture: CULTURE_GREEK,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: GOD_POSEIDON,
    trainedAt: [
      { type: TYPE_GREEK_STABLE, commandSlot: 2 },
      { type: TYPE_GREEK_FORTRESS, commandSlot: 2 },
    ],
  }),
  defineUnitLane({
    id: TYPE_SPEARMAN,
    key: "egyptian-spearman",
    label: "Spearman",
    culture: CULTURE_EGYPTIAN,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 0 }],
  }),
  defineUnitLane({
    id: TYPE_AXEMAN,
    key: "egyptian-axeman",
    label: "Axeman",
    culture: CULTURE_EGYPTIAN,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 1 }],
  }),
  defineUnitLane({
    id: TYPE_CAMELRY,
    key: "egyptian-camelry",
    label: "Camelry",
    culture: CULTURE_EGYPTIAN,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 1 }],
  }),
  defineUnitLane({
    id: TYPE_WAR_ELEPHANT,
    key: "egyptian-war-elephant",
    label: "War Elephant",
    culture: CULTURE_EGYPTIAN,
    family: "ordinary-melee",
    gate: "A",
    foundationLane: DIRECT_HIT_MELEE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 2 }],
  }),
  defineUnitLane({
    id: TYPE_MILITIA,
    key: "militia",
    label: "Militia",
    culture: CULTURE_GREEK,
    family: "exceptional-lifecycle",
    gate: "D",
    foundationLane: "serial-death-spawn-units",
    status: "blocked",
    blocker: "Gate D: Poseidon building-destruction spawn and exceptional creation rules.",
    requiredGod: GOD_POSEIDON,
    trainedAt: [],
  }),
  defineUnitLane({
    id: TYPE_KATASKOPOS,
    key: "greek-kataskopos",
    label: "Kataskopos",
    culture: CULTURE_GREEK,
    family: "exceptional-lifecycle",
    gate: "D",
    foundationLane: "serial-starting-units",
    status: "blocked",
    blocker: "Gate D: starting-only creation; Classic players cannot train replacements.",
    requiredGod: NO_GOD,
    trainedAt: [],
  }),
  defineUnitLane({
    id: TYPE_MERCENARY,
    key: "egyptian-mercenary",
    label: "Mercenary",
    culture: CULTURE_EGYPTIAN,
    family: "exceptional-lifecycle",
    gate: "D",
    foundationLane: "serial-temporary-units",
    status: "blocked",
    blocker: "Gate D: deterministic 45-second lifetime and exceptional removal rules.",
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_EGYPTIAN_TOWN_CENTER, commandSlot: 1 }],
  }),
  defineUnitLane({
    id: TYPE_MERCENARY_CAVALRY,
    key: "egyptian-mercenary-cavalry",
    label: "Mercenary Cavalry",
    culture: CULTURE_EGYPTIAN,
    family: "exceptional-lifecycle",
    gate: "D",
    foundationLane: "serial-temporary-units",
    status: "blocked",
    blocker: "Gate D: deterministic 45-second lifetime and exceptional removal rules.",
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_EGYPTIAN_TOWN_CENTER, commandSlot: 2 }],
  }),
];

function blockedProjectile(
  id: number,
  key: string,
  label: string,
  culture: number,
): UnitRosterEntry {
  return defineUnitLane({
    id,
    key,
    label,
    culture,
    family: "ordinary-projectile",
    gate: "B",
    foundationLane: PROJECTILE_FOUNDATION,
    status: "blocked",
    blocker: PROJECTILE_BLOCKER,
    requiredGod: NO_GOD,
    trainedAt: null,
  });
}

const projectileEntries = [
  defineUnitLane({
    id: TYPE_TOXOTES,
    key: "greek-toxotes",
    label: "Toxotes",
    culture: CULTURE_GREEK,
    family: "ordinary-projectile",
    gate: "B",
    foundationLane: PROJECTILE_FOUNDATION,
    status: "implemented",
    blocker: null,
    requiredGod: NO_GOD,
    trainedAt: [{ type: TYPE_GREEK_ARCHERY_RANGE, commandSlot: 0 }],
  }),
  blockedProjectile(TYPE_PELTAST, "greek-peltast", "Peltast", CULTURE_GREEK),
  blockedProjectile(TYPE_GASTRAPHETES, "greek-gastraphetes", "Gastraphetes", CULTURE_GREEK),
  blockedProjectile(TYPE_SLINGER, "egyptian-slinger", "Slinger", CULTURE_EGYPTIAN),
  blockedProjectile(
    TYPE_CHARIOT_ARCHER,
    "egyptian-chariot-archer",
    "Chariot Archer",
    CULTURE_EGYPTIAN,
  ),
];

export const UNIT_ROSTER = [...gateAEntries, ...projectileEntries].sort(
  (left, right) => left.id - right.id,
) as readonly UnitRosterEntry[];

function pathsOverlap(left: LaneOwnedPath, right: LaneOwnedPath): boolean {
  if (left.path === right.path) return true;
  if (left.kind === "directory" && right.path.startsWith(`${left.path}/`)) return true;
  return right.kind === "directory" && left.path.startsWith(`${right.path}/`);
}

export function validateUnitRoster(entries: readonly UnitRosterEntry[]): void {
  const ids = new Set<number>();
  const keys = new Set<string>();
  const lanes = new Set<string>();
  const ownedPaths: Array<{ lane: string; ownedPath: LaneOwnedPath }> = [];
  const trainedSlots = new Map<string, UnitRosterEntry[]>();

  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate unit roster id ${entry.id}.`);
    if (keys.has(entry.key)) throw new Error(`Duplicate unit roster key ${entry.key}.`);
    if (lanes.has(entry.lane)) throw new Error(`Duplicate unit roster lane ${entry.lane}.`);
    ids.add(entry.id);
    keys.add(entry.key);
    lanes.add(entry.lane);

    if (entry.lane !== entry.key) {
      throw new Error(
        `Unit roster lane ${entry.lane} must use its stable content key ${entry.key}.`,
      );
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.lane)) {
      throw new Error(`Unit roster lane ${entry.lane} is not a stable kebab-case name.`);
    }
    if (entry.foundationLane.length === 0) {
      throw new Error(`Unit lane ${entry.lane} has no foundation owner.`);
    }
    if (entry.ownedPaths.length === 0) throw new Error(`Unit lane ${entry.lane} owns no paths.`);

    for (const ownedPath of entry.ownedPaths) {
      if (
        ownedPath.path.startsWith("/") ||
        ownedPath.path.split("/").includes("..") ||
        ownedPath.path.endsWith("/")
      ) {
        throw new Error(`Unit lane ${entry.lane} has invalid owned path ${ownedPath.path}.`);
      }
      const collision = ownedPaths.find((candidate) =>
        pathsOverlap(candidate.ownedPath, ownedPath),
      );
      if (collision !== undefined) {
        throw new Error(
          `Unit lanes ${collision.lane} and ${entry.lane} have overlapping ownership at ${collision.ownedPath.path} and ${ownedPath.path}.`,
        );
      }
      ownedPaths.push({ lane: entry.lane, ownedPath });
    }

    if (entry.status === "blocked") continue;
    for (const relationship of entry.trainedAt) {
      const slot = `${relationship.type}:${relationship.commandSlot}`;
      const occupants = trainedSlots.get(slot) ?? [];
      const collision = occupants.find(
        (candidate) =>
          candidate.requiredGod === NO_GOD ||
          entry.requiredGod === NO_GOD ||
          candidate.requiredGod === entry.requiredGod,
      );
      if (collision !== undefined) {
        throw new Error(
          `Open unit lanes ${collision.lane} and ${entry.lane} conflict at producer ${relationship.type} slot ${relationship.commandSlot}.`,
        );
      }
      occupants.push(entry);
      trainedSlots.set(slot, occupants);
    }
  }
}

validateUnitRoster(UNIT_ROSTER);

export function unitRosterEntry(lane: string): UnitRosterEntry | undefined {
  return UNIT_ROSTER.find((entry) => entry.lane === lane);
}
