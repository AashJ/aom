import {
  UNIT_ROSTER,
  unitRosterEntry,
  type UnitRosterEntry,
} from "../packages/sim/src/content/unit-roster";
import { unitReferenceEntry } from "../packages/sim/src/content/unit-references";
import { collectLaneChangedPaths, currentGitBranch, runChecked, runGit } from "./lib/unit-lane-git";
import {
  laneBrief,
  laneWorktreePlan,
  unownedLaneChanges,
  validateLaneHandoff,
} from "./lib/unit-lanes";

function usage(): never {
  console.error(`Usage:
  bun run unit:lane list [--status blocked|ready|implemented]
  bun run unit:lane brief <lane>
  bun run unit:lane create <lane> [--base <git-ref>] [--worktree-root <path>] [--dry-run]
  bun run unit:lane validate <lane> [--base <git-ref>] [--ownership-only]`);
  process.exit(2);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) usage();
  return value;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function laneFromArgument(): UnitRosterEntry {
  const laneName = process.argv[3];
  if (laneName === undefined || laneName.startsWith("--")) usage();
  const lane = unitRosterEntry(laneName);
  if (lane === undefined)
    throw new Error(`Unknown unit lane ${laneName}. Run \`bun run unit:lane list\`.`);
  return lane;
}

function simTestPath(lane: UnitRosterEntry): string {
  const testPath = lane.ownedPaths.find(
    (ownedPath) => ownedPath.kind === "file" && ownedPath.path.endsWith(".test.ts"),
  );
  if (testPath === undefined) throw new Error(`Unit lane ${lane.lane} owns no focused sim test.`);
  return testPath.path;
}

const command = process.argv[2];
if (command === "list") {
  const status = option("--status");
  if (status !== undefined && !["blocked", "ready", "implemented"].includes(status)) usage();
  const entries =
    status === undefined ? UNIT_ROSTER : UNIT_ROSTER.filter((entry) => entry.status === status);
  for (const entry of entries) {
    console.log(
      `${entry.lane.padEnd(29)} ${entry.status.padEnd(11)} Gate ${entry.gate}  ${entry.family}${entry.blocker === null ? "" : ` — ${entry.blocker}`}`,
    );
  }
} else if (command === "brief") {
  const lane = laneFromArgument();
  console.log(laneBrief(lane, unitReferenceEntry(lane.key)));
} else if (command === "create") {
  const lane = laneFromArgument();
  const repositoryRoot = runGit(["rev-parse", "--show-toplevel"]).trim();
  const base = option("--base") ?? "main";
  runGit(["rev-parse", "--verify", base], repositoryRoot);
  const plan = laneWorktreePlan(
    repositoryRoot,
    lane,
    base,
    option("--worktree-root") ?? ".worktrees",
  );

  if (hasFlag("--dry-run")) {
    console.log(`git ${plan.gitArguments.join(" ")}`);
  } else {
    runGit(plan.gitArguments, repositoryRoot);
    console.log(`Created ${plan.path} on ${plan.branch} from ${base}.`);
  }
  console.log("\n" + laneBrief(lane, unitReferenceEntry(lane.key)));
} else if (command === "validate") {
  const lane = laneFromArgument();
  const repositoryRoot = runGit(["rev-parse", "--show-toplevel"]).trim();
  const base = option("--base") ?? "main";
  const changedPaths = collectLaneChangedPaths(base, repositoryRoot);
  const violations = unownedLaneChanges(lane, changedPaths);
  if (violations.length > 0) {
    console.error(`Unit lane ${lane.lane} changed files outside its ownership contract:`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log(`Ownership valid for ${lane.lane}.`);

  if (!hasFlag("--ownership-only")) {
    validateLaneHandoff(lane, {
      branch: currentGitBranch(repositoryRoot),
      changedPaths,
      reference: unitReferenceEntry(lane.key),
    });
    runChecked(
      [
        process.execPath,
        "scripts/generate-unit-catalogs.ts",
        "--validate-only",
        "--require-lane",
        lane.lane,
      ],
      repositoryRoot,
    );
    runChecked([process.execPath, "run", "test:unit-infra"], repositoryRoot);
    runChecked([process.execPath, "test", simTestPath(lane)], repositoryRoot);
    runChecked(
      [
        process.execPath,
        "test",
        "packages/sim/src/content/unit-catalog.test.ts",
        "packages/sim/src/content/unit-reference.test.ts",
        "packages/engine/src/content/unit-media-catalog.test.ts",
      ],
      repositoryRoot,
    );
  }
} else {
  usage();
}
