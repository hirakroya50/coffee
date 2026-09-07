import fs from "node:fs";
import path from "node:path";
import { Agent, type Run } from "@cursor/sdk";
import { extractJson } from "./json";
import { resolveBuilderModel } from "./model";
import type { AgentDriver, Triage, VerifierResult } from "./types";

function promptFile(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, "prompts", `${name}.md`),
    "utf8"
  );
}

const JSON_ONLY_FOLLOW_UP =
  "Your previous reply was not a JSON object. Reply with ONLY valid JSON. No markdown fences. No explanation. Start with { and end with }.";

async function collectText(run: Run): Promise<string> {
  let streamed = "";
  for await (const event of run.stream()) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          streamed += block.text;
        }
      }
    }
  }
  const waited = await run.wait();
  const result = (waited.result ?? "").trim();
  const stream = streamed.trim();
  if (waited.status === "error") {
    throw new Error(
      `Agent run failed (${waited.status}): ${waited.error?.message ?? "unknown error"}`
    );
  }
  if (stream) return stream;
  return result;
}

async function runPrompt(
  prompt: string,
  cwd: string,
  options?: { expectJson?: boolean }
): Promise<string> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is required for the Cursor agent driver");
  }

  const model = await resolveBuilderModel(apiKey);

  await using agent = await Agent.create({
    apiKey,
    model,
    local: { cwd },
  });

  let text = await collectText(await agent.send(prompt));
  if (options?.expectJson) {
    try {
      extractJson(text);
      return text;
    } catch {
      text = await collectText(await agent.send(JSON_ONLY_FOLLOW_UP));
      extractJson(text);
    }
  }
  return text;
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
        repo,
        { expectJson: true }
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
        `${promptFile("verifier")}\n\n# TASK.md\n${task}\n\n# diff\n${diff || "(no git diff)"}\n\n# tests\n${testResults}`,
        repo,
        { expectJson: true }
      );
      return extractJson(text) as VerifierResult;
    },
  };
}
