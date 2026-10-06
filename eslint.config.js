import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", ".war-room/**", "apps/landing/.astro/**", "apps/landing/dist/**", "apps/web/.next/**", "apps/web/.next-*/**", "apps/web/next-env.d.ts", "packages/db/src/generated/**", "apps/web/test/e2e/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
);
