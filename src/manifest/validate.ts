/**
 * Validation of Web App Manifest configurations.
 *
 * @module
 */

import type { ValidationResult } from "../shared/types.js";
import { isValidUrlOrPath, normalizeUrl, validateUrl } from "../shared/url.js";
import { isValidCssColor } from "./colors.js";
import { validateImageResources } from "./images.js";
import { isValidFileExtension, isValidMediaType } from "./mime.js";
import { validateProtocolHandlers } from "./protocols.js";
import type { ManifestScope } from "./scope.js";
import { deriveDefaultScope, parseScope, validateScopedUrl } from "./scope.js";
import type {
  ManifestDisplayOverride,
  ManifestFileHandler,
  ManifestOptions
} from "./types.js";

/** Matches a URL scheme at the start of a string, e.g. "https:" or "urn:". */
const URL_SCHEME_RX = /^[a-z][a-z\d+.-]*:/iu;

/** Matches an IPv4 address or a bracketed IPv6 address. */
const IP_HOST_RX = /^(?:\d{1,3}(?:\.\d{1,3}){3}|\[[\da-f:.]+\])$/u;

/** Chromium reads only this many scope_extensions entries. */
const MAX_SCOPE_EXTENSIONS = 10;

/** Display modes browsers recognise in `display_override`; anything else is silently skipped. */
const DISPLAY_OVERRIDES: ReadonlySet<string> = new Set([
  "fullscreen",
  "standalone",
  "minimal-ui",
  "browser",
  "window-controls-overlay",
  "tabbed",
  "unframed"
] satisfies ManifestDisplayOverride[]);

/** Checks whether an optional string is absent, empty, or whitespace only. */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/** At least one of name or short_name must be a non-empty string; neither may be blank. */
function validateNames(options: ManifestOptions, issues: string[]): void {
  if (isBlank(options.name) && isBlank(options.short_name)) {
    issues.push(
      'At least one of "name" or "short_name" must be a non-empty string.'
    );
    return;
  }
  for (const field of ["name", "short_name"] as const) {
    const value = options[field];
    if (value !== undefined && value.trim() === "") {
      issues.push(`${field} must not be blank.`);
    }
  }
}

/** Returns the origin of start_url when it is an absolute URL. */
function startUrlOrigin(options: ManifestOptions): string | undefined {
  const startUrl = options.start_url;
  if (startUrl === undefined || startUrl.startsWith("/")) return undefined;
  return validateUrl(startUrl)?.origin;
}

/**
 * Validates the scope member and returns it parsed, or `undefined` if it is
 * absent or invalid (in which case scope checks on other members are
 * skipped). A path scope is resolved against an absolute start_url.
 */
function validateScope(
  options: ManifestOptions,
  origin: string | undefined,
  issues: string[]
): ManifestScope | undefined {
  if (options.scope === undefined) return undefined;

  const scope = parseScope(options.scope, origin);
  if (!scope) {
    issues.push(
      `Invalid scope "${options.scope}". Must be an absolute http(s) URL or a path starting with "/".`
    );
    return undefined;
  }
  if (scope.url.search || scope.url.hash) {
    issues.push(
      `Scope "${options.scope}" must not contain a query or fragment; browsers ignore them.`
    );
  }
  return scope;
}

/**
 * Validates the id. Browsers resolve id against the start_url origin and
 * fall back to start_url when the result is not same-origin; it does not
 * have to be within scope. Paths are always same-origin, and strings without
 * a URL scheme, such as "my-app", resolve to paths.
 */
function validateId(
  options: ManifestOptions,
  appOrigin: string | undefined,
  issues: string[]
): void {
  const { id } = options;
  if (id === undefined) return;
  if (id.trim() === "") {
    issues.push("id must not be blank.");
    return;
  }
  if (id.startsWith("/")) {
    if (!isValidUrlOrPath(id)) {
      issues.push(`id "${id}" is not a valid URL or path.`);
    }
    return;
  }
  if (!URL_SCHEME_RX.test(id)) return;

  let parsed: URL;
  try {
    parsed = new URL(id);
  } catch {
    issues.push(`id "${id}" is not a valid URL.`);
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    issues.push(
      `id "${id}" is a "${parsed.protocol}" URL, so it cannot be same-origin with start_url; browsers ignore it and use start_url. Use a path such as "/" instead.`
    );
  } else if (!validateUrl(id)) {
    issues.push(`id "${id}" is not a valid URL or path.`);
  } else if (appOrigin !== undefined && parsed.origin !== appOrigin) {
    issues.push(
      `id "${id}" must be same-origin with start_url (${appOrigin}); browsers otherwise fall back to start_url.`
    );
  }
}

