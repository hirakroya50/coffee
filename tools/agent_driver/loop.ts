import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parseFailingTests, writeFailureBundle } from "../../harness/failure-bundle";
import {
  createLoopBaseline,
  gitDiffSinceBaseline,
  type LoopBaseline,
} from "../../harness/git";
import {
  assertProtectedSnapshotUnchanged,
  snapshotProtected,
} from "../../harness/protect";
import { cycleDir, runTaskTests, type CommandResult } from "../../harness/run";
import type { AgentDriver, Triage } from "./types";

export const MAX_FIX_CYCLES = 5;
export const MAX_CYCLES_EXCEEDED =
  "max cycles exceeded, after 5 loop circle";

export type LoopResult = {
  status: "PASS" | "FAIL" | "BLOCKED";
  cycles: number;
  reason?: string;
  prUrl?: string;
  prSkipped?: string;
};

export type OpenPrHook = (args: {
  cwd: string;
  taskId: string;
  taskMarkdown: string;
}) => Promise<{ prUrl?: string; skipped?: boolean; reason?: string } | void>;

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function log(...parts: unknown[]): void {
  console.log("[builder]", ...parts);
}

export function taskSourcePath(cwd: string, taskId: string): string {
  const padded = taskId.padStart(2, "0");
  return path.join(cwd, "tasks", `TASK-${padded}.md`);
}

export function prepareTask(cwd: string, taskId: string): void {
  const src = taskSourcePath(cwd, taskId);
  if (!fs.existsSync(src)) {
    throw new Error(
      `Task file not found: tasks/TASK-${taskId.padStart(2, "0")}.md`
    );
  }
  fs.copyFileSync(src, path.join(cwd, "TASK.md"));
}

function candidateDiff(cwd: string, loopBaseline: LoopBaseline | null): string {
  return gitDiffSinceBaseline(cwd, loopBaseline).trim();
}

async function finishPass(
  options: {
    openPr?: OpenPrHook;
    cwd: string;
    taskId: string;
    taskMarkdown: string;
    loopBaseline: LoopBaseline | null;
  },
  cycles: number
): Promise<LoopResult> {
  const pass: LoopResult = { status: "PASS", cycles };
  const diff = candidateDiff(options.cwd, options.loopBaseline);

  if (!options.openPr) {
    log("Tests passed (PR disabled with --no-pr)");
    return pass;
  }

  if (!diff) {
    pass.prSkipped = "task already implemented; nothing to commit";
    log("Tests passed — PR skipped:", pass.prSkipped);
    return pass;
  }

  log("Tests passed — opening PR");
  const published = await options.openPr({
    cwd: options.cwd,
    taskId: options.taskId,
    taskMarkdown: options.taskMarkdown,
  });
  if (published?.prUrl) {
    pass.prUrl = published.prUrl;
    log("PR opened:", pass.prUrl);
  } else if (published?.skipped) {
    pass.prSkipped = published.reason ?? "nothing to commit";
    log("PR skipped:", pass.prSkipped);
  }
  return pass;
}

export async function runLoop(options: {
  cwd: string;
  taskId: string;
  driver: AgentDriver;
  skipBuild?: boolean;
  openPr?: OpenPrHook;
  runTests?: () => CommandResult;
}): Promise<LoopResult> {
  const { cwd, taskId, driver } = options;
  const task = fs.readFileSync(path.join(cwd, "TASK.md"), "utf8");
  const rules = fs.readFileSync(path.join(cwd, "AI_RULES.md"), "utf8");
  const protectedBaseline = snapshotProtected(cwd);
  const loopBaseline = createLoopBaseline(cwd);

  if (!options.skipBuild) {
    log("Building task", taskId);
    await driver.build(task, cwd);
    assertProtectedSnapshotUnchanged(cwd, protectedBaseline);
  }

  const runTests =
    options.runTests ?? (() => runTaskTests(cwd, taskId));

  log("Running tests");
  let tests = await Promise.resolve(runTests());
  let cycle = 0;

  if (tests.ok) {
    log("Tests passed on first run");
    return finishPass(
      { openPr: options.openPr, cwd, taskId, taskMarkdown: task, loopBaseline },
      cycle
    );
  }

  while (cycle < MAX_FIX_CYCLES) {
    cycle += 1;
    log(`Fix cycle ${cycle} of ${MAX_FIX_CYCLES}`);
    const dir = cycleDir(cwd, taskId, cycle);
    fs.mkdirSync(dir, { recursive: true });
    const bundlePath = writeFailureBundle(dir, {
      task_excerpt: `${rules.slice(0, 200)}\n---\n${task.slice(0, 800)}`,
      failing_command: tests.command,
      stdout: tests.stdout,
      stderr: tests.stderr,
      failing_tests: parseFailingTests(tests.stdout),
      git_diff: candidateDiff(cwd, loopBaseline) || "(no git diff)",
      cycle,
      task_id: taskId,
    });
    fs.writeFileSync(path.join(dir, "targeted-test.txt"), tests.stdout);
    const triage: Triage = await driver.triage(
      fs.readFileSync(bundlePath, "utf8"),
      cwd
    );
    writeJson(path.join(dir, "triage.json"), triage);
    if (triage.failure_class === "SPEC_AMBIGUITY") {
      writeJson(path.join(dir, "result.json"), { status: "BLOCKED", triage });
      return { status: "BLOCKED", cycles: cycle, reason: triage.root_cause };
    }
    await driver.fix(triage, cwd);
    assertProtectedSnapshotUnchanged(cwd, protectedBaseline);
    fs.writeFileSync(
      path.join(dir, "candidate.diff"),
      candidateDiff(cwd, loopBaseline) || "(no git diff)"
    );
    log("Re-running tests after fix");
    tests = runTests();
    fs.writeFileSync(
      path.join(dir, tests.ok ? "regression-test.txt" : "targeted-test.txt"),
      tests.stdout
    );
    if (!tests.ok) {
      continue;
    }
    log("Tests passed after fix");
    return finishPass(
      { openPr: options.openPr, cwd, taskId, taskMarkdown: task, loopBaseline },
      cycle
    );
  }

  writeJson(path.join(cycleDir(cwd, taskId, MAX_FIX_CYCLES), "result.json"), {
    status: "FAIL",
    reason: MAX_CYCLES_EXCEEDED,
  });
  log(MAX_CYCLES_EXCEEDED);
  return { status: "FAIL", cycles: MAX_FIX_CYCLES, reason: MAX_CYCLES_EXCEEDED };
}

async function main() {
  const cwd = process.cwd();
  const taskId = process.env.TASK_ID ?? "11";
  log("Preparing task", taskId);
  prepareTask(cwd, taskId);
  const { createCursorDriver } = await import("./cursor_driver");
  const { openPassPullRequest } = await import("./open_pr");
  const skipPr = process.argv.includes("--no-pr");
  const result = await runLoop({
    cwd,
    taskId,
    driver: createCursorDriver(),
    openPr: skipPr
      ? undefined
      : async (args) => openPassPullRequest(args),
  });
  writeJson(path.join(cwd, "artifacts", "cycles", `task-${taskId}`, "run-report.json"), result);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "PASS" ? 0 : 1);
}

if (require.main === module) {
  void main();
}
