/**
 * Validation and generation of Web App Manifest files.
 *
 * @module
 */

import type { ValidationResult } from "./types/_shared.js";
import type {
  ManifestImageResourceBase,
  ManifestOptions
} from "./types/manifest.js";
import { isValidUrlOrPath, normalizeUrl, validateUrl } from "./utils/url.js";

/** Matches dimension strings in "WxH" format (e.g. "192x192"). */
const SIZE_RX = /^(\d+)x(\d+)$/;

/**
 * Matches a bare alphabetic word, treated as a named CSS color.
 *
 * This is a deliberate heuristic — validating against the full ~148
 * CSS named colors would be brittle (the list can grow with new specs).
 * The browser is the ultimate validator; we just catch obvious non-colors.
 */
const NAMED_COLOR_RX = /^[a-z]+$/i;

/** Matches hex color values: #RGB, #RGBA, #RRGGBB, or #RRGGBBAA. */
const HEX_COLOR_RX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Matches CSS color functions: rgb(), rgba(), hsl(), hsla(). */
const CSS_FN_COLOR_RX = /^(?:rgb|rgba|hsl|hsla)\(.+\)$/i;

/**
 * URL schemes that browsers recognize as safe to delegate to external handlers,
 * allowed in manifest protocol_handlers without the "web+" prefix.
 *
 * Last synced with the WHATWG living standard on 2025-05-01.
 * @see https://html.spec.whatwg.org/multipage/system-state.html#safelisted-scheme
 */
const SAFELISTED_PROTOCOLS = new Set([
  "bitcoin",
  "ftp",
  "ftps",
  "geo",
  "im",
  "irc",
  "ircs",
  "magnet",
  "mailto",
  "matrix",
  "mms",
  "news",
  "nntp",
  "openpgp4fpr",
  "sftp",
  "sip",
  "sms",
  "smsto",
  "ssh",
  "tel",
  "urn",
  "webcal",
  "wtai",
  "xmpp"
]);

/** Matches custom protocol schemes of the form "web+<lowercase>". */
const WEB_PLUS_RX = /^web\+[a-z]+$/;

/** Matches absolute HTTP(S) URLs. Used to distinguish URL-like ids from freeform strings. */
const ABSOLUTE_URL_RX = /^https?:\/\//;

/** Checks if an image resource is SVG by MIME type or file extension. */
function isSvg(image: ManifestImageResourceBase): boolean {
  return image.type === "image/svg+xml" || image.src.endsWith(".svg");
}

/** Checks if an image resource is ICO by MIME type or file extension. */
function isIco(image: ManifestImageResourceBase): boolean {
  return image.type === "image/x-icon" || image.src.endsWith(".ico");
}

/** Normalizes the sizes field to a flat array, handling the "any" | string | array union. */
function toSizesArray(sizes: ManifestImageResourceBase["sizes"]): string[] {
  if (sizes === undefined) return [];
  if (typeof sizes === "string") return [sizes];
  return sizes;
}

/**
 * Checks whether a string is a recognized CSS color (hex, rgb/hsl function, or named color).
 * Named color detection is a heuristic: any alphabetic-only string passes.
 * This catches obviously malformed values while leaving exact validation to the browser.
 */
function isValidCssColor(color: string): boolean {
  if (HEX_COLOR_RX.test(color)) return true;
  if (CSS_FN_COLOR_RX.test(color)) return true;
  if (NAMED_COLOR_RX.test(color)) return true;
  return false;
}

/**
 * Validates an array of image resources (icons or screenshots).
 *
 * Checks src validity, duplicate srcs, SVG/ICO-specific size rules,
 * and (for icons) square-size enforcement and cross-image size uniqueness.
 */
