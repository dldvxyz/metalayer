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
  publint: true,
  attw: true
});
