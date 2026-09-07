import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type OpenPrResult = {
  skipped?: boolean;
  branch?: string;
  prUrl?: string;
  reason?: string;
};

const PRODUCT_PATHS = [
  "src",
  "openapi.yaml",
  "schema.sql",
  "seed.sql",
  "tests/generated",
];

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function requireGh(cwd: string): void {
  try {
    execFileSync("gh", ["auth", "status"], { cwd, encoding: "utf8", stdio: "pipe" });
  } catch {
    throw new Error(
      "gh is not installed or not logged in. Install GitHub CLI and run `gh auth login`."
    );
  }
}

function branchName(taskId: string, now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return `cursor/task-${taskId}-${stamp}`;
}

function prTitle(taskMarkdown: string): string {
  const line =
    taskMarkdown
      .split("\n")
      .map((row) => row.replace(/^#+\s*/, "").trim())
      .find((row) => row.length > 0) ?? "Builder PASS";
  return line.slice(0, 80);
}

function existingProductPaths(cwd: string): string[] {
  const paths: string[] = [];
  for (const rel of PRODUCT_PATHS) {
    const full = path.join(cwd, rel);
    if (fs.existsSync(full)) {
      paths.push(rel);
    }
  }
  return paths;
}

export function openPassPullRequest(options: {
  cwd: string;
  taskId: string;
  taskMarkdown: string;
}): OpenPrResult {
  const { cwd, taskId, taskMarkdown } = options;
  requireGh(cwd);

  const productPaths = existingProductPaths(cwd);
  if (productPaths.length === 0) {
    return { skipped: true, reason: "nothing to commit" };
  }

  const branch = branchName(taskId);
  git(cwd, ["checkout", "-b", branch]);
  git(cwd, ["add", "--", ...productPaths]);

  const staged = git(cwd, ["diff", "--cached", "--name-only"]);
  if (!staged) {
    git(cwd, ["checkout", "-"]);
    return { skipped: true, reason: "nothing to commit" };
  }

  git(cwd, [
    "commit",
    "-m",
    `feat(task-${taskId}): ${prTitle(taskMarkdown)}`,
  ]);
  git(cwd, ["push", "-u", "origin", branch]);

  const prUrl = execFileSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      prTitle(taskMarkdown),
      "--body",
      `Builder PASS for TASK ${taskId}.\n\nPlease review and merge. This PR was opened automatically; it is not merged.\n\n## TASK\n\n${taskMarkdown.slice(0, 2000)}`,
    ],
    { cwd, encoding: "utf8" }
  ).trim();

  return { branch, prUrl };
}
