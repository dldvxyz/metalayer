/**
 * Validation and serialization of manifest image resources (icons and screenshots).
 *
 * @module
 */

import { splitAsciiWhitespace, trimAsciiWhitespace } from "../shared/text.js";
import { getPathname, isValidUrlOrPath, normalizeUrl } from "../shared/url.js";
import type { ManifestImageResourceBase } from "./types.js";

/**
 * Matches a lowercased size token from the HTML `sizes` grammar: two
 * positive integers without leading zeros, separated by "x".
 */
const SIZE_RX = /^(?<width>[1-9]\d*)x(?<height>[1-9]\d*)$/u;

/** Matches a bare, lowercased `image/<subtype>` MIME type. */
const IMAGE_MIME_RX = /^image\/[!#$%&'*+.^_`|~\da-z-]+$/u;

/** Purpose tokens defined by the Web App Manifest specification. */
const PURPOSE_TOKENS: ReadonlySet<string> = new Set([
  "any",
  "maskable",
  "monochrome"
]);

/** Image formats implied by common file extensions, used to compare formats. */
const EXTENSION_FORMATS: ReadonlyMap<string, string> = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

/** Image resource as accepted by the validator: icons may carry a `purpose`, screenshots do not. */
type ImageLike = ManifestImageResourceBase & {
  purpose?: string | undefined;
};

/** Which rules apply: icons must be square and unique per purpose; screenshots need not. */
export type ImageKind = "icon" | "screenshot";

/** Returns the lowercase file extension of the image path, ignoring query strings and hashes. */
function extensionOf(image: ImageLike): string | undefined {
  const pathname = getPathname(image.src) ?? image.src.toLowerCase();
  const dot = pathname.lastIndexOf(".");
  return dot > pathname.lastIndexOf("/") ? pathname.slice(dot) : undefined;
}

/** Returns the image format: the MIME essence of `type`, or else the format its extension implies. */
function formatOf(image: ImageLike): string {
  if (image.type !== undefined) {
    const essence = trimAsciiWhitespace(
      image.type.split(";")[0] ?? ""
    ).toLowerCase();
    return essence === "image/vnd.microsoft.icon" ? "image/x-icon" : essence;
  }
  const extension = extensionOf(image);
  return extension === undefined
    ? ""
    : (EXTENSION_FORMATS.get(extension) ?? "");
}

/** Normalizes the sizes field to a list of tokens, accepting the manifest's space-separated string form. */
function toSizeTokens(
  sizes: ManifestImageResourceBase["sizes"]
): readonly string[] {
  if (sizes === undefined) return [];
  if (typeof sizes === "string") return splitAsciiWhitespace(sizes);
  return sizes;
}

/**
 * Parses the purpose member into its unique tokens, reporting unknown and
 * repeated tokens. Defaults to `["any"]` when absent or empty.
 */
function parsePurpose(
  purpose: string | undefined,
  label: string,
  issues: string[]
): readonly string[] {
  const tokens = splitAsciiWhitespace(purpose ?? "");
  if (tokens.length === 0) return ["any"];

  const unique = new Set<string>();
  for (const token of tokens) {
    if (!PURPOSE_TOKENS.has(token)) {
      issues.push(
        `${label}: unknown purpose "${token}". Use "any", "maskable" or "monochrome".`
      );
    } else if (unique.has(token)) {
      issues.push(`${label}: purpose token "${token}" is repeated.`);
    }
    unique.add(token);
  }
  return [...unique];
}

/** Checks that `type`, when given, is a bare image MIME type. */
function validateType(image: ImageLike, label: string, issues: string[]): void {
  if (image.type === undefined) return;

  const [essence = "", ...parameters] = image.type.split(";");
  if (!IMAGE_MIME_RX.test(trimAsciiWhitespace(essence).toLowerCase())) {
    issues.push(
      `${label}: type "${image.type}" is not an image MIME type such as "image/png".`
    );
  } else if (parameters.length > 0) {
    issues.push(
      `${label}: type "${image.type}" has MIME parameters. Chromium ignores images whose type is not a bare MIME type such as "image/svg+xml".`
    );
  }
}

/** Validates the `sizes` of one image against the rules for its format and kind. */
function validateSizes(
  image: ImageLike,
  label: string,
  kind: ImageKind,
  issues: string[]
): void {
  const tokens = toSizeTokens(image.sizes);
  const seen = new Set<string>();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!(lower === "any" || SIZE_RX.test(lower))) {
      issues.push(
        `${label}: size "${token}" must be "<width>x<height>" with positive integers (e.g. "192x192") or "any".`
      );
    }
    if (seen.has(lower)) {
      issues.push(`${label}: size "${token}" is listed twice.`);
    }
    seen.add(lower);
  }

  const format = formatOf(image);
  const hasAny = seen.has("any");
  if (format === "image/svg+xml") {
    // SVG is resolution-independent; fixed sizes are meaningless
    if (tokens.length > 0 && !(tokens.length === 1 && hasAny)) {
      issues.push(`${label}: SVG images must have sizes set to "any".`);
    }
    return;
  }

  // Only SVG can be resolution-independent
  if (hasAny) {
    issues.push(`${label}: Only SVG images can have sizes set to "any".`);
  }

  // Only ICO is a multi-resolution container format
  if (format !== "image/x-icon" && tokens.length > 1) {
    issues.push(`${label}: Only ICO files can have multiple sizes.`);
  }

  if (kind === "icon") {
    // Icons must be square per platform conventions (Android adaptive icons, etc.)
    for (const token of tokens) {
      const groups = SIZE_RX.exec(token.toLowerCase())?.groups;
      if (groups && groups.width !== groups.height) {
        issues.push(
          `${label}: Icon size "${token}" must be square (e.g. "192x192").`
        );
      }
    }
  }
}

