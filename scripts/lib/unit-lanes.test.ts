import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unitRosterEntry, type UnitRosterEntry } from "../../packages/sim/src/content/unit-roster";
import type { UnitReferenceSpec } from "../../packages/sim/src/content/unit-reference-schema";
import { unitReferenceEntry } from "../../packages/sim/src/content/unit-references";
import { collectLaneChangedPaths, runGit } from "./unit-lane-git";
import {
  laneBrief,
  laneOwnsPath,
  laneWorktreePlan,
  unownedLaneChanges,
  validateLaneHandoff,
} from "./unit-lanes";

const hoplite = unitRosterEntry("greek-hoplite")!;

function candidateReference(reference: UnitReferenceSpec): UnitReferenceSpec {
  if (reference.source.stage !== "final") return reference;
  const { stage: _stage, finalRulesetReview: _review, ...source } = reference.source;
  return {
    ...reference,
    source: { ...source, stage: "candidate" },
  } as UnitReferenceSpec;
}

describe("unit lane ownership", () => {
  test("accepts only the unit's authored files and asset subtree", () => {
    expect(
      laneOwnsPath(hoplite, "packages/sim/src/content/unit-types/greek/hoplite.ts"),
    ).toBeTrue();
    expect(
      laneOwnsPath(hoplite, "packages/engine/src/assets/units/greek/hoplite/idle.glb"),
    ).toBeTrue();
    expect(laneOwnsPath(hoplite, "packages/sim/src/content/unit-type-schema.ts")).toBeFalse();
    expect(laneOwnsPath(hoplite, "packages/sim/src/content/generated/unit-types.ts")).toBeFalse();
    expect(
      laneOwnsPath(hoplite, "packages/sim/src/content/unit-types/greek/hypaspist.ts"),
    ).toBeFalse();
  });

  test("reports deterministic unique ownership violations", () => {
    expect(
      unownedLaneChanges(hoplite, [
        "./packages/sim/src/content/generated/unit-types.ts",
        "packages/sim/src/content/unit-types/greek/hoplite.ts",
        "packages/sim/src/content/generated/unit-types.ts",
        "ARCHITECTURE.md",
      ]),
    ).toEqual(["ARCHITECTURE.md", "packages/sim/src/content/generated/unit-types.ts"]);
  });

  test("emits a self-contained task brief", () => {
    const brief = laneBrief(hoplite, unitReferenceEntry(hoplite.key));
    expect(brief).toContain("Lane: greek-hoplite");
    expect(brief).toContain("Foundation owner: serial-direct-hit-melee-foundation");
    expect(brief).toContain("type 22 / command slot 0");
    expect(brief).toContain('"maxHp": 115');
    expect(brief).toContain("packages/engine/src/assets/units/greek/hoplite/**");
    expect(brief).toContain("Do not alter integration-owned reference specs");
  });

  test("plans one isolated branch and worktree only for a ready lane", () => {
    expect(() => laneWorktreePlan("/repo", hoplite, "main")).toThrow("only ready lanes");

    const readyLane: UnitRosterEntry = { ...hoplite, status: "ready" };
    expect(laneWorktreePlan("/repo", readyLane, "integration/base")).toEqual({
      branch: "unit/greek-hoplite",
      path: "/repo/.worktrees/greek-hoplite",
      gitArguments: [
        "worktree",
        "add",
        "-b",
        "unit/greek-hoplite",
        "/repo/.worktrees/greek-hoplite",
        "integration/base",
      ],
    });
  });

  test("requires a complete ready-lane handoff on its isolated branch", () => {
    const readyLane: UnitRosterEntry = { ...hoplite, status: "ready" };
    const finalReference = unitReferenceEntry(readyLane.key)!;
    const reference = candidateReference(finalReference);
    const changedPaths = readyLane.ownedPaths.map((ownedPath) =>
      ownedPath.kind === "file" ? ownedPath.path : `${ownedPath.path}/hoplite.glb`,
    );
    expect(() =>
      validateLaneHandoff(readyLane, {
        branch: "unit/greek-hoplite",
        changedPaths,
        reference: finalReference,
      }),
    ).toThrow("requires a candidate reference spec");
    expect(() =>
      validateLaneHandoff(readyLane, {
        branch: "unit/greek-hoplite",
        changedPaths,
        reference,
      }),
    ).not.toThrow();

    expect(() =>
      validateLaneHandoff(readyLane, {
        branch: "unit/greek-hoplite",
        changedPaths: changedPaths.filter((path) => !path.includes("unit-media/")),
        reference,
      }),
    ).toThrow("missing required file");
  });

  test("collects every Git change class with NUL-safe paths", async () => {
    const repository = mkdtempSync(join(tmpdir(), "aom-unit-lane-"));
    try {
      runGit(["init", "--quiet"], repository);
      runGit(["config", "user.name", "Unit Lane Test"], repository);
      runGit(["config", "user.email", "unit-lane@example.invalid"], repository);
      runGit(["config", "commit.gpgsign", "false"], repository);
      await Bun.write(join(repository, "shared.ts"), "base\n");
      await Bun.write(join(repository, "deleted.ts"), "base\n");
      await Bun.write(join(repository, "typed.ts"), "base\n");
      runGit(["add", "."], repository);
      runGit(["commit", "--quiet", "-m", "base"], repository);
      const base = runGit(["rev-parse", "HEAD"], repository).trim();
      runGit(["switch", "--quiet", "-c", "unit/greek-hoplite"], repository);

      const ownedDirectory = join(repository, "packages/sim/src/content/unit-types/greek");
      mkdirSync(ownedDirectory, { recursive: true });
      await Bun.write(join(ownedDirectory, "hoplite.ts"), "export {};\n");
      runGit(["add", "."], repository);
      runGit(["commit", "--quiet", "-m", "owned definition"], repository);

      await Bun.write(join(repository, "staged.ts"), "staged\n");
      runGit(["add", "staged.ts"], repository);
      await Bun.write(join(repository, "shared.ts"), "unstaged\n");
      await Bun.write(join(repository, "line\nbreak.ts"), "untracked\n");
      unlinkSync(join(repository, "deleted.ts"));
      unlinkSync(join(repository, "typed.ts"));
      symlinkSync("shared.ts", join(repository, "typed.ts"));

      expect(new Set(collectLaneChangedPaths(base, repository))).toEqual(
        new Set([
          "packages/sim/src/content/unit-types/greek/hoplite.ts",
          "staged.ts",
          "shared.ts",
          "line\nbreak.ts",
          "deleted.ts",
          "typed.ts",
        ]),
      );
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});
