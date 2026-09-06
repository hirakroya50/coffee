import { assertProtectedUnchanged } from "./protect";
import { gitChangedFiles } from "./git";
import { parseFailingTests, writeFailureBundle } from "./failure-bundle";
import { cycleDir, runFull, runMcp, runTargeted } from "./run";
import { gitDiff } from "./git";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const cmd = process.argv[2] ?? "full";

if (cmd === "protect") {
  assertProtectedUnchanged(gitChangedFiles(cwd));
  console.log("protected paths unchanged");
  process.exit(0);
}

if (cmd === "targeted") {
  const pattern = process.argv[3];
  const result = runTargeted(cwd, pattern);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.ok ? 0 : 1);
}

if (cmd === "mcp") {
  const result = runMcp(cwd);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.ok ? 0 : 1);
}

if (cmd === "bundle-demo") {
  const dir = cycleDir(cwd, "00", 1);
  writeFailureBundle(dir, {
    task_excerpt: fs.existsSync(path.join(cwd, "TASK.md"))
      ? fs.readFileSync(path.join(cwd, "TASK.md"), "utf8").slice(0, 500)
      : "",
    failing_command: "npm test",
    stdout: "● demo failing test",
    stderr: "",
    failing_tests: parseFailingTests("● demo failing test"),
    git_diff: gitDiff(cwd),
    cycle: 1,
    task_id: "00",
  });
  console.log(path.join(dir, "failure-bundle.json"));
  process.exit(0);
}

const result = runFull(cwd);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.ok ? 0 : 1);
