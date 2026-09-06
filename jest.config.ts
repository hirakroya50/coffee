import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "**/harness/acceptance/**/*.test.ts",
    "**/tests/generated/**/*.test.ts",
  ],
  watchman: false,
  forceExit: true,
  testTimeout: 30000,
  maxWorkers: 2,
};

export default config;
