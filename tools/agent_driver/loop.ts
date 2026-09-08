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
  type ProtectedSnapshot,
} from "../../harness/protect";
import { cycleDir, runTaskTests, type CommandResult } from "../../harness/run";
import type { AgentDriver, Triage, VerifierResult } from "./types";

export const MAX_FIX_CYCLES = 5;
export const MAX_CYCLES_EXCEEDED =
  "max cycles exceeded, after 5 loop circle";

export type LoopResult = {
  status: "PASS" | "FAIL" | "BLOCKED";
  cycles: number;
  reason?: string;
  prUrl?: string;
  prSkipped?: string;
  verifierApproved?: boolean;
  verifierReasons?: string[];
};

export type OpenPrHook = (args: {
  cwd: string;
  taskId: string;
  taskMarkdown: string;
}) => Promise<{ prUrl?: string; skipped?: boolean; reason?: string } | void>;

type PassContext = {
  openPr?: OpenPrHook;
  cwd: string;
  taskId: string;
  taskMarkdown: string;
  loopBaseline: LoopBaseline | null;
};

type AttemptPassResult =
  | { kind: "finished"; result: LoopResult }
  | { kind: "verifier_rejected"; verifier: VerifierResult };

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

function triageFromVerifier(verifier: VerifierResult): Triage {
  return {
    failure_class: "OUTPUT_VALIDATION",
    root_cause: verifier.reasons.join("; ") || "Verifier rejected candidate",
    evidence: verifier.reasons,
    files_likely_involved: [],
    files_that_should_not_change: ["TASK.md", "harness/acceptance/**"],
    fix_strategy:
      "Address independent verifier findings without test-gaming or scope expansion.",
    confidence: "high",
  };
}

async function finishPass(
  options: PassContext,
  fixCycles: number
): Promise<LoopResult> {
  const pass: LoopResult = { status: "PASS", cycles: fixCycles };
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

async function attemptPass(
  ctx: PassContext,
  driver: AgentDriver,
  tests: CommandResult,
  artifactCycle: number,
  fixCycles: number
): Promise<AttemptPassResult> {
  const diff = candidateDiff(ctx.cwd, ctx.loopBaseline);

  if (!diff) {
    log("Tests passed — no candidate diff, skipping verifier");
    return { kind: "finished", result: await finishPass(ctx, fixCycles) };
  }

  log("Running independent verifier");
  const verifier = await driver.verify(
    ctx.taskMarkdown,
    ctx.cwd,
    diff,
    tests.stdout
  );
  const dir = cycleDir(ctx.cwd, ctx.taskId, artifactCycle);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, "verifier.json"), verifier);

  if (verifier.approved) {
    log("Verifier approved:", verifier.reasons.join("; "));
    const result = await finishPass(ctx, fixCycles);
    result.verifierApproved = true;
    result.verifierReasons = verifier.reasons;
    return { kind: "finished", result };
  }

  log("Verifier rejected:", verifier.reasons.join("; "));
  return { kind: "verifier_rejected", verifier };
}

async function runFailureFixCycle(options: {
  cwd: string;
  taskId: string;
  task: string;
  rules: string;
  loopBaseline: LoopBaseline | null;
  driver: AgentDriver;
  protectedBaseline: ProtectedSnapshot;
  tests: CommandResult;
  cycle: number;
}): Promise<LoopResult | null> {
  const {
    cwd,
    taskId,
    task,
    rules,
    loopBaseline,
    driver,
    protectedBaseline,
    tests,
    cycle,
  } = options;
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
  return null;
}

async function runVerifierFixCycle(options: {
  cwd: string;
  taskId: string;
  loopBaseline: LoopBaseline | null;
  driver: AgentDriver;
  protectedBaseline: ProtectedSnapshot;
  verifier: VerifierResult;
  cycle: number;
}): Promise<void> {
  const { cwd, taskId, loopBaseline, driver, protectedBaseline, verifier, cycle } =
    options;
  const dir = cycleDir(cwd, taskId, cycle);
  fs.mkdirSync(dir, { recursive: true });
  const triage = triageFromVerifier(verifier);
  writeJson(path.join(dir, "triage.json"), triage);
  await driver.fix(triage, cwd);
  assertProtectedSnapshotUnchanged(cwd, protectedBaseline);
  fs.writeFileSync(
    path.join(dir, "candidate.diff"),
    candidateDiff(cwd, loopBaseline) || "(no git diff)"
  );
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
  const passCtx: PassContext = {
    openPr: options.openPr,
    cwd,
    taskId,
    taskMarkdown: task,
    loopBaseline,
  };

  if (!options.skipBuild) {
    log("Building task", taskId);
    await driver.build(task, cwd);
    assertProtectedSnapshotUnchanged(cwd, protectedBaseline);
  }

  const runTests =
    options.runTests ?? (() => runTaskTests(cwd, taskId));

  log("Running tests");
  let tests = await Promise.resolve(runTests());
  let fixCycles = 0;

  while (true) {
    if (tests.ok) {
      if (fixCycles === 0) {
        log("Tests passed on first run");
      } else {
        log("Tests passed after fix");
      }
      const attempt = await attemptPass(
        passCtx,
        driver,
        tests,
        fixCycles,
        fixCycles
      );
      if (attempt.kind === "finished") {
        return attempt.result;
      }
      if (fixCycles >= MAX_FIX_CYCLES) {
        const reason = `verifier rejected: ${attempt.verifier.reasons.join("; ")}`;
        writeJson(path.join(cycleDir(cwd, taskId, MAX_FIX_CYCLES), "result.json"), {
          status: "FAIL",
          reason,
        });
        log(reason);
        return {
          status: "FAIL",
          cycles: fixCycles,
          reason,
          verifierApproved: false,
          verifierReasons: attempt.verifier.reasons,
        };
      }
      fixCycles += 1;
      log(
        `Verifier rejection — entering fix cycle ${fixCycles} of ${MAX_FIX_CYCLES}`
      );
      await runVerifierFixCycle({
        cwd,
        taskId,
        loopBaseline,
        driver,
        protectedBaseline,
        verifier: attempt.verifier,
        cycle: fixCycles,
      });
      log("Re-running tests after verifier-driven fix");
      tests = runTests();
      fs.writeFileSync(
        path.join(
          cycleDir(cwd, taskId, fixCycles),
          tests.ok ? "regression-test.txt" : "targeted-test.txt"
        ),
        tests.stdout
      );
      continue;
    }

    if (fixCycles >= MAX_FIX_CYCLES) {
      writeJson(path.join(cycleDir(cwd, taskId, MAX_FIX_CYCLES), "result.json"), {
        status: "FAIL",
        reason: MAX_CYCLES_EXCEEDED,
      });
      log(MAX_CYCLES_EXCEEDED);
      return {
        status: "FAIL",
        cycles: MAX_FIX_CYCLES,
        reason: MAX_CYCLES_EXCEEDED,
      };
    }

    fixCycles += 1;
    log(`Fix cycle ${fixCycles} of ${MAX_FIX_CYCLES}`);
    const blocked = await runFailureFixCycle({
      cwd,
      taskId,
      task,
      rules,
      loopBaseline,
      driver,
      protectedBaseline,
      tests,
      cycle: fixCycles,
    });
    if (blocked) {
      return blocked;
    }
    log("Re-running tests after fix");
    tests = runTests();
    fs.writeFileSync(
      path.join(
        cycleDir(cwd, taskId, fixCycles),
        tests.ok ? "regression-test.txt" : "targeted-test.txt"
      ),
      tests.stdout
    );
  }
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
