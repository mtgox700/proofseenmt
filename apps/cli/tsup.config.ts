import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  // Workspace packages export TypeScript sources: they must be bundled, or plain Node cannot run dist/main.js.
  noExternal: [/^@proofseen\//],
});
