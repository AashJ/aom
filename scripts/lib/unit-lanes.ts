import { resolve } from "node:path";
import type { UnitReferenceSpec } from "../../packages/sim/src/content/unit-reference-schema";
import { gateLabel, type UnitRosterEntry } from "../../packages/sim/src/content/unit-roster";

function normalizeRepositoryPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

export function laneOwnsPath(lane: UnitRosterEntry, changedPath: string): boolean {
  const candidate = normalizeRepositoryPath(changedPath);
  return lane.ownedPaths.some((ownedPath) => {
    const owned = normalizeRepositoryPath(ownedPath.path);
    return ownedPath.kind === "file" ? candidate === owned : candidate.startsWith(`${owned}/`);
  });
}

export function unownedLaneChanges(
  lane: UnitRosterEntry,
  changedPaths: readonly string[],
): readonly string[] {
  return [...new Set(changedPaths.map(normalizeRepositoryPath))]
    .filter((path) => path.length > 0 && !laneOwnsPath(lane, path))
    .sort((left, right) => left.localeCompare(right));
}

export function laneBrief(lane: UnitRosterEntry, reference: UnitReferenceSpec | undefined): string {
  if (lane.status !== "blocked" && reference === undefined) {
    throw new Error(`Open unit lane ${lane.lane} has no reference spec for its brief.`);
  }
  const lines = [
    `Lane: ${lane.lane}`,
    `Unit: ${lane.label} (${lane.key}, id ${lane.id})`,
    `Family: ${lane.family} / ${gateLabel(lane.gates)}`,
    `Status: ${lane.status}`,
    `Foundation owners: ${lane.foundationLanes.join("; ")}`,
    `Required god id: ${lane.requiredGod}`,
    `Trained at: ${
      lane.trainedAt === null
        ? "not frozen"
        : lane.trainedAt.length === 0
          ? "not trainable"
          : lane.trainedAt
              .map(
                (relationship) =>
                  `type ${relationship.type} / command slot ${relationship.commandSlot}`,
              )
              .join("; ")
    }`,
  ];

  if (lane.blocker !== null) lines.push(`Blocker: ${lane.blocker}`);
  if (reference !== undefined) {
    lines.push(
      `Reference: ${reference.key} (${reference.family}, ${reference.source.stage})`,
      "",
      "Expected implementation:",
      JSON.stringify(reference.expected, null, 2),
    );
  }
  lines.push("", "Owned paths:");
  for (const ownedPath of lane.ownedPaths) {
    lines.push(`- ${ownedPath.path}${ownedPath.kind === "directory" ? "/**" : ""}`);
  }
  lines.push(
    "",
    "Contract:",
    "- Do not edit shared schemas, manifests, generators, generated catalogs, or runtime systems.",
    "- Do not alter integration-owned reference specs to make a pack pass.",
    "- Stop and report any missing shared capability instead of adding a unit-specific escape hatch.",
    "- Run `bun run unit:lane validate " +
      lane.lane +
      " --base <integration-base>` before handoff.",
  );
  return lines.join("\n");
}

export interface LaneHandoffContext {
  readonly branch: string;
  readonly changedPaths: readonly string[];
  readonly reference: UnitReferenceSpec | undefined;
}

export function validateLaneHandoff(lane: UnitRosterEntry, context: LaneHandoffContext): void {
  if (lane.status !== "ready") {
    throw new Error(
      `Unit lane ${lane.lane} is ${lane.status}; only ready lanes can be handed off.`,
    );
  }
  if (context.reference === undefined) {
    throw new Error(`Ready unit lane ${lane.lane} has no integration-owned reference spec.`);
  }
  if (context.reference.source.stage !== "candidate") {
    throw new Error(`Ready unit lane ${lane.lane} requires a candidate reference spec.`);
  }
  const expectedBranch = `unit/${lane.lane}`;
  if (context.branch !== expectedBranch) {
    throw new Error(
      `Unit lane ${lane.lane} must be validated on ${expectedBranch}; found ${context.branch}.`,
    );
  }

  const changedPaths = [...new Set(context.changedPaths.map(normalizeRepositoryPath))].filter(
    Boolean,
  );
  if (changedPaths.length === 0)
    throw new Error(`Unit lane ${lane.lane} has no changes to hand off.`);

  for (const ownedPath of lane.ownedPaths) {
    const changed =
      ownedPath.kind === "file"
        ? changedPaths.includes(ownedPath.path)
        : changedPaths.some((path) => path.startsWith(`${ownedPath.path}/`));
    if (!changed) {
      throw new Error(
        `Unit lane ${lane.lane} handoff is missing required ${ownedPath.kind} ${ownedPath.path}.`,
      );
    }
  }
}

export interface LaneWorktreePlan {
  readonly branch: string;
  readonly path: string;
  readonly gitArguments: readonly string[];
}

export function laneWorktreePlan(
  repositoryRoot: string,
  lane: UnitRosterEntry,
  base: string,
  worktreeRoot = ".worktrees",
): LaneWorktreePlan {
  if (lane.status !== "ready") {
    throw new Error(`Unit lane ${lane.lane} is ${lane.status}; only ready lanes may be launched.`);
  }
  const path = resolve(repositoryRoot, worktreeRoot, lane.lane);
  const branch = `unit/${lane.lane}`;
  return {
    branch,
    path,
    gitArguments: ["worktree", "add", "-b", branch, path, base],
  };
}
