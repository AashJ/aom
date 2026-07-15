export function runGit(args: readonly string[], cwd = process.cwd()): string {
  const result = Bun.spawnSync({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed.`);
  }
  return result.stdout.toString();
}

function nulDelimitedGitPaths(args: readonly string[], cwd: string): readonly string[] {
  return runGit(args, cwd).split("\0").filter(Boolean);
}

export function collectLaneChangedPaths(base: string, cwd: string): readonly string[] {
  runGit(["rev-parse", "--verify", `${base}^{commit}`], cwd);
  runGit(["merge-base", "--is-ancestor", base, "HEAD"], cwd);
  const commands = [
    ["diff", "--no-renames", "--name-only", "-z", `${base}...HEAD`],
    ["diff", "--no-renames", "--name-only", "-z"],
    ["diff", "--cached", "--no-renames", "--name-only", "-z"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
  ] as const;
  return commands.flatMap((args) => nulDelimitedGitPaths(args, cwd));
}

export function currentGitBranch(cwd: string): string {
  return runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd).trim();
}

export function runChecked(args: readonly string[], cwd: string): void {
  const result = Bun.spawnSync({ cmd: [...args], cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
