# metalayer

Typesafe utility functions for generating `robots.txt`, `sitemap.xml`, and `manifest.webmanifest`.

Each generator has a matching validator that catches common mistakes before they reach production.

## Installation

```bash
bun add metalayer
```

```bash
npm install metalayer
```

## Usage

### robots.txt

```ts
import { generateRobotsTxt, validateRobotsTxt } from "metalayer";

const result = validateRobotsTxt({
  rules: [
    { userAgent: ["*"], allow: ["/"] },
    { userAgent: ["GPTBot"], disallow: ["/"] },
  ],
  sitemaps: ["https://example.com/sitemap.xml"],
});

if (!result.valid) {
  console.error(result.issues);
  // handle error
}

const robotsTxt = generateRobotsTxt(result.options);
return new Response(robotsTxt, {
  headers: { "Content-Type": "text/plain", "Cache-Control": "max-age=86400" },
});

// User-agent: *
// Allow: /
//
// User-agent: GPTBot
// Disallow: /
//
// Sitemap: https://example.com/sitemap.xml
```

### Sitemap

```ts
import { generateSitemap, validateSitemap } from "metalayer";

const result = validateSitemap({
  origin: "https://example.com",
  urls: [
    { path: "/", lastmod: "2025-01-15", changefreq: "weekly", priority: 1.0 },
    { path: "/about", priority: 0.8 },
  ],
});

if (!result.valid) {
  console.error(result.issues);
  // handle error
}

const sitemapXml = generateSitemap(result.options);
return new Response(sitemapXml, {
  headers: {
    "Content-Type": "application/xml",
    "Cache-Control": "max-age=86400",
  },
});
```

### Web App Manifest

```ts
import { generateManifest, validateManifest } from "metalayer";

const result = validateManifest({
  name: "My App",
  short_name: "App",
  start_url: "/",
  display: "standalone",
  theme_color: "#4285f4",
  background_color: "#ffffff",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  ],
});

if (!result.valid) {
  console.error(result.issues);
  // handle error
}

const manifestJson = generateManifest(result.options);
return new Response(manifestJson, {
  headers: {
    "Content-Type": "application/manifest+json",
    "Cache-Control": "max-age=86400",
  },
});
```

## Validation

Every `validate*` function returns a discriminated union:

```ts
type ValidationResult<T> =
  | { valid: true; options: T }
  | { valid: false; issues: string[] };
```

Validators catch issues like:

- **robots.txt** — wildcard mixed with specific agents, duplicate user agents, overlapping allow/disallow paths, invalid crawl delay
- **sitemap** — invalid URLs, duplicate URLs, out-of-range priority, impossible or future dates
- **manifest** — non-square icon sizes, SVG without `sizes: "any"`, invalid colors, protocol handler issues, scope violations, duplicate categories

## A note on runtime validation

You probably shouldn't use the validation functions in production unless you're building the metadata programmatically (e.g. generating a sitemap from database entries). For static metadata like `robots.txt` and `manifest.webmanifest`, validate once during development and serve the output directly.

If you do build sitemaps programmatically, consider having a pre-validated fallback so a validation failure doesn't take down your sitemap endpoint entirely.

## Types

All types are exported for use in your own code:

```ts
import type { RobotsOptions, SitemapOptions, ManifestOptions } from "metalayer";
```

## Generating strings outside JavaScript

You can use metalayer to generate metadata strings for projects in any language. Clone the repo, install dependencies, edit `generate.ts` with your configuration, and run:

```bash
git clone https://github.com/dldvxyz/metalayer.git
cd metalayer
bun install
# Edit generate.ts with your options
bun run generate
```

The output is printed to stdout so you can redirect it to a file or copy it into your project.

## License

[MIT](./LICENSE)