/** Validates shortcuts: non-empty unique names, valid icons, URLs within scope. */
function validateShortcuts(
  options: ManifestOptions,
  scope: ManifestScope | undefined,
  issues: string[]
): void {
  if (!options.shortcuts) return;

  const seenNames = new Set<string>();
  for (const [index, shortcut] of options.shortcuts.entries()) {
    const label = `shortcuts[${index}]`;
    const name = shortcut.name.trim();

    if (name === "") {
      issues.push(`${label}: name must be a non-empty string.`);
    } else if (seenNames.has(name)) {
      issues.push(`Duplicate shortcut name "${shortcut.name}".`);
    }
    seenNames.add(name);

    if (shortcut.icons) {
      validateImageResources(shortcut.icons, `${label}.icons`, "icon", issues);
    }

    validateScopedUrl(shortcut.url, `${label}: url`, scope, issues);
  }
}

/** theme_color and background_color must be recognisable CSS colors. */
function validateColors(options: ManifestOptions, issues: string[]): void {
  for (const field of ["theme_color", "background_color"] as const) {
    const value = options[field];
    if (value !== undefined && !isValidCssColor(value)) {
      issues.push(
        `Invalid ${field} "${value}". Must be a CSS color such as "#4285f4", "rgb(66 133 244)" or "royalblue".`
      );
    }
  }
}

/** Checks the accept map of a file handler: MIME type keys mapped to file extensions. */
function validateFileHandlerAccept(
  handler: ManifestFileHandler,
  label: string,
  issues: string[]
): void {
  const entries = Object.entries(handler.accept);
  if (entries.length === 0) {
    issues.push(
      `${label}: accept must map at least one MIME type to file extensions; browsers drop the handler otherwise.`
    );
    return;
  }

  for (const [type, value] of entries) {
    if (!isValidMediaType(type)) {
      issues.push(
        `${label}: accept key "${type}" is not a MIME type with a registered top-level type such as "text" or "image".`
      );
    }
    const extensions: readonly string[] =
      typeof value === "string" ? [value] : value;
    if (extensions.length === 0) {
      issues.push(`${label}: "${type}" must list at least one file extension.`);
    }
    for (const extension of extensions) {
      if (!isValidFileExtension(extension)) {
        issues.push(
          `${label}: extension "${extension}" for "${type}" must start with "." and be 2 to 16 characters long.`
        );
      }
    }
  }
}

/** File handler actions must be within scope; accept maps and icons must be valid. */
function validateFileHandlers(
  options: ManifestOptions,
  scope: ManifestScope | undefined,
  issues: string[]
): void {
  if (!options.file_handlers) return;

  for (const [index, handler] of options.file_handlers.entries()) {
    const label = `file_handlers[${index}]`;
    validateScopedUrl(handler.action, `${label}: action`, scope, issues);
    validateFileHandlerAccept(handler, label, issues);
    if (handler.icons) {
      validateImageResources(handler.icons, `${label}.icons`, "icon", issues);
    }
  }
}

/** Checks a share target file filter value: a file extension, a MIME type, or "*\/*". */
function isShareTargetAccept(value: string): boolean {
  return (
    (value.startsWith(".") && value.length > 1) ||
    value === "*/*" ||
    isValidMediaType(value)
  );
}

/**
 * The share target action must be within scope. Receiving files requires a
 * multipart POST, and every file filter must have a name and valid accept
 * values; browsers drop the whole share target otherwise.
 */
