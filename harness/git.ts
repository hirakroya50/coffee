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

export type LoopBaseline = {
  ref: string;
  untrackedAtStart: Set<string>;
};

function listUntrackedFiles(cwd: string): string[] {
  return execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function untrackedFileDiff(cwd: string, file: string): string {
  try {
    return execFileSync("git", ["diff", "--no-index", "/dev/null", file], {
      cwd,
      encoding: "utf8",
    });
  } catch (error) {
    const err = error as { stdout?: string };
    return err.stdout ?? "";
  }
}

export function createLoopBaseline(cwd: string): LoopBaseline | null {
  if (!inGitRepo(cwd)) {
    return null;
  }
  try {
    const ref = execFileSync("git", ["stash", "create", "-u"], {
      cwd,
      encoding: "utf8",
    }).trim();
    if (!ref) {
      return null;
    }
    return {
      ref,
      untrackedAtStart: new Set(listUntrackedFiles(cwd)),
    };
  } catch {
    return null;
  }
}

export function gitDiffSinceBaseline(
  cwd: string,
  baseline: LoopBaseline | null
): string {
  if (!inGitRepo(cwd)) {
    return "";
  }
  if (!baseline?.ref) {
    return gitDiff(cwd);
  }
  let diff = "";
  try {
    diff = execFileSync("git", ["diff", baseline.ref], {
      cwd,
      encoding: "utf8",
    });
  } catch {
    diff = gitDiff(cwd);
  }
  for (const file of listUntrackedFiles(cwd)) {
    if (baseline.untrackedAtStart.has(file)) {
      continue;
    }
    diff += untrackedFileDiff(cwd, file);
  }
  return diff.trim();
}
