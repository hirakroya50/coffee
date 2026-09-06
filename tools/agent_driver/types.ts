export const FAILURE_CLASSES = [
  "BUILD",
  "OPENAPI_CONTRACT",
  "DATABASE_SCHEMA",
  "MIGRATION",
  "BUSINESS_LOGIC",
  "STATE_TRANSITION",
  "INPUT_VALIDATION",
  "OUTPUT_VALIDATION",
  "REGRESSION",
  "MCP_READINESS",
  "DEPLOYMENT",
  "TEST_INFRASTRUCTURE",
  "TRANSIENT",
  "SPEC_AMBIGUITY",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

export type Triage = {
  failure_class: FailureClass;
  root_cause: string;
  evidence: string[];
  files_likely_involved: string[];
  files_that_should_not_change: string[];
  fix_strategy: string;
  confidence: "low" | "medium" | "high";
};

export type VerifierResult = {
  approved: boolean;
  reasons: string[];
};

export type AgentDriver = {
  build(task: string, repo: string): Promise<void>;
  triage(failureBundleJson: string, repo: string): Promise<Triage>;
  fix(triage: Triage, repo: string): Promise<void>;
  verify(
    task: string,
    repo: string,
    diff: string,
    testResults: string
  ): Promise<VerifierResult>;
};
