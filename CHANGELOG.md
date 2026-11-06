# Changelog

## Unreleased

This release contains breaking changes. Publish it as 2.0.0.

### Breaking changes

- Requires Node.js 20 or later.
- Validators are stricter, so input that 1.x accepted may now be reported. See "Fixed" below.
- Issue messages were reworded, and many now start with the member path, such as `protocol_handlers[0]:`. Don't match on message text.
- Generator output changes:
  - `generateManifest` writes multi-size icon `sizes` as a space-separated string, as the Web App Manifest spec requires. Browsers ignore the array that 1.x wrote.
  - `generateManifest` lowercases protocol handler schemes, writes `scope_extensions` entries as `{ type: "origin", origin }` with a bare origin, and writes a single file handler extension as a one-element list, as browsers and the spec require.
  - `generateSitemap` percent-encodes the characters RFC 3986 forbids in URLs, such as `[`, `]` and `|`, which the sitemap schema rejects.
  - `generateRobotsTxt` writes `host` in canonical form (lowercase, Punycode) and percent-encodes control characters and line separators in every value, so an unvalidated value cannot add a directive.
- Types:
  - `IsoDateTime` requires seconds and a time zone, as the runtime check always did.
  - `ManifestDisplayOverride` no longer accepts arbitrary strings.
  - A share target can declare `files` only as a POST with `enctype: "multipart/form-data"`.
  - `scope_extensions` origins must start with `https://`.
  - `NonEmptyArray` and `NonUnitaryArray` are readonly tuples.
  - Some member types are wider, so code that reads options must handle more forms: `scope` may be a path, file handler `accept` values may be a single string, and `ImagePurpose` has more members.
- The build output moved from `dist/_barrel.*` to `dist/index.*`. Imports through the package entry point are unaffected.

### Fixed

robots.txt:

- Sitemaps may live on any host. 1.x required all sitemaps to share an origin, which no spec asks for.
- `//` inside a path pattern is accepted, as RFC 9309 allows.
- Path patterns containing `#` (which starts a comment), spaces, control characters, line separators (U+2028, U+2029, U+0085), invalid Unicode, or a `$` before the end are rejected instead of being written as-is.
- User agents must be product tokens: letters, digits, `.`, `_` and `-`, which is RFC 9309 plus the digits and dots that deployed crawlers use. Full `User-Agent` header strings, spaces and line breaks are rejected.
- The allow/disallow overlap check normalizes patterns as RFC 9309 does and names each pair. `/products` and `/products?` are no longer reported as identical, while `/%7Ejoe` and `/~joe` now are.
- Crawl delay must be a positive integer.
- Sitemap URLs must be http(s) URLs without credentials (robots.txt is public) or fragments (`#` starts a comment), and duplicates are found after normalization.
- `host` must be a domain name, optionally with an http(s) scheme and a port. Internationalized names are accepted. Values such as `example.com#`, `*` and `//example.com` are rejected. An empty host is treated as absent, as in 1.x.
- An empty `rules` array, and rules without user agents or without Allow and Disallow paths, are reported. Crawlers merge a group without rules into the next group.
- Files larger than the 500 KiB that Google reads are reported.

Sitemap:

- An origin with a query, fragment, credentials, surrounding whitespace or malformed percent-encoding is rejected instead of producing wrong `<loc>` values. An invalid origin is reported once, not once per URL.
- Paths must start with `/` and must not escape the origin's path prefix with `..`. Surrounding whitespace, control characters, fragments (including an empty `#`) and malformed percent-encoding are rejected.
- Duplicates are found after normalization, including percent-encoding case and encoded unreserved characters.
- URLs of 2,048 characters or more, more than 50,000 URLs, sitemaps over 50 MB, an empty `urls` array and unknown `changefreq` values are rejected.
- Computed priorities such as `0.1 * 3` are accepted.
- `lastmod` accepts a date, or a date and time with seconds and a time zone: the forms that both the protocol's W3C Datetime profile and its XML schema accept. Fields are range-checked by the library instead of the JavaScript engine, calendar checks no longer depend on the host time zone, a date that is today anywhere on Earth is accepted, and datetimes tolerate five minutes of clock skew.

