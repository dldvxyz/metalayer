import type {
  AbsoluteUrl,
  NonEmptyArray,
  ValidationResult
} from "./types/_shared.js";
import type { SitemapOptions, SitemapUrl } from "./types/sitemap.js";

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_RX.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return false;
  if (year < 1900 || date > new Date()) return false;
  return true;
}

export function validateSitemap(
  options: SitemapOptions
): ValidationResult<SitemapOptions> {
  const issues: string[] = [];
  const seenUrls = new Set<string>();
  const normalizedUrls: SitemapUrl[] = [];
  let origin: string | undefined;

  for (const url of options.urls) {
    let loc: string;

    // Normalize the URL, check that it's valid and has correct origin
    try {
      const parsed = new URL(url.loc);
      loc = parsed.href;

      if (origin === undefined) {
        origin = parsed.origin;
      } else if (parsed.origin !== origin) {
        issues.push(
          `URL "${loc}" has a different origin than the other URLs. All URLs must share the same origin (${origin}).`
        );
      }
    } catch {
      issues.push(`URL "${url.loc}" is not a valid URL.`);
      loc = url.loc;
    }

    // No duplicate URLs
    if (seenUrls.has(loc)) {
      issues.push(`Duplicate URL "${loc}" found in sitemap.`);
    }
    seenUrls.add(loc);

    // Priority must be between 0 and 1
    if (url.priority !== undefined && (url.priority < 0 || url.priority > 1)) {
      issues.push(
        `Priority ${url.priority} for "${loc}" is out of range. Must be between 0.0 and 1.0.`
      );
    }

    // lastmod must be a real date, not in the future or too far in the past
    if (url.lastmod !== undefined && !isValidDate(url.lastmod)) {
      issues.push(
        `Invalid lastmod "${url.lastmod}" for "${loc}". Must be a valid ISO 8601 date (YYYY-MM-DD).`
      );
    }

    normalizedUrls.push({ ...url, loc: loc as AbsoluteUrl });
  }

  if (issues.length > 0) return { valid: false, issues };
  return {
    valid: true,
    options: { ...options, urls: normalizedUrls as NonEmptyArray<SitemapUrl> }
  };
}

function buildUrlEntry(url: SitemapUrl, pretty: boolean) {
  const i = pretty ? "  " : "";
  const ii = pretty ? "    " : "";
  const nl = pretty ? "\n" : "";

  const parts: string[] = [];
  parts.push(`${i}<url>`);
  parts.push(`${ii}<loc>${url.loc}</loc>`);

  if (url.lastmod) {
    parts.push(`${ii}<lastmod>${url.lastmod}</lastmod>`);
  }
  if (url.changefreq) {
    parts.push(`${ii}<changefreq>${url.changefreq}</changefreq>`);
  }
  if (url.priority !== undefined) {
    parts.push(`${ii}<priority>${url.priority.toFixed(1)}</priority>`);
  }

  parts.push(`${i}</url>`);
  return parts.join(nl);
}

export function generateSitemap(options: SitemapOptions) {
  const pretty = options.pretty !== false;
  const nl = pretty ? "\n" : "";

  const entries = options.urls.map((url) => buildUrlEntry(url, pretty));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>"
  ].join(nl);
}
