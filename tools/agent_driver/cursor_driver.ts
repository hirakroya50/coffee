import fs from "node:fs";
import path from "node:path";
import { Agent } from "@cursor/sdk";
import type { AgentDriver, Triage, VerifierResult } from "./types";

function promptFile(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, "prompts", `${name}.md`),
    "utf8"
  );
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Agent did not return JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function runPrompt(prompt: string, cwd: string): Promise<string> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is required for the Cursor agent driver");
  }
  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: "composer-2.5" },
    local: { cwd },
  });
  return String(result.result ?? "");
}

export function createCursorDriver(): AgentDriver {
  return {
    async build(task, repo) {
      const rules = fs.readFileSync(path.join(repo, "AI_RULES.md"), "utf8");
      await runPrompt(
        `${promptFile("builder")}\n\n# AI_RULES.md\n${rules}\n\n# TASK.md\n${task}`,
        repo
      );
    },
    async triage(failureBundleJson, repo) {
      const text = await runPrompt(
        `${promptFile("triage")}\n\n# failure-bundle.json\n${failureBundleJson}`,
        repo
      );
      return extractJson(text) as Triage;
    },
    async fix(triage, repo) {
      await runPrompt(
        `${promptFile("fixer")}\n\n# triage.json\n${JSON.stringify(triage, null, 2)}`,
        repo
      );
    },
    async verify(task, repo, diff, testResults) {
      const text = await runPrompt(
        `${promptFile("verifier")}\n\n# TASK.md\n${task}\n\n# diff\n${diff}\n\n# tests\n${testResults}`,
        repo
      );
      return extractJson(text) as VerifierResult;
    },
  };
}