Web App Manifest:

- Icons with the same size or file but different purposes, such as `any` and `maskable`, and format fallbacks such as AVIF plus PNG, are no longer reported as duplicates. Duplicate files are compared after URL normalization, and size tokens case-insensitively.
- Scope checks follow the spec. A relative scope is accepted and resolved against an absolute `start_url`. URLs are matched by path, ignoring their query and fragment. Without a `scope` member, URLs are checked against the default scope that browsers derive from `start_url`. A URL that matches only because the scope lacks a trailing slash gets its own message. A scope with a query or fragment is rejected.
- `id` must be same-origin with `start_url` instead of within `scope`, so the recommended `id: "/"` works with a narrower scope. Ids with other schemes, such as `urn:`, are reported because browsers ignore them.
- SVG and ICO detection ignores query strings and letter case, and recognizes `image/vnd.microsoft.icon`.
- Image `type` must be a bare image MIME type. Chromium ignores images whose type has parameters.
- Colors are checked against the CSS Color 4 grammar: hex, the named colors, the legacy comma syntax for `rgb()` and `hsl()`, the modern syntax for every color function, and the `color()` color spaces. Modern functions such as `oklch()`, `lab()` and `color()` are accepted, and `currentcolor` is rejected.
- Size tokens follow the HTML `sizes` grammar, for screenshots as well as icons. Purpose tokens are validated and split on ASCII whitespace, as browsers do.
- Protocol handler messages show the URL as written, `%s` in the host is rejected, and schemes are compared case-insensitively.
- File handler `accept` maps must map registered MIME types to extensions of 2 to 16 characters. Share target file filters need a name and valid MIME types or extensions, and receiving files requires a multipart POST.
- New checks: `display_override` values must be known (`borderless` was renamed to `unframed`), protocols, scope extension origins and related applications must be unique, names and ids must not be blank, `prefer_related_applications` needs related applications, and scope extensions must be at most ten bare https origins with a multi-label host.

### Added

- Manifest members: `iarc_rating_id`, `note_taking`, `related_applications[].min_version` and `fingerprints`, `file_handlers[].name`, `icons` and `launch_type`, the `display_override` values `tabbed` and `unframed`, and suggested `screenshots[].platform` values.
- `scope` accepts a path such as `"/"`.
- `ImagePurpose` accepts every combination of different tokens. Share target `accept` takes MIME types, file handler `accept` values take a single extension, and `ImageSize` accepts an uppercase `X`.
- Readonly (`as const`) input is accepted everywhere, and optional members accept `undefined`.
- Newly exported types: `RobotsPath`, `ImagePurposeToken`, `ScreenshotPlatform`, `ManifestFingerprint`, `ManifestNoteTaking`, `ManifestScopeExtension`, `ManifestShareTargetGet`, `ManifestShareTargetPost`, `ManifestShareTargetPostUrlEncoded`, `ManifestShareTargetPostMultipart`, `ShareTargetAccept`, `ShareTargetFile`, `ShareTargetParams` and `LaunchHandlerClientMode`.
- `UserAgent` suggests current search, AI and link-preview crawlers.

### Deprecated

- `RobotsOptions.host`. Yandex, the crawler that read the Host directive, dropped support for it in 2018. It is still validated and written.

### Packaging and tooling

- Type declarations resolve under every module resolution mode, including `node10`. Every build fails if publint or arethetypeswrong (strict profile) finds a problem, and the smoke test loads the build through the package's own `exports` map.
- Toolchain: TypeScript 7, tsdown instead of the unmaintained tsup, Vitest 5 with type tests, oxlint and oxfmt through Ultracite 8 instead of Biome, lefthook, and GitHub Actions CI that smoke-tests the build on Node.js 20, 22, 24 and 26.
- Source is organized into one folder per file type: `src/robots`, `src/sitemap`, `src/manifest` and `src/shared`. The generator script moved to `scripts/generate.ts`.
