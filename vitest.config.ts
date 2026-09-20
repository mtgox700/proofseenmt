import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    // End-to-end CLI tests write dozens of encrypted files; Windows + coverage instrumentation needs headroom.
    testTimeout: 60_000,
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: ["**/index.ts", "apps/cli/src/main.ts"],
      reporter: ["text", "text-summary"],
      thresholds: {
        "packages/stats/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        "packages/extract/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        "packages/hub/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        // Identity Firewall: une fuite serait irréversible (indexation LLM) — seuil plus haut que les autres.
        "packages/profiles/src/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
});
