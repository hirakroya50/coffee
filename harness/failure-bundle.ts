import fs from "node:fs";
import path from "node:path";

export type FailureBundle = {
  task_excerpt: string;
  failing_command: string;
  stdout: string;
  stderr: string;
  failing_tests: string[];
  git_diff: string;
  cycle: number;
  task_id: string;
};

export function parseFailingTests(stdout: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split("\n")) {
    const match = line.match(/^\s*●\s+(.+)$/);
    if (match) {
      names.push(match[1].trim());
    }
  }
  return names;
}

export function writeFailureBundle(
  artifactDir: string,
  bundle: FailureBundle
): string {
  fs.mkdirSync(artifactDir, { recursive: true });
  const file = path.join(artifactDir, "failure-bundle.json");
  fs.writeFileSync(file, JSON.stringify(bundle, null, 2));
  return file;
}
