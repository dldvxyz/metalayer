import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Kept from the original Biome setup.
  trailingComma: "none"
});
