import { execFileSync } from "node:child_process";

function inGitRepo(cwd: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

export function gitChangedFiles(cwd: string): string[] {
  if (!inGitRepo(cwd)) {
    return [];
  }
  try {
    const unstaged = execFileSync("git", ["diff", "--name-only", "HEAD"], {
      cwd,
      encoding: "utf8",
    });
    const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
      cwd,
      encoding: "utf8",
    });
    const untracked = execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      { cwd, encoding: "utf8" }
    );
    return [
      ...new Set(
        `${unstaged}\n${staged}\n${untracked}`
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      ),
    ];
  } catch {
    return [];
  }
}

export function gitDiff(cwd: string): string {
  if (!inGitRepo(cwd)) {
    return "";
  }
  try {
    const unstaged = execFileSync("git", ["diff", "HEAD"], {
      cwd,
      encoding: "utf8",
    });
    const staged = execFileSync("git", ["diff", "--cached"], {
      cwd,
      encoding: "utf8",
    });
    return `${unstaged}\n${staged}`;
  } catch {
    return "";
  }
}
