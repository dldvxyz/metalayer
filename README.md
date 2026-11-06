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

metalayer has no dependencies and ships ESM and CommonJS builds with type declarations. It runs on Node.js 20 or later and on any runtime with the standard `URL` API, such as Bun, Deno, browsers and edge runtimes.

## Usage

The examples below are route handlers that return the generated file.

### robots.txt

```ts
import { generateRobotsTxt, validateRobotsTxt } from "metalayer";

export function GET(): Response {
  const result = validateRobotsTxt({
    rules: [
      { userAgent: ["*"], allow: ["/"] },
      { userAgent: ["GPTBot"], disallow: ["/"] }
    ],
    sitemaps: ["https://example.com/sitemap.xml"]
  });

  if (!result.valid) {
    throw new Error(result.issues.join("\n"));
  }

  return new Response(generateRobotsTxt(result.options), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "max-age=86400"
    }
  });
}

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

export function GET(): Response {
  const result = validateSitemap({
    origin: "https://example.com",
    urls: [
      { path: "/", lastmod: "2025-01-15", changefreq: "weekly", priority: 1.0 },
      { path: "/about", priority: 0.8 }
    ]
  });

  if (!result.valid) {
    throw new Error(result.issues.join("\n"));
  }

  return new Response(generateSitemap(result.options), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "max-age=86400"
    }
  });
}
```

### Web App Manifest

```ts
import { generateManifest, validateManifest } from "metalayer";

export function GET(): Response {
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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }
    ]
  });

  if (!result.valid) {
    throw new Error(result.issues.join("\n"));
  }

  return new Response(generateManifest(result.options), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "max-age=86400"
    }
  });
}
```

## Validation

Every `validate*` function returns a discriminated union:

```ts
type ValidationResult<T> =
  | { valid: true; options: T }
  | { valid: false; issues: string[] };
```

Validators catch issues like:

- **robots.txt** — user agents that are not product tokens, wildcard mixed with specific agents, duplicate user agents, path patterns containing `#`, spaces or line breaks, equivalent allow/disallow patterns, non-integer crawl delays, sitemap URLs with credentials or fragments, files over the 500 KiB that Google reads
- **sitemap** — invalid URLs, fragments, duplicate URLs, URLs outside the origin, URLs of 2,048 characters or more, more than 50,000 URLs or 50 MB, out-of-range priority, unknown `changefreq` values, impossible or future `lastmod` dates
- **manifest** — non-square or malformed icon sizes, SVG icons with fixed sizes, unknown icon purposes, invalid colors, protocol handler issues, URLs outside the scope (including the default scope browsers derive from `start_url`), an `id` on another origin, invalid file handler and share target file filters, duplicate entries

Generators do not validate their input. Run the matching validator first. Issue messages are meant for people; don't match on their text.

## A note on runtime validation

You probably shouldn't use the validation functions in production unless you're building the metadata programmatically (e.g. generating a sitemap from database entries). For static metadata like `robots.txt` and `manifest.webmanifest`, validate once during development and serve the output directly.

If you do build sitemaps programmatically, consider having a pre-validated fallback so a validation failure doesn't take down your sitemap endpoint entirely.

## Types

All types are exported for use in your own code:

```ts
import type { ManifestOptions, RobotsOptions, SitemapOptions } from "metalayer";
```

Array options are `readonly`, so configuration declared `as const` type-checks without casts. Optional members also accept `undefined`, which helps with `exactOptionalPropertyTypes`.

## Generating strings outside JavaScript

You can use metalayer to generate metadata strings for projects in any language. Clone the repo, install dependencies, edit `scripts/generate.ts` with your configuration, and run:

```bash
git clone https://github.com/dldvxyz/metalayer.git
cd metalayer
bun install
# Edit scripts/generate.ts with your options
bun run generate
```

The output is printed to stdout so you can redirect it to a file or copy it into your project.

## Development

Development requires Bun 1.4 or later and Node.js 24.15 or later, or 22.22.2 or later on Node.js 22 (see `.node-version`).

```bash
bun install     # also installs the Git hooks
bun run check   # lint, typecheck, test, build, then smoke-test the build
```

| Script | What it does |
| --- | --- |
| `bun run lint` | Lint with oxlint (type-aware) and check formatting with oxfmt, through Ultracite |
| `bun run lint:fix` | Fix lint issues and format |
| `bun run typecheck` | Type-check with TypeScript 7, including isolated declarations for `src` |
| `bun run test` | Run unit and type tests with Vitest |
| `bun run build` | Build ESM, CommonJS and declarations with tsdown; publint and arethetypeswrong must pass |

## License

[MIT](./LICENSE)
