import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const PROTECTED_PATHS = ["TASK.md", "harness/acceptance"];

export type ProtectedSnapshot = Record<string, string>;

function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listAcceptanceFiles(cwd: string): string[] {
  const root = path.join(cwd, "harness", "acceptance");
  if (!fs.existsSync(root)) {
    return [];
  }
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      files.push(path.relative(cwd, full).replaceAll("\\", "/"));
    }
  };
  walk(root);
  return files;
}

export function snapshotProtected(cwd: string): ProtectedSnapshot {
  const snapshot: ProtectedSnapshot = {};
  const taskPath = path.join(cwd, "TASK.md");
  if (fs.existsSync(taskPath)) {
    snapshot["TASK.md"] = hashFile(taskPath);
  }
  for (const rel of listAcceptanceFiles(cwd)) {
    snapshot[rel] = hashFile(path.join(cwd, rel));
  }
  return snapshot;
}

export function assertProtectedSnapshotUnchanged(
  cwd: string,
  baseline: ProtectedSnapshot
): void {
  const current = snapshotProtected(cwd);
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  const bad = [...keys].filter((key) => baseline[key] !== current[key]);
  if (bad.length > 0) {
    throw new Error(
      `PROTECTED_PATH_VIOLATION: candidate touched ${bad.join(", ")}`
    );
  }
}

export function isProtectedPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return (
    normalized === "TASK.md" ||
    normalized.startsWith("harness/acceptance/") ||
    normalized === "harness/acceptance"
  );
}

export function protectedFilesTouched(changedFiles: string[]): string[] {
  return changedFiles.filter((file) => isProtectedPath(file));
}

export function assertProtectedUnchanged(changedFiles: string[]): void {
  const bad = protectedFilesTouched(changedFiles);
  if (bad.length > 0) {
    throw new Error(
      `PROTECTED_PATH_VIOLATION: candidate touched ${bad.join(", ")}`
    );
  }
}
