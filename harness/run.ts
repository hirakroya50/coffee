import { spawnSync } from "node:child_process";
import path from "node:path";

export type CommandResult = {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  status: number | null;
};

function run(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  return {
    ok: result.status === 0,
    command: `${command} ${args.join(" ")}`,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

export function runTargeted(cwd: string, testNamePattern?: string): CommandResult {
  const args = ["test", "--", "--watchman=false"];
  if (testNamePattern) {
    args.push("-t", testNamePattern);
  }
  return run("npm", args, cwd);
}

export function runMcp(cwd: string): CommandResult {
  return run("npm", ["run", "validate:mcp"], cwd);
}

export function runFull(cwd: string): CommandResult {
  const tests = runTargeted(cwd);
  if (!tests.ok) {
    return tests;
  }
  const mcp = runMcp(cwd);
  if (!mcp.ok) {
    return mcp;
  }
  return {
    ok: true,
    command: `${tests.command} && ${mcp.command}`,
    stdout: `${tests.stdout}\n${mcp.stdout}`,
    stderr: `${tests.stderr}\n${mcp.stderr}`,
    status: 0,
  };
}

const TASK_ACCEPTANCE_FILES: Record<string, string> = {
  "01": "harness/acceptance/task-sizes.test.ts",
  "02": "harness/acceptance/task-milk.test.ts",
  "03": "harness/acceptance/task-cancel.test.ts",
  "04": "harness/acceptance/task-notes.test.ts",
  "05": "harness/acceptance/task-extra-shot.test.ts",
  "06": "harness/acceptance/task-syrup.test.ts",
  "07": "harness/acceptance/task-tip.test.ts",
  "08": "harness/acceptance/task-menu-filter.test.ts",
  "09": "harness/acceptance/task-min-order.test.ts",
  "10": "harness/acceptance/task-ready-at.test.ts",
  "11": "harness/acceptance/task-health.test.ts",
  "12": "harness/acceptance/task-ping.test.ts",
  "13": "harness/acceptance/task-version.test.ts",
  "14": "harness/acceptance/task-info.test.ts",
  "15": "harness/acceptance/task-ready.test.ts",
  "16": "harness/acceptance/task-customer-total-orders.test.ts",
  "17": "harness/acceptance/task-menu-list-no-active.test.ts",
};

export function taskAcceptanceFile(taskId: string): string | undefined {
  return TASK_ACCEPTANCE_FILES[taskId.padStart(2, "0")];
}

function runAcceptanceFile(cwd: string, file: string): CommandResult {
  return run("npm", ["test", "--", "--watchman=false", file], cwd);
}

export function runTaskTests(cwd: string, taskId: string): CommandResult {
  if (process.env.BUILDER_FULL_TESTS === "1") {
    return runFull(cwd);
  }
  const file = taskAcceptanceFile(taskId);
  if (!file) {
    return runFull(cwd);
  }
  const tests = runAcceptanceFile(cwd, file);
  if (!tests.ok) {
    return tests;
  }
  const mcp = runMcp(cwd);
  if (!mcp.ok) {
    return mcp;
  }
  return {
    ok: true,
    command: `${tests.command} && ${mcp.command}`,
    stdout: `${tests.stdout}\n${mcp.stdout}`,
    stderr: `${tests.stderr}\n${mcp.stderr}`,
    status: 0,
  };
}

export function cycleDir(cwd: string, taskId: string, cycle: number): string {
  return path.join(
    cwd,
    "artifacts",
    "cycles",
    `task-${taskId}`,
    `cycle-${String(cycle).padStart(2, "0")}`
  );
}