function validateImageResources(
  images: ManifestImageResourceBase[],
  fieldName: string,
  issues: string[],
  kind: "icon" | "screenshot" = "icon"
) {
  const seenSrcs = new Set<string>();
  const seenSizes = new Set<string>();

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const label = `${fieldName}[${i}]`;

    // Validate src
    if (!isValidUrlOrPath(image.src)) {
      issues.push(`${label}: src "${image.src}" is not a valid URL or path.`);
    }

    // Duplicate src
    if (seenSrcs.has(image.src)) {
      issues.push(`Duplicate src "${image.src}" in ${fieldName}.`);
    }
    seenSrcs.add(image.src);

    const sizes = toSizesArray(image.sizes);

    if (isSvg(image)) {
      // SVG is resolution-independent; fixed sizes are meaningless
      if (image.sizes !== undefined && image.sizes !== "any") {
        issues.push(`${label}: SVG images must have sizes set to "any".`);
      }
    } else {
      // Only SVG can be resolution-independent
      if (image.sizes === "any") {
        issues.push(`${label}: Only SVG images can have sizes set to "any".`);
      }

      // Only ICO is a multi-resolution container format
      if (!isIco(image) && sizes.length > 1) {
        issues.push(`${label}: Only ICO files can have multiple sizes.`);
      }

      if (kind === "icon") {
        // Icons must be square per platform conventions (Android adaptive icons, etc.)
        for (const size of sizes) {
          if (size === "any") continue;
          const match = SIZE_RX.exec(size);
          if (!match || match[1] !== match[2]) {
            issues.push(
              `${label}: Icon size "${size}" must be square (e.g. "192x192").`
            );
          }
        }
      }
    }

    if (kind === "icon") {
      // Two icons at the same size waste bandwidth; one will always be preferred
      for (const size of sizes) {
        if (seenSizes.has(size)) {
          issues.push(`Duplicate size "${size}" in ${fieldName}.`);
        }
        seenSizes.add(size);
      }
    }
  }
}

/**
 * Resolves a URL or path against the given scope origin.
 * Paths starting with "/" are joined with the scope's origin;
 * absolute URLs are validated as-is.
 */
function resolveUrl(url: string, scope: URL): URL | undefined {
  if (url.startsWith("/")) {
    return validateUrl(scope.origin + url);
  }
  return validateUrl(url);
}

/** Normalizes the `src` field of each image resource in an array. */
function normalizeImageSrcs<T extends { src: string }>(images: T[]): T[] {
  return images.map((img) => ({ ...img, src: normalizeUrl(img.src) }));
}

/**
 * Checks whether a resolved URL falls within the given scope URL prefix.
 *
 * Compares full `href` strings (not just pathnames) because the manifest
 * scope includes the origin, enabling cross-origin scope checking.
 * A trailing "/" is appended to the scope (if missing) so that "/app"
 * does not falsely match "/application".
 */
function isWithinScope(resolved: URL, scope: URL): boolean {
  if (resolved.href === scope.href) return true;
  // Ensure scope is treated as a directory prefix to avoid
  // false positives (e.g. /app matching /application)
  const scopePrefix = scope.href.endsWith("/") ? scope.href : scope.href + "/";
  return resolved.href.startsWith(scopePrefix);
}

/** Validates a URL or path, checking scope containment when a scope is available. */
function validateScopedUrl(
  url: string,
  label: string,
  parsedScope: URL | undefined,
  issues: string[]
): void {
  if (parsedScope) {
    const resolved = resolveUrl(url, parsedScope);
    if (!resolved) {
      issues.push(`${label} "${url}" is not a valid URL.`);
    } else if (!isWithinScope(resolved, parsedScope)) {
      issues.push(
        `${label} "${url}" is outside the manifest scope "${parsedScope.href}".`
      );
    }
  } else if (!isValidUrlOrPath(url)) {
    issues.push(`${label} "${url}" is not a valid URL or path.`);
  }
}

/**
 * Validates a Web App Manifest configuration for common mistakes.
 *
 * Checks performed:
 * - Icon and screenshot image resources (valid src, sizes, duplicates)
 * - Scope is a valid absolute URL
 * - id, shortcut URLs, and start_url are valid and within scope
 * - Theme and background colors are valid CSS colors
 * - Protocol handler schemes and URL templates
 * - File handler and share target actions
 * - Duplicate categories and redundant display_override
 * - scope_extensions origins are bare origins
 * - related_applications URLs are valid
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
 *   scope: "https://example.com/",
 *   start_url: "/",
 * });
 * if (!result.valid) console.error(result.issues);
 * ```
 */