function validateShareTarget(
  options: ManifestOptions,
  scope: ManifestScope | undefined,
  issues: string[]
): void {
  const target = options.share_target;
  if (!target) return;

  validateScopedUrl(target.action, "share_target.action", scope, issues);

  const { files } = target.params;
  if (files === undefined) return;

  const isMultipartPost =
    target.method === "POST" && target.enctype === "multipart/form-data";
  if (!isMultipartPost) {
    issues.push(
      'share_target.params.files requires method "POST" and enctype "multipart/form-data"; browsers reject the share target otherwise.'
    );
  }

  for (const [index, file] of files.entries()) {
    const label = `share_target.params.files[${index}]`;
    if (file.name.trim() === "") {
      issues.push(`${label}: name must be a non-empty string.`);
    }
    const accepts: readonly string[] =
      typeof file.accept === "string" ? [file.accept] : file.accept;
    if (accepts.length === 0) {
      issues.push(
        `${label}: accept must list at least one MIME type or file extension.`
      );
    }
    for (const accept of accepts) {
      if (!isShareTargetAccept(accept)) {
        issues.push(
          `${label}: accept value "${accept}" must be a file extension such as ".png" or a MIME type such as "image/*"; browsers drop the whole share target otherwise.`
        );
      }
    }
  }
}

/** Categories are compared case-insensitively; duplicates are flagged. */
function validateCategories(options: ManifestOptions, issues: string[]): void {
  if (!options.categories) return;

  const seen = new Set<string>();
  for (const category of options.categories) {
    const key = category.toLowerCase();
    if (seen.has(key)) {
      issues.push(`Duplicate category "${category}".`);
    }
    seen.add(key);
  }
}

/** display_override values must be known, not redundant with display, and not repeated. */
function validateDisplayOverride(
  options: ManifestOptions,
  issues: string[]
): void {
  if (!options.display_override) return;

  // The spec default for display is "browser", so a single-element
  // override matching the effective display value is always redundant.
  const effectiveDisplay = options.display ?? "browser";
  if (
    options.display_override.length === 1 &&
    options.display_override[0] === effectiveDisplay
  ) {
    issues.push(
      `display_override contains only "${effectiveDisplay}", which is the same as display. This is redundant.`
    );
  }

  const seen = new Set<string>();
  for (const mode of options.display_override) {
    // Widened to string: untyped input may hold any value.
    const value: string = mode;
    if (!DISPLAY_OVERRIDES.has(value)) {
      issues.push(
        value === "borderless"
          ? 'display_override value "borderless" was renamed to "unframed"; browsers no longer recognise "borderless".'
          : `Unknown display_override value "${mode}". Browsers skip values they do not recognise.`
      );
    } else if (seen.has(mode)) {
      issues.push(`Duplicate value "${mode}" in display_override.`);
    }
    seen.add(mode);
  }
}

/**
 * scope_extensions origins must be unique bare https origins without
 * credentials, with a multi-label or IP host; Chromium reads at most ten.
 */
function validateScopeExtensions(
  options: ManifestOptions,
  issues: string[]
): void {
  if (!options.scope_extensions) return;

  if (options.scope_extensions.length > MAX_SCOPE_EXTENSIONS) {
    issues.push(
      `scope_extensions has ${options.scope_extensions.length} entries. Chromium reads only the first ${MAX_SCOPE_EXTENSIONS}.`
    );
  }

  const seenOrigins = new Set<string>();
  for (const [index, extension] of options.scope_extensions.entries()) {
    const label = `scope_extensions[${index}]`;
    const raw = extension.origin;
    const parsed = validateUrl(raw);

    if (!parsed) {
      issues.push(`${label}: origin "${raw}" is not a valid URL.`);
      continue;
    }
    if (parsed.protocol !== "https:") {
      issues.push(`${label}: origin "${raw}" must use the https scheme.`);
    }
    if (
      parsed.pathname !== "/" ||
      raw.includes("?") ||
      raw.includes("#") ||
      parsed.username ||
      parsed.password
    ) {
      issues.push(
        `${label}: origin "${raw}" must be a bare origin (e.g. "https://example.com") without a path, query, fragment or credentials.`
      );
    }
    if (!parsed.hostname.includes(".") && !IP_HOST_RX.test(parsed.hostname)) {
      issues.push(
        `${label}: origin "${raw}" has a single-label host, which Chromium ignores.`
      );
    }
    if (seenOrigins.has(parsed.origin)) {
      issues.push(`Duplicate origin "${raw}" in scope_extensions.`);
    }
    seenOrigins.add(parsed.origin);
  }
}

