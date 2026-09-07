import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareTask, runLoop } from "../../tools/agent_driver/loop";
import type { AgentDriver, Triage } from "../../tools/agent_driver/types";

const passingTests = {
  ok: true,
  command: "npm test",
  stdout: "PASS",
  stderr: "",
  status: 0,
};

function initGitRepo(cwd: string): void {
  execFileSync("git", ["init", "--template="], {
    cwd,
    stdio: "pipe",
    env: { ...process.env, GIT_TEMPLATE_DIR: "" },
  });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd,
    stdio: "pipe",
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd, stdio: "pipe" });
}

describe("test/triage/fix loop", () => {
  test("repairs a failing candidate then passes", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "loop-"));
    fs.writeFileSync(path.join(cwd, "TASK.md"), "Fix the bug");
    fs.writeFileSync(path.join(cwd, "AI_RULES.md"), "Do not touch harness");
    fs.mkdirSync(path.join(cwd, "artifacts", "cycles"), { recursive: true });

    let attempts = 0;
    const driver: AgentDriver = {
      async build() {},
      async triage() {
        return {
          failure_class: "BUSINESS_LOGIC",
          root_cause: "unit test fixture",
          evidence: ["expected pass; actual fail"],
          files_likely_involved: ["src/example.ts"],
          files_that_should_not_change: ["TASK.md", "harness/acceptance/**"],
          fix_strategy: "apply the missing increment",
          confidence: "high",
        } satisfies Triage;
      },
      async fix() {
        attempts += 1;
      },
      async verify() {
        return { approved: true, reasons: ["matches TASK"] };
      },
    };

    let testRuns = 0;
    let prCalls = 0;
    const result = await runLoop({
      cwd,
      taskId: "99",
      driver,
      skipBuild: true,
      openPr: async () => {
        prCalls += 1;
        return { prUrl: "https://github.com/example/coffee/pull/1" };
      },
      runTests: () => {
        testRuns += 1;
        if (testRuns === 1) {
          return {
            ok: false,
            command: "npm test",
            stdout: "● example fails",
            stderr: "",
            status: 1,
          };
        }
        return {
          ok: true,
          command: "npm test",
          stdout: "PASS",
          stderr: "",
          status: 0,
        };
      },
      runRegression: () => ({
        ok: true,
        command: "npm test && npm run validate:mcp",
        stdout: "PASS",
        stderr: "",
        status: 0,
      }),
    });

    expect(result.status).toBe("PASS");
    expect(result.cycles).toBe(1);
    expect(result.prUrl).toBe("https://github.com/example/coffee/pull/1");
    expect(prCalls).toBe(1);
    expect(attempts).toBe(1);
    const triage = JSON.parse(
      fs.readFileSync(
        path.join(cwd, "artifacts/cycles/task-99/cycle-01/triage.json"),
        "utf8"
      )
    );
    expect(triage.failure_class).toBe("BUSINESS_LOGIC");
  });

  test("stops immediately on SPEC_AMBIGUITY", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "loop-"));
    fs.writeFileSync(path.join(cwd, "TASK.md"), "Make it better");
    fs.writeFileSync(path.join(cwd, "AI_RULES.md"), "rules");
    const driver: AgentDriver = {
      async build() {},
      async triage() {
        return {
          failure_class: "SPEC_AMBIGUITY",
          root_cause: "TASK does not define behavior",
          evidence: ["TASK is vague"],
          files_likely_involved: [],
          files_that_should_not_change: ["TASK.md"],
          fix_strategy: "stop",
          confidence: "high",
        };
      },
      async fix() {
        throw new Error("must not fix");
      },
      async verify() {
        throw new Error("must not verify");
      },
    };
    let prCalls = 0;
    const result = await runLoop({
      cwd,
      taskId: "98",
      driver,
      skipBuild: true,
      openPr: async () => {
        prCalls += 1;
      },
      runTests: () => ({
        ok: false,
        command: "npm test",
        stdout: "● fails",
        stderr: "",
        status: 1,
      }),
    });
    expect(result.status).toBe("BLOCKED");
    expect(prCalls).toBe(0);
  });

  test("does not treat a pre-copied TASK.md as a builder violation", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "loop-"));
    initGitRepo(cwd);
    fs.writeFileSync(path.join(cwd, "TASK.md"), "See tasks/TASK-01.md");
    fs.writeFileSync(path.join(cwd, "AI_RULES.md"), "Do not touch harness");
    execFileSync("git", ["add", "TASK.md", "AI_RULES.md"], {
      cwd,
      stdio: "pipe",
    });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "pipe" });
    fs.writeFileSync(path.join(cwd, "TASK.md"), "Add drink sizes SMALL MEDIUM LARGE");

    const driver: AgentDriver = {
      async build() {
        fs.writeFileSync(path.join(cwd, "src-impl.ts"), "ok");
      },
      async triage() {
        throw new Error("must not triage");
      },
      async fix() {
        throw new Error("must not fix");
      },
      async verify() {
        return { approved: true, reasons: ["matches TASK"] };
      },
    };

    const result = await runLoop({
      cwd,
      taskId: "01",
      driver,
      runTests: () => passingTests,
      runRegression: () => passingTests,
    });

    expect(result.status).toBe("PASS");
  });

  test("still rejects a builder that edits TASK.md after the run starts", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "loop-"));
    fs.writeFileSync(path.join(cwd, "TASK.md"), "Add drink sizes");
    fs.writeFileSync(path.join(cwd, "AI_RULES.md"), "rules");

    const driver: AgentDriver = {
      async build() {
        fs.writeFileSync(path.join(cwd, "TASK.md"), "changed by agent");
      },
      async triage() {
        throw new Error("must not triage");
      },
      async fix() {
        throw new Error("must not fix");
      },
      async verify() {
        throw new Error("must not verify");
      },
    };

    await expect(
      runLoop({
        cwd,
        taskId: "01",
        driver,
        runTests: () => passingTests,
      })
    ).rejects.toThrow(/PROTECTED_PATH_VIOLATION: candidate touched TASK.md/);
  });

  test("passes without verifier when tests pass and candidate diff is empty", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "loop-"));
    initGitRepo(cwd);
    fs.writeFileSync(path.join(cwd, "TASK.md"), "Already implemented");
    fs.writeFileSync(path.join(cwd, "AI_RULES.md"), "rules");
    execFileSync("git", ["add", "TASK.md", "AI_RULES.md"], {
      cwd,
      stdio: "pipe",
    });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "pipe" });

    let verifyCalls = 0;
    const result = await runLoop({
      cwd,
      taskId: "01",
      driver: {
        async build() {},
        async triage() {
          throw new Error("must not triage");
        },
        async fix() {
          throw new Error("must not fix");
        },
        async verify() {
          verifyCalls += 1;
          return { approved: true, reasons: ["should not run"] };
        },
      },
      skipBuild: true,
      runTests: () => passingTests,
      runRegression: () => passingTests,
    });

    expect(result.status).toBe("PASS");
    expect(result.cycles).toBe(0);
    expect(verifyCalls).toBe(0);
  });

  test("baseline diff excludes TASK.md setup and includes agent product changes", async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "loop-"));
    initGitRepo(cwd);
    fs.mkdirSync(path.join(cwd, "tasks"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "tasks", "TASK-01.md"), "Add drink sizes");
    fs.writeFileSync(path.join(cwd, "TASK.md"), "placeholder");
    fs.writeFileSync(path.join(cwd, "AI_RULES.md"), "rules");
    execFileSync("git", ["add", "."], { cwd, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "pipe" });

    prepareTask(cwd, "01");

    let verifyDiff = "";
    const result = await runLoop({
      cwd,
      taskId: "01",
      driver: {
        async build() {
          fs.mkdirSync(path.join(cwd, "src"), { recursive: true });
          fs.writeFileSync(path.join(cwd, "src", "sizes.ts"), "export {}");
        },
        async triage() {
          throw new Error("must not triage");
        },
        async fix() {
          throw new Error("must not fix");
        },
        async verify(_task, _cwd, diff) {
          verifyDiff = diff;
          return { approved: true, reasons: ["matches TASK"] };
        },
      },
      runTests: () => passingTests,
      runRegression: () => passingTests,
    });

    expect(result.status).toBe("PASS");
    expect(verifyDiff).toContain("src/sizes.ts");
    expect(verifyDiff).not.toContain("TASK.md");
  });
});