export function validateManifest(
  options: ManifestOptions
): ValidationResult<ManifestOptions> {
  const issues: string[] = [];

  // At least one of name or short_name must be a non-empty string
  if (!(options.name?.trim() || options.short_name?.trim())) {
    issues.push(
      'At least one of "name" or "short_name" must be a non-empty string.'
    );
  }

  // Icons
  if (options.icons) {
    validateImageResources(options.icons, "icons", issues);
  }

  // Screenshots
  if (options.screenshots) {
    validateImageResources(
      options.screenshots,
      "screenshots",
      issues,
      "screenshot"
    );
  }

  // Scope validation
  let parsedScope: URL | undefined;
  if (options.scope) {
    parsedScope = validateUrl(options.scope);
    if (!parsedScope) {
      issues.push(
        `Invalid scope "${options.scope}". Must be a valid absolute URL.`
      );
    }
  }

  // Only validate id when it looks like a URL or path.
  // The W3C spec allows any string as id; freeform identifiers
  // like "my-app" are valid and should not be rejected.
  if (
    options.id &&
    (options.id.startsWith("/") || ABSOLUTE_URL_RX.test(options.id))
  ) {
    validateScopedUrl(options.id, "id", parsedScope, issues);
  }

  // Shortcuts
  if (options.shortcuts) {
    const seenShortcutNames = new Set<string>();

    for (let i = 0; i < options.shortcuts.length; i++) {
      const shortcut = options.shortcuts[i];

      // Duplicate shortcut names
      if (seenShortcutNames.has(shortcut.name)) {
        issues.push(`Duplicate shortcut name "${shortcut.name}".`);
      }
      seenShortcutNames.add(shortcut.name);

      // Shortcut icons
      if (shortcut.icons) {
        validateImageResources(shortcut.icons, `shortcuts[${i}].icons`, issues);
      }

      // Shortcut URL validation
      validateScopedUrl(
        shortcut.url,
        `Shortcut "${shortcut.name}" URL`,
        parsedScope,
        issues
      );
    }
  }

  // start_url validation
  if (options.start_url) {
    validateScopedUrl(options.start_url, "start_url", parsedScope, issues);
  }

  // Colors
  for (const field of ["theme_color", "background_color"] as const) {
    const value = options[field];
    if (value && !isValidCssColor(value)) {
      issues.push(
        `Invalid ${field} "${value}". Must be a valid CSS color (hex, rgb(), hsl(), or named color).`
      );
    }
  }

  // Protocol handlers
  if (options.protocol_handlers) {
    for (const handler of options.protocol_handlers) {
      // Protocol must be web+<lowercase> or safelisted
      const validProtocol =
        WEB_PLUS_RX.test(handler.protocol) ||
        SAFELISTED_PROTOCOLS.has(handler.protocol);
      if (!validProtocol) {
        issues.push(
          `Invalid protocol "${handler.protocol}". Must start with "web+" followed by lowercase letters, or be a safelisted scheme.`
        );
      }

      // URL must contain %s placeholder
      if (!handler.url.includes("%s")) {
        issues.push(
          `Protocol handler URL "${handler.url}" must contain a "%s" placeholder.`
        );
      }

      // Replace %s with a dummy value before validation, because the URL
      // parser would percent-decode %s and corrupt the path.
      const handlerUrlForValidation = handler.url.replaceAll("%s", "x");
      validateScopedUrl(
        handlerUrlForValidation,
        `Protocol handler URL "${handler.protocol}"`,
        parsedScope,
        issues
      );
    }
  }

  // File handlers
  if (options.file_handlers) {
    for (const handler of options.file_handlers) {
      validateScopedUrl(
        handler.action,
        "File handler action",
        parsedScope,
        issues
      );
    }
  }

  // Share target
  if (options.share_target) {
    validateScopedUrl(
      options.share_target.action,
      "Share target action",
      parsedScope,
      issues
    );
  }

  // Categories
  if (options.categories) {
    const seenCategories = new Set<string>();
    for (const category of options.categories) {
      const lower = category.toLowerCase();
      if (seenCategories.has(lower)) {
        issues.push(`Duplicate category "${category}".`);
      }
      seenCategories.add(lower);
    }
  }

  // display_override: check for redundancy and duplicates
  if (options.display_override) {
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

    const seenModes = new Set<string>();
    for (const mode of options.display_override) {
      if (seenModes.has(mode)) {
        issues.push(`Duplicate value "${mode}" in display_override.`);
      }
      seenModes.add(mode);
    }
  }

  // Validate scope_extensions origins (must be bare origins, not full URLs)
  if (options.scope_extensions) {
    for (const ext of options.scope_extensions) {
      const parsed = validateUrl(ext.origin);
      if (!parsed) {
        issues.push(
          `scope_extensions origin "${ext.origin}" is not a valid URL.`
        );
      } else if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
        issues.push(
          `scope_extensions origin "${ext.origin}" must be a bare origin (e.g. "https://example.com") without a path, query, or fragment.`
        );
      }
    }
  }

  // Validate related_applications URLs.
  // Platform names and store IDs are opaque strings with no universal
  // format, so only URLs can be structurally validated.
  if (options.related_applications) {
    for (const app of options.related_applications) {
      if (app.url && !validateUrl(app.url)) {
        issues.push(
          `Related application URL "${app.url}" for platform "${app.platform}" is not a valid URL.`
        );
      }
    }
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}

