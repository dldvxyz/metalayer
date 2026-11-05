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

const esm = await import("../dist/index.mjs");
const cjs = createRequire(import.meta.url)("../dist/index.cjs");

const expectedExports = [
  "generateManifest",
  "generateRobotsTxt",
  "generateSitemap",
  "validateManifest",
  "validateRobotsTxt",
  "validateSitemap"
];

const robots = {
  rules: [
    { userAgent: ["*"], allow: ["/"] },
    { userAgent: ["GPTBot"], disallow: ["/"] }
  ],
  sitemaps: ["https://example.com/sitemap.xml"]
};
const sitemap = {
  origin: "https://example.com",
  urls: [{ path: "/" }, { path: "/about", priority: 0.8 }]
};
const manifest = {
  name: "My App",
  start_url: "/",
  icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
};

for (const [label, api] of [
  ["esm", esm],
  ["cjs", cjs]
]) {
  const names = Object.keys(api)
    .filter((key) => key !== "__esModule")
    .sort();
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
