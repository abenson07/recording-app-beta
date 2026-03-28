import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "android/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This repo's components intentionally call async loaders inside effects
      // once auth/session is ready; this rule flags that pattern broadly.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
