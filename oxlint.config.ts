import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  env: core.env ?? {},
  extends: [core, vitest],
  ignorePatterns: core.ignorePatterns ?? [],
  options: { typeAware: true },
  rules: {
    // Object keys and type members follow the order of the specs they model.
    "sort-keys": "off",
    // Public functions are declarations: hoisted, and named in stack traces.
    "func-style": "off",
    // Kept from the original Biome setup: single-statement `if`s without
    // braces and string concatenation are both fine in this codebase.
    curly: "off",
    "prefer-template": "off",
    // `@remarks` is the TSDoc tag used throughout the public API docs.
    "jsdoc/check-tag-names": ["error", { definedTags: ["remarks"] }]
  },
  overrides: [
    {
      files: ["tests/**"],
      // An override can only configure rules of plugins it enables itself.
      plugins: ["vitest"],
      rules: {
        // The deprecated `host` option is still supported and tested.
        "typescript/no-deprecated": "off",
        // `expectIssues` and `expectValid` assert through `expect`.
        "vitest/expect-expect": [
          "error",
          {
            assertFunctionNames: [
              "expect",
              "expectTypeOf",
              "expectIssues",
              "expectValid"
            ]
          }
        ]
      }
    }
  ]
});
