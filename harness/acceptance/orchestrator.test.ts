import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseFailingTests, writeFailureBundle } from "../failure-bundle";
import { assertProtectedUnchanged, protectedFilesTouched } from "../protect";

describe("protected harness judge", () => {
  test("rejects edits to TASK.md and harness/acceptance", () => {
    expect(protectedFilesTouched(["src/orders.ts"])).toEqual([]);
    expect(protectedFilesTouched(["TASK.md", "src/app.ts"])).toEqual(["TASK.md"]);
    expect(
      protectedFilesTouched(["harness/acceptance/baseline.test.ts"])
    ).toEqual(["harness/acceptance/baseline.test.ts"]);
    expect(() =>
      assertProtectedUnchanged(["harness/acceptance/baseline.test.ts"])
    ).toThrow(/PROTECTED_PATH_VIOLATION/);
  });

  test("writes a machine-readable failure bundle", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-"));
    const file = writeFailureBundle(dir, {
      task_excerpt: "Add sizes",
      failing_command: "npm test",
      stdout: "● prices orders from the database",
      stderr: "",
      failing_tests: parseFailingTests("● prices orders from the database"),
      git_diff: "diff --git a/src/orders.ts",
      cycle: 1,
      task_id: "01",
    });
    const body = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(body.failing_command).toBe("npm test");
    expect(body.failing_tests).toEqual(["prices orders from the database"]);
    expect(body.git_diff).toContain("src/orders.ts");
  });
});