/**
 * Validates an array of image resources (icons or screenshots).
 *
 * Checks src validity, `type`, purpose tokens, size tokens, SVG/ICO-specific
 * size rules, and (for icons) square-size enforcement. Duplicate `src`
 * values are reported per purpose token, and duplicate icon sizes per
 * purpose token and image format: the same size may legitimately appear
 * once as `"any"` and once as `"maskable"`, or once as AVIF and once as a
 * PNG fallback.
 *
 * @param images - The image resources to validate.
 * @param fieldName - Manifest member name used in issue messages (e.g. `"icons"`).
 * @param kind - Whether the images are icons or screenshots.
 * @param issues - Mutable array to push any validation issues into.
 */
export function validateImageResources(
  images: readonly ImageLike[],
  fieldName: string,
  kind: ImageKind,
  issues: string[]
): void {
  const seenSrcs = new Set<string>();
  const seenSizes = new Set<string>();

  for (const [index, image] of images.entries()) {
    const label = `${fieldName}[${index}]`;
    const purposes = parsePurpose(image.purpose, label, issues);

    if (!isValidUrlOrPath(image.src)) {
      issues.push(`${label}: src "${image.src}" is not a valid URL or path.`);
    }
    validateType(image, label, issues);

    const src = normalizeUrl(image.src);
    if (purposes.some((purpose) => seenSrcs.has(`${purpose} ${src}`))) {
      issues.push(`Duplicate src "${image.src}" in ${fieldName}.`);
    }
    for (const purpose of purposes) seenSrcs.add(`${purpose} ${src}`);

    validateSizes(image, label, kind, issues);

    if (kind === "icon") {
      // Two icons with the same size, purpose and format waste bandwidth; one will always be preferred
      // Repeats within one image are reported by validateSizes; compare distinct tokens only.
      const distinct = new Map<string, string>();
      for (const token of toSizeTokens(image.sizes)) {
        const lower = token.toLowerCase();
        if (!distinct.has(lower)) distinct.set(lower, token);
      }
      const format = formatOf(image);
      for (const [lower, token] of distinct) {
        const keys = purposes.map((purpose) => `${purpose} ${format} ${lower}`);
        if (keys.some((key) => seenSizes.has(key))) {
          issues.push(`Duplicate size "${token}" in ${fieldName}.`);
        }
        for (const key of keys) seenSizes.add(key);
      }
    }
  }
}

/**
 * Prepares image resources for JSON output: normalizes each `src` and
 * serializes array `sizes` as the manifest's space-separated string,
 * keeping the original key order.
 *
 * @param images - The image resources to serialize.
 * @returns New image objects ready for `JSON.stringify`.
 */
export function serializeImageResources(
  images: readonly ManifestImageResourceBase[]
): Record<string, unknown>[] {
  return images.map((image) => {
    const serialized: Record<string, unknown> = {
      ...image,
      src: normalizeUrl(image.src)
    };
    if (typeof image.sizes === "object") {
      serialized.sizes = image.sizes.join(" ");
    }
    return serialized;
  });
}
