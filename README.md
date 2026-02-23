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

const options = {
  rules: [
    { userAgent: "*", allow: "/" },
    { userAgent: "GPTBot", disallow: "/" },
  ],
  sitemaps: ["https://example.com/sitemap.xml"],
};

const result = validateRobotsTxt(options);
if (!result.valid) {
  console.error(result.issues);
}

const robotsTxt = generateRobotsTxt(options);
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

const options = {
  urls: [
    {
      loc: "https://example.com/",
      lastmod: "2025-01-15",
      changefreq: "weekly",
      priority: 1.0,
    },
    {
      loc: "https://example.com/about",
      priority: 0.8,
    },
  ],
};

const result = validateSitemap(options);
if (!result.valid) {
  console.error(result.issues);
}

const sitemapXml = generateSitemap(options);
```

### Web App Manifest

```ts
import { generateManifest, validateManifest } from "metalayer";

const options = {
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
};

const result = validateManifest(options);
if (!result.valid) {
  console.error(result.issues);
}

const manifestJson = generateManifest(options);
```

## Validation

Every `validate*` function returns a discriminated union:

```ts
type ValidationResult<T> =
  | { valid: true; options: T }
  | { valid: false; issues: string[] };
```

Validators catch issues like:

- **robots.txt**: wildcard mixed with specific agents, duplicate user agents, overlapping allow/disallow paths
- **sitemap**: invalid URLs, mismatched origins, duplicate URLs, out-of-range priority, invalid dates
- **manifest**: non-square icon sizes, SVG without `sizes: "any"`, invalid colors, protocol handler issues, scope violations

## Types

All types are exported for use in your own code:

```ts
import type {
  RobotsOptions,
  SitemapOptions,
  WebManifestOptions,
} from "metalayer";
```

## License

MIT
