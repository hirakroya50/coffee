import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parseFailingTests, writeFailureBundle } from "../../harness/failure-bundle";
import { gitChangedFiles, gitDiff } from "../../harness/git";
import { assertProtectedUnchanged } from "../../harness/protect";
import { cycleDir, runFull, runTargeted, type CommandResult } from "../../harness/run";
import type { AgentDriver, Triage, VerifierResult } from "./types";

export type LoopResult = {
  status: "PASS" | "FAIL" | "BLOCKED";
  cycles: number;
  reason?: string;
  prUrl?: string;
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

export async function runLoop(options: {
  cwd: string;
  taskId: string;
  driver: AgentDriver;
  testNamePattern?: string;
  skipBuild?: boolean;
  openPr?: OpenPrHook;
  runTests?: () => CommandResult;
  runRegression?: () => CommandResult;
}): Promise<LoopResult> {
  const { cwd, taskId, driver } = options;
  const task = fs.readFileSync(path.join(cwd, "TASK.md"), "utf8");
  const rules = fs.readFileSync(path.join(cwd, "AI_RULES.md"), "utf8");

  if (!options.skipBuild) {
    await driver.build(task, cwd);
    assertProtectedUnchanged(gitChangedFiles(cwd));
  }

  const runTests =
    options.runTests ??
    (() =>
      options.testNamePattern
        ? runTargeted(cwd, options.testNamePattern)
        : runFull(cwd));
  const runRegression = options.runRegression ?? (() => runFull(cwd));

  let tests = await Promise.resolve(runTests());
  let cycle = 0;

  const maybeVerify = async (): Promise<LoopResult> => {
    const diff = gitDiff(cwd);
    const verdict: VerifierResult = await driver.verify(
      task,
      cwd,
      diff,
      tests.stdout
    );
    writeJson(
      path.join(cycleDir(cwd, taskId, Math.max(cycle, 1)), "verifier.json"),
      verdict
    );
    if (!verdict.approved) {
      return { status: "FAIL", cycles: cycle, reason: verdict.reasons.join("; ") };
    }
    const pass: LoopResult = { status: "PASS", cycles: cycle };
    if (options.openPr) {
      const published = await options.openPr({
        cwd,
        taskId,
        taskMarkdown: task,
      });
      if (published?.prUrl) {
        pass.prUrl = published.prUrl;
      }
    }
    return pass;
  };

  if (tests.ok) {
    return maybeVerify();
  }

  while (cycle < 5) {
    cycle += 1;
    const dir = cycleDir(cwd, taskId, cycle);
    fs.mkdirSync(dir, { recursive: true });
    const bundlePath = writeFailureBundle(dir, {
      task_excerpt: `${rules.slice(0, 200)}\n---\n${task.slice(0, 800)}`,
      failing_command: tests.command,
      stdout: tests.stdout,
      stderr: tests.stderr,
      failing_tests: parseFailingTests(tests.stdout),
      git_diff: gitDiff(cwd),
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
    assertProtectedUnchanged(gitChangedFiles(cwd));
    fs.writeFileSync(path.join(dir, "candidate.diff"), gitDiff(cwd));
    tests = runTests();
    fs.writeFileSync(
      path.join(dir, tests.ok ? "regression-test.txt" : "targeted-test.txt"),
      tests.stdout
    );
    if (!tests.ok) {
      continue;
    }
    const full = runRegression();
    fs.writeFileSync(path.join(dir, "regression-test.txt"), full.stdout);
    if (!full.ok) {
      tests = full;
      continue;
    }
    tests = full;
    return maybeVerify();
  }

  writeJson(path.join(cycleDir(cwd, taskId, 5), "result.json"), {
    status: "FAIL",
    reason: "max cycles exceeded",
  });
  return { status: "FAIL", cycles: 5, reason: "max cycles exceeded" };
}

async function main() {
  const cwd = process.cwd();
  const taskId = process.env.TASK_ID ?? "01";
  const { createCursorDriver } = await import("./cursor_driver");
  const { openPassPullRequest } = await import("./open_pr");
  const skipPr = process.argv.includes("--no-pr");
  const result = await runLoop({
    cwd,
    taskId,
    driver: createCursorDriver(),
    testNamePattern: process.env.TASK_TEST_PATTERN,
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
