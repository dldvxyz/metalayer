/**
 * Generation of robots.txt files.
 *
 * @module
 */

import { normalizeUrl } from "../shared/url.js";
import type { RobotsOptions } from "./types.js";
import { encodeLineBreaks, parseHost } from "./values.js";

/**
 * Generates a robots.txt string from the given options.
 *
 * Output order per rule: User-agent directives, Allow paths, Disallow paths,
 * Crawl-delay. Rules are separated by blank lines. Sitemap and Host
 * directives appear after all rules. Path patterns are written verbatim
 * (not normalized) to preserve the `*` and `$` pattern characters.
 * Control characters and line separators in any value are percent-encoded,
 * so a value can never start a new line. The output ends with a trailing
 * newline.
 *
 * @remarks
 * This function does not validate the input. Call {@link validateRobotsTxt}
 * first to catch configuration errors. Passing invalid options may produce
 * malformed output.
 *
 * `Crawl-delay` and `Host` are non-standard directives that Google ignores.
 *
 * @param options - The robots.txt configuration to generate from.
 * @returns The robots.txt file content as a string.
 *
 * @example
 * ```ts
 * const txt = generateRobotsTxt({
 *   rules: [{ userAgent: ["*"], allow: ["/"] }],
 *   sitemaps: ["https://example.com/sitemap.xml"],
 * });
 * ```
 */
export function generateRobotsTxt(options: RobotsOptions): string {
  const lines: string[] = [];

  for (const rule of options.rules) {
    for (const agent of rule.userAgent) {
      lines.push(`User-agent: ${encodeLineBreaks(agent)}`);
    }

    for (const path of rule.allow ?? []) {
      lines.push(`Allow: ${encodeLineBreaks(path)}`);
    }

    for (const path of rule.disallow ?? []) {
      lines.push(`Disallow: ${encodeLineBreaks(path)}`);
    }

    if (rule.crawlDelay !== undefined) {
      lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    }

    lines.push("");
  }

  for (const url of options.sitemaps ?? []) {
    lines.push(`Sitemap: ${encodeLineBreaks(normalizeUrl(url))}`);
  }

  // oxlint-disable-next-line typescript/no-deprecated -- still emitted for compatibility
  const { host } = options;
  if (host !== undefined && host !== "") {
    lines.push(`Host: ${encodeLineBreaks(parseHost(host) ?? host)}`);
  }

  return lines.join("\n").trim() + "\n";
}