/**
 * Generates a Web App Manifest JSON string from the given options.
 *
 * All URL and path fields (src, scope, start_url, shortcut URLs, etc.)
 * are parsed and re-serialized by the platform URL parser, which applies
 * percent-encoding normalization and removes default ports.
 * The result is formatted with 2-space indentation and a trailing newline.
 *
 * @remarks
 * This function does not validate the input. Call {@link validateManifest} first
 * to catch configuration errors. Passing invalid options may produce
 * malformed output.
 *
 * @param options - The manifest configuration to generate from.
 * @returns A JSON string suitable for writing to a manifest.json file.
 *
 * @example
 * ```ts
 * const json = generateManifest({
 *   name: "My App",
 *   start_url: "/",
 *   display: "standalone",
 *   icons: [{ src: "/icon.png", sizes: "192x192" }],
 * });
 * ```
 */
export function generateManifest(options: ManifestOptions): string {
  // Spread into a mutable plain object for field-by-field URL normalization.
  // Type safety is intentionally relaxed since the output is JSON-serialized.
  const output: Record<string, unknown> = { ...options };

  if (options.id) {
    output.id = normalizeUrl(options.id);
  }
  if (options.scope) {
    output.scope = normalizeUrl(options.scope);
  }
  if (options.start_url) {
    output.start_url = normalizeUrl(options.start_url);
  }
  if (options.shortcuts) {
    output.shortcuts = options.shortcuts.map((shortcut) => ({
      ...shortcut,
      url: normalizeUrl(shortcut.url),
      ...(shortcut.icons && { icons: normalizeImageSrcs(shortcut.icons) })
    }));
  }
  if (options.icons) {
    output.icons = normalizeImageSrcs(options.icons);
  }
  if (options.screenshots) {
    output.screenshots = normalizeImageSrcs(options.screenshots);
  }
  if (options.protocol_handlers) {
    output.protocol_handlers = options.protocol_handlers.map((handler) => {
      // Protect the %s placeholder from percent-encoding by the URL parser.
      // The placeholder is chosen to be vanishingly unlikely in real URLs;
      // a literal "__METALAYER_PS_a9f2__" in a user's URL would be incorrectly replaced.
      const PLACEHOLDER = "__METALAYER_PS_a9f2__";
      const safeUrl = handler.url.replaceAll("%s", PLACEHOLDER);
      const normalized = normalizeUrl(safeUrl).replaceAll(PLACEHOLDER, "%s");
      return { ...handler, url: normalized };
    });
  }
  if (options.file_handlers) {
    output.file_handlers = options.file_handlers.map((handler) => ({
      ...handler,
      action: normalizeUrl(handler.action)
    }));
  }
  if (options.share_target) {
    output.share_target = {
      ...options.share_target,
      action: normalizeUrl(options.share_target.action)
    };
  }
  if (options.related_applications) {
    output.related_applications = options.related_applications.map((app) => ({
      ...app,
      ...(app.url && { url: normalizeUrl(app.url) })
    }));
  }
  if (options.scope_extensions) {
    output.scope_extensions = options.scope_extensions.map((ext) => ({
      ...ext,
      origin: normalizeUrl(ext.origin)
    }));
  }

  return JSON.stringify(output, null, 2) + "\n";
}
