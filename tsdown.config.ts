import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // Isolated declarations let tsdown emit .d.ts files with Oxc,
  // without depending on the TypeScript compiler API.
  tsconfig: "tsconfig.build.json",
  dts: true,
  clean: true,
  minify: true,
  // Fail the build on any packaging problem, for every resolution mode
  // (node10, node16 CJS and ESM, bundler).
  publint: { strict: true },
  attw: { profile: "strict", level: "error" },
  failOnWarn: "ci-only"
});
