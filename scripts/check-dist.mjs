/**
 * Smoke test for the published build.
 *
 * Loads both entry points on plain Node.js (no bundler, no TypeScript),
 * checks that they expose the same API and produce identical output.
 * Run after `bun run build`:
 *   node scripts/check-dist.mjs
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";

/** @typedef {typeof import("../src/index.js")} Api */

const expectedExports = [
  "generateManifest",
  "generateRobotsTxt",
  "generateSitemap",
  "validateManifest",
  "validateRobotsTxt",
  "validateSitemap"
];

/**
 * Checks that a loaded module exposes every public function.
 * @param {unknown} value - The loaded module.
 * @returns {value is Api} Whether the module exposes the public API.
 */
function isApi(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    expectedExports.every(
      (name) => typeof Reflect.get(value, name) === "function"
    )
  );
}

// The dist paths are resolved at runtime so type checking does not depend on a prior build.
const esmEntry = new URL("../dist/index.mjs", import.meta.url).href;
const requireCjs = createRequire(import.meta.url);

/** @type {unknown} */
const esm = await import(esmEntry);
/** @type {unknown} */
const cjs = requireCjs("../dist/index.cjs");
assert.ok(isApi(esm), "ESM build is missing exports");
assert.ok(isApi(cjs), "CJS build is missing exports");

/** @type {import("../src/index.js").RobotsOptions} */
const robots = {
  rules: [
    { userAgent: ["*"], allow: ["/"] },
    { userAgent: ["GPTBot"], disallow: ["/"] }
  ],
  sitemaps: ["https://example.com/sitemap.xml"]
};
/** @type {import("../src/index.js").SitemapOptions} */
const sitemap = {
  origin: "https://example.com",
  urls: [{ path: "/" }, { path: "/about", priority: 0.8 }]
};
/** @type {import("../src/index.js").ManifestOptions} */
const manifest = {
  name: "My App",
  start_url: "/",
  icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
};

/** @type {ReadonlyArray<readonly [string, Api]>} */
const builds = [
  ["esm", esm],
  ["cjs", cjs]
];

for (const [label, api] of builds) {
  const names = Object.keys(api)
    .filter((key) => key !== "__esModule")
    .toSorted();
  assert.deepEqual(names, expectedExports, `${label} exports`);
  assert.equal(api.validateRobotsTxt(robots).valid, true, `${label} robots`);
  assert.equal(api.validateSitemap(sitemap).valid, true, `${label} sitemap`);
  assert.equal(api.validateManifest(manifest).valid, true, `${label} manifest`);
}

assert.equal(esm.generateRobotsTxt(robots), cjs.generateRobotsTxt(robots));
assert.equal(esm.generateSitemap(sitemap), cjs.generateSitemap(sitemap));
assert.equal(esm.generateManifest(manifest), cjs.generateManifest(manifest));
assert.equal(
  esm.generateRobotsTxt(robots),
  "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml\n"
);

console.log(`dist OK on Node ${process.version}`);
