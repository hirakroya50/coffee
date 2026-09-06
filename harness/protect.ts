export const PROTECTED_PATHS = ["TASK.md", "harness/acceptance"];

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
