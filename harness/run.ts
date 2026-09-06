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

export function cycleDir(cwd: string, taskId: string, cycle: number): string {
  return path.join(
    cwd,
    "artifacts",
    "cycles",
    `task-${taskId}`,
    `cycle-${String(cycle).padStart(2, "0")}`
  );
}
