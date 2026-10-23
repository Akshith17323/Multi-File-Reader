import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  {
    settings: {
      next: {
        rootDir: ["apps/web/"],
      },
    },
  },
  ...nextVitals,
  ...nextTs,
  {
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-use-before-define": "warn",
      "no-use-before-define": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
  },
  {
    files: ["tests/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-this-alias": "off",
    },
  },
  {
    files: ["apps/server/**/*.js", "apps/electron/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-unused-vars": "warn",
      "no-undef": "off",
    },
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "**/.prisma/**",
    "**/generated/**",
    "apps/server/src/multi-file-reader-*.json",
  ]),
]);

export default eslintConfig;
