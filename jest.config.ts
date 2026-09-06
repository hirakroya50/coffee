import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/harness/acceptance/**/*.test.ts"],
  watchman: false,
};

export default config;