/**
 * Validates related_applications: URLs must be valid, entries must be
 * unique per platform and identifier, and preferring them requires
 * listing at least one.
 */
function validateRelatedApplications(
  options: ManifestOptions,
  issues: string[]
): void {
  if (
    options.prefer_related_applications === true &&
    options.related_applications === undefined
  ) {
    issues.push(
      "prefer_related_applications is true but related_applications is empty."
    );
  }
  if (!options.related_applications) return;

  const seen = new Set<string>();
  for (const app of options.related_applications) {
    if (app.url !== undefined && !validateUrl(app.url)) {
      issues.push(
        `Related application URL "${app.url}" for platform "${app.platform}" is not a valid URL.`
      );
    }
    const key = `${app.platform} ${app.id ?? normalizeUrl(app.url ?? "")}`;
    if (seen.has(key)) {
      issues.push(
        `Duplicate related application for platform "${app.platform}".`
      );
    }
    seen.add(key);
  }
}

/**
 * Validates a Web App Manifest configuration for common mistakes.
 *
 * Checks performed:
 * - At least one of `name` or `short_name` is a non-empty string
 * - Icon and screenshot image resources (valid src and type, purpose
 *   tokens, size tokens, SVG/ICO rules, square icons, duplicates per
 *   purpose and format)
 * - Scope is an absolute http(s) URL or path without query or fragment
 * - start_url, shortcut URLs, file handler actions, the share target action,
 *   protocol handler URLs and the note-taking URL are valid and within
 *   scope. Without a scope member, the default scope browsers derive from
 *   start_url is used. URLs that are in scope only because the scope lacks
 *   a trailing slash are flagged
 * - A URL-like id is an http(s) URL on the same origin as start_url
 * - Theme and background colors are valid CSS colors
 * - Protocol handler schemes are safelisted or `web+` schemes with a `%s`
 *   placeholder in the path or query, and are registered once
 * - File handler accept maps and share target file filters use valid MIME
 *   types and extensions; a share target that receives files uses a
 *   multipart POST
 * - Duplicate categories and related applications; unknown, redundant or
 *   duplicate display_override values
 * - scope_extensions origins are unique bare https origins with a
 *   multi-label host, at most ten
 * - related_applications URLs are valid and present when preferred
 *
 * @param options - The manifest configuration to validate.
 * @returns `{ valid: true, options }` on success, or
 * `{ valid: false, issues }` with an array of issue descriptions.
 *
 * @example
 * ```ts
 * const result = validateManifest({
 *   name: "My App",
 *   icons: [{ src: "/icon.png", sizes: "192x192" }],
 *   scope: "/",
 *   start_url: "/",
 * });
 * if (!result.valid) console.error(result.issues);
 * ```
 */
export function validateManifest(
  options: ManifestOptions
): ValidationResult<ManifestOptions> {
  const issues: string[] = [];

  validateNames(options, issues);

  if (options.icons) {
    validateImageResources(options.icons, "icons", "icon", issues);
  }
  if (options.screenshots) {
    validateImageResources(
      options.screenshots,
      "screenshots",
      "screenshot",
      issues
    );
  }

  const origin = startUrlOrigin(options);
  const explicitScope = validateScope(options, origin, issues);
  const scope =
    options.scope === undefined && options.start_url !== undefined
      ? deriveDefaultScope(options.start_url, origin)
      : explicitScope;
  const appOrigin =
    origin ??
    (explicitScope && !explicitScope.isRelative
      ? explicitScope.url.origin
      : undefined);

  if (options.start_url !== undefined) {
    validateScopedUrl(options.start_url, "start_url", scope, issues);
  }
  validateId(options, appOrigin, issues);
  validateShortcuts(options, scope, issues);
  validateColors(options, issues);
  if (options.protocol_handlers) {
    validateProtocolHandlers(options.protocol_handlers, scope, issues);
  }
  validateFileHandlers(options, scope, issues);
  validateShareTarget(options, scope, issues);
  if (options.note_taking) {
    validateScopedUrl(
      options.note_taking.new_note_url,
      "note_taking.new_note_url",
      scope,
      issues
    );
  }
  validateCategories(options, issues);
  validateDisplayOverride(options, issues);
  validateScopeExtensions(options, issues);
  validateRelatedApplications(options, issues);

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}
