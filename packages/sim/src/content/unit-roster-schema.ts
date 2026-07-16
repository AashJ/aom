import { NO_GOD } from "../ecs/progression";
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

export interface UnitRosterCore {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly culture: number;
  readonly family: UnitFamily;
  readonly gates: readonly UnitGate[];
  readonly foundationLanes: readonly string[];
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

export interface BlockedUnitLaneInput extends UnitRosterCore {
  readonly blocker: string;
  readonly trainedAt?: readonly TypeCommandRelationship[] | null;
}

const UNIT_GATE_ORDER: Readonly<Record<UnitGate, number>> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
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

export function gateLabel(gates: readonly UnitGate[]): string {
  return gates.length === 1 ? `Gate ${gates[0]}` : `Gates ${gates.join("+")}`;
}

export function defineUnitLane(entry: UnitRosterDraft): UnitRosterEntry {
  return {
    ...entry,
    lane: entry.key,
    ownedPaths: unitPackOwnedPaths(entry.culture, entry.key),
  };
}

export function blockedUnitLane({
  blocker,
  trainedAt = null,
  ...entry
}: BlockedUnitLaneInput): UnitRosterEntry {
  return defineUnitLane({
    ...entry,
    status: "blocked",
    blocker: `${gateLabel(entry.gates)}: ${blocker}`,
    trainedAt,
  });
}

function pathsOverlap(left: LaneOwnedPath, right: LaneOwnedPath): boolean {
  if (left.path === right.path) return true;
  if (left.kind === "directory" && right.path.startsWith(`${left.path}/`)) return true;
  return right.kind === "directory" && left.path.startsWith(`${right.path}/`);
}

function requireFamilyGate(entry: UnitRosterEntry, gate: UnitGate): void {
  if (!entry.gates.includes(gate)) {
    throw new Error(`Unit lane ${entry.lane} family ${entry.family} requires Gate ${gate}.`);
  }
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
    if (entry.gates.length === 0) throw new Error(`Unit lane ${entry.lane} has no gates.`);
    for (let index = 0; index < entry.gates.length; index += 1) {
      const gate = entry.gates[index]!;
      if (index > 0 && UNIT_GATE_ORDER[entry.gates[index - 1]!] >= UNIT_GATE_ORDER[gate]) {
        throw new Error(`Unit lane ${entry.lane} gates must be unique and ordered.`);
      }
    }
    if (entry.gates.includes("A") && entry.gates.length !== 1) {
      throw new Error(`Unit lane ${entry.lane} cannot combine Gate A with another family gate.`);
    }
    if (entry.foundationLanes.length === 0) {
      throw new Error(`Unit lane ${entry.lane} has no foundation owners.`);
    }
    if (
      new Set(entry.foundationLanes).size !== entry.foundationLanes.length ||
      entry.foundationLanes.some((foundation) => foundation.length === 0)
    ) {
      throw new Error(`Unit lane ${entry.lane} has invalid foundation owners.`);
    }
    if (entry.ownedPaths.length === 0) throw new Error(`Unit lane ${entry.lane} owns no paths.`);

    if (entry.family === "ordinary-melee") requireFamilyGate(entry, "A");
    if (entry.family === "ordinary-projectile") requireFamilyGate(entry, "B");
    if (entry.family === "hero" || entry.family === "myth") requireFamilyGate(entry, "C");
    if (
      entry.family === "exceptional-lifecycle" ||
      entry.family === "siege" ||
      entry.family === "trade"
    ) {
      requireFamilyGate(entry, "D");
    }
    if (entry.family === "naval") requireFamilyGate(entry, "E");

    if (entry.status === "blocked" && !entry.blocker.startsWith(`${gateLabel(entry.gates)}:`)) {
      throw new Error(`Unit lane ${entry.lane} blocker does not name all required gates.`);
    }

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

export function validateRosterReservations(
  entries: readonly UnitRosterEntry[],
  reservedIds: readonly number[],
): void {
  const rosterIds = new Set(entries.map((entry) => entry.id));
  const reservations = new Set(reservedIds);
  const missing = reservedIds.filter((id) => !rosterIds.has(id));
  const unexpected = entries
    .filter((entry) => !reservations.has(entry.id))
    .map((entry) => entry.id);
  if (missing.length > 0 || unexpected.length > 0 || reservations.size !== reservedIds.length) {
    throw new Error(
      `Unit roster reservations differ: missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}].`,
    );
  }
}
