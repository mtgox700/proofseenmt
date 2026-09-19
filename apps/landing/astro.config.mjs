// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://proofseen.com",
  output: "static",
  // Astro 7 defaults to JSX whitespace rules; keep HTML semantics so words never glue together.
  compressHTML: true,
  build: { inlineStylesheets: "always", format: "directory" },
  trailingSlash: "always",
});
