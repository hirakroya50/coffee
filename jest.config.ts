import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/harness/acceptance/**/*.test.ts"],
  watchman: false,
  forceExit: true,
};

export default config;
