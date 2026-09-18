import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    // End-to-end CLI tests write dozens of encrypted files; Windows + coverage instrumentation needs headroom.
    testTimeout: 60_000,
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: ["**/index.ts", "apps/cli/src/main.ts"],
      reporter: ["text", "text-summary"],
      thresholds: {
        "packages/stats/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        "packages/extract/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  },
});
