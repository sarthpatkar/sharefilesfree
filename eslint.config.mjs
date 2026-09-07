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
    "next-env.d.ts",
    // Build output is not always at the root. A git worktree under .claude/
    // carries its own .next/, and the pattern above only matches the top
    // level — so generated route types from a side checkout were being linted
    // as if they were source. CI never sees these; a developer does, which is
    // worse, because it makes a clean tree look broken locally.
    "**/.next/**",
    ".claude/**",
    // Minified vendor files copied into public/ by
    // scripts/copy-vendor-assets.mjs (see package.json's postinstall) — not our
    // code, and linting them is meaningless: the tesseract WASM glue alone
    // produces two thousand complaints about generated output nobody will ever
    // edit. They are gitignored, so this only bites after an install.
    "public/pdf.worker.min.mjs",
    "public/tesseract/**",
  ]),
]);

export default eslintConfig;
