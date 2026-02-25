/**
 * Edit the options below, then run:
 *   bun run generate
 *
 * To save the output to a file, use redirection:
 *   bun run generate > robots.txt
 */

import type { RobotsOptions } from "./src/_barrel.js";
import { generateRobotsTxt, validateRobotsTxt } from "./src/_barrel.js";

const options: RobotsOptions = {
  rules: [
    { userAgent: ["*"], allow: ["/"] },
    { userAgent: ["GPTBot"], disallow: ["/"] }
  ],
  sitemaps: ["https://example.com/sitemap.xml"]
};

const result = validateRobotsTxt(options);

if (!result.valid) {
  console.error(result.issues);
  process.exit(1);
}

// stdout.write instead of console.log to avoid an extra trailing newline
// so the output is the exact file content when redirected.
// The output already ends with a newline — this is advised by the
// robots.txt spec and is standard for all text-based metadata files.
process.stdout.write(generateRobotsTxt(result.options));
