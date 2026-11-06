# Changelog

## Unreleased

This release contains breaking changes. Publish it as 2.0.0.

### Breaking changes

- Requires Node.js 20 or later.
- Validators are stricter, so input that 1.x accepted may now be reported. See "Fixed" below.
- `generateManifest` writes multi-size icon `sizes` as a space-separated string, as the Web App Manifest spec requires. Browsers ignore the array that 1.x wrote.
- `generateManifest` lowercases protocol handler schemes, and writes `scope_extensions` entries as `{ type: "origin", origin }` with a bare origin, which browsers require.
- Types:
  - `IsoDate` requires a two-digit month and day. `IsoDateTime` requires a time zone.
  - `ManifestDisplayOverride` no longer accepts arbitrary strings.
  - A POST share target can declare `files` only together with `enctype: "multipart/form-data"`.
  - `scope_extensions` origins must start with `https://`.
  - `NonEmptyArray` and `NonUnitaryArray` are readonly tuples.
- The build output moved from `dist/_barrel.*` to `dist/index.*`. Imports through the package entry point are unaffected.

### Fixed

robots.txt:

- Sitemaps may live on any host. 1.x required all sitemaps to share an origin, which no spec asks for.
- `//` inside a path pattern is accepted, as RFC 9309 allows.
- Path patterns containing `#` (which starts a comment), spaces, line breaks, or a `$` before the end are rejected instead of being written as-is.
- User agents must be RFC 9309 product tokens. Full `User-Agent` header strings and line breaks are rejected.
- The allow/disallow overlap check normalizes patterns as RFC 9309 does. `/products` and `/products?` are no longer reported as identical, while `/%7Ejoe` and `/~joe` now are.
- Crawl delay must be a positive integer.
- `host` accepts internationalized names, ports and an `https://` prefix.
- Clearer messages for `["*", "*"]` and for an agent listed twice in one rule.

Sitemap:

- An origin with a query, fragment or credentials is rejected instead of producing wrong `<loc>` values. An invalid origin is reported once, not once per URL.
- Paths must start with `/`. Leading or trailing whitespace, control characters, fragments and malformed percent-encoding are rejected.
- URLs of 2,048 characters or more, more than 50,000 URLs, an empty `urls` array and unknown `changefreq` values are rejected.
- `lastmod` accepts every W3C Datetime form the protocol uses, including times without seconds. Fields are range-checked by the library instead of the JavaScript engine, calendar checks no longer depend on the host time zone, a date that is today anywhere on Earth is accepted, and datetimes tolerate five minutes of clock skew.

Web App Manifest:

- Icons with the same size or file but different purposes, such as `any` and `maskable`, are no longer reported as duplicates. Duplicate files are compared after URL normalization.
- Scope checks follow the spec. Query strings and fragments are ignored, a relative scope is accepted, and a URL that matches only because the scope lacks a trailing slash gets its own message.
- `id` must be same-origin with `start_url` instead of within `scope`, so the recommended `id: "/"` works with a narrower scope.
- SVG and ICO detection ignores query strings and letter case, and recognizes `image/vnd.microsoft.icon` and MIME parameters.
- Colors are checked against the CSS named colors and plausible function arguments. Modern color functions such as `oklch()`, `lab()` and `color()` are accepted, and `currentcolor` is rejected.
- Size tokens follow the HTML `sizes` grammar, for screenshots as well as icons.
- Unknown or repeated icon purpose tokens are rejected.
- Protocol handler messages show the URL as written, `%s` in the host is rejected, and schemes are compared case-insensitively.
- New checks: a share target that receives files must use a multipart POST, `display_override` values must be known, protocols, file handler actions, scope extension origins and related applications must be unique, names must not be blank, `prefer_related_applications` needs related applications, and scope extensions must be bare https origins.

### Added

- Manifest members: `iarc_rating_id`, `note_taking`, `related_applications[].min_version` and `fingerprints`, `file_handlers[].name`, `icons` and `launch_type`, the `display_override` values `tabbed` and `borderless`, and suggested `screenshots[].platform` values.
- `scope` accepts a path such as `"/"`.
- `ImagePurpose` accepts every combination of `any`, `maskable` and `monochrome`. Share target `accept` takes MIME types, and file handler `accept` values take a single extension.
- Readonly (`as const`) input is accepted everywhere.
- Newly exported types: `RobotsPath`, `ImagePurposeToken`, `ScreenshotPlatform`, `ManifestFingerprint`, `ManifestNoteTaking`, `ManifestScopeExtension`, `ManifestShareTargetGet`, `ManifestShareTargetPost`, `ManifestShareTargetPostUrlEncoded`, `ManifestShareTargetPostMultipart`, `ShareTargetAccept`, `ShareTargetFile`, `ShareTargetParams` and `LaunchHandlerClientMode`.
- `UserAgent` suggests current search, AI and link-preview crawlers.

### Deprecated

- `RobotsOptions.host`. Yandex, the crawler that read the Host directive, dropped support for it in 2018. It is still validated and written.

### Packaging and tooling

- Type declarations resolve under every module resolution mode, including `node10`. Every build runs publint and arethetypeswrong.
- Toolchain: TypeScript 7, tsdown instead of the unmaintained tsup, Vitest 5 with type tests, oxlint and oxfmt through Ultracite 8 instead of Biome, lefthook, and GitHub Actions CI that smoke-tests the build on Node.js 20, 22, 24 and 26.
- Source is organized into one folder per file type: `src/robots`, `src/sitemap`, `src/manifest` and `src/shared`. The generator script moved to `scripts/generate.ts`.
