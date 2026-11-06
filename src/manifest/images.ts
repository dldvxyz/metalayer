/**
 * Validation and serialization of manifest image resources (icons and screenshots).
 *
 * @module
 */

import { getPathname, isValidUrlOrPath, normalizeUrl } from "../shared/url.js";
import type { ManifestImageResourceBase } from "./types.js";

/**
 * Matches a size token from the HTML `sizes` grammar: two positive integers
 * without leading zeros, separated by "x" or "X".
 */
const SIZE_RX = /^(?<width>[1-9]\d*)[xX](?<height>[1-9]\d*)$/u;

/** Splits space-separated token lists (`sizes`, `purpose`). */
const WHITESPACE_RX = /\s+/u;

/** Purpose tokens defined by the Web App Manifest specification. */
const PURPOSE_TOKENS: ReadonlySet<string> = new Set([
  "any",
  "maskable",
  "monochrome"
]);

/** Image resource as accepted by the validator: icons may carry a `purpose`, screenshots do not. */
type ImageLike = ManifestImageResourceBase & { purpose?: string };

/** Which rules apply: icons must be square and unique per purpose; screenshots need not. */
export type ImageKind = "icon" | "screenshot";

/** Image resource as written to the manifest JSON: `sizes` is a space-separated string. */
export type SerializedImage<T extends ManifestImageResourceBase> = Omit<
  T,
  "sizes"
> & { sizes?: string };

/** Checks the file extension of the image path, ignoring query strings, hashes and case. */
function hasExtension(image: ImageLike, extension: string): boolean {
  const pathname = getPathname(image.src) ?? image.src.toLowerCase();
  return pathname.endsWith(extension);
}

/** Returns the MIME essence of the image type: lowercase, without parameters. */
function mimeEssence(image: ImageLike): string | undefined {
  return image.type?.split(";")[0]?.trim().toLowerCase();
}

/** Checks if an image resource is SVG by MIME type or file extension. */
function isSvg(image: ImageLike): boolean {
  return mimeEssence(image) === "image/svg+xml" || hasExtension(image, ".svg");
}

/** Checks if an image resource is ICO by MIME type or file extension. */
function isIco(image: ImageLike): boolean {
  const type = mimeEssence(image);
  return (
    type === "image/x-icon" ||
    type === "image/vnd.microsoft.icon" ||
    hasExtension(image, ".ico")
  );
}

/** Checks whether a size token is the (case-insensitive) `any` keyword. */
function isAnySize(token: string): boolean {
  return token.toLowerCase() === "any";
}

/**
 * Normalizes the sizes field to a list of tokens. Accepts the manifest's
 * space-separated string form as well as this library's array form.
 */
function toSizeTokens(
  sizes: ManifestImageResourceBase["sizes"]
): readonly string[] {
  if (sizes === undefined) return [];
  if (typeof sizes === "string") return sizes.trim().split(WHITESPACE_RX);
  return sizes;
}

/**
 * Parses the purpose member into its unique tokens, reporting unknown and
 * repeated tokens. Defaults to `["any"]` when absent.
 */
function parsePurpose(
  purpose: string | undefined,
  label: string,
  issues: string[]
): readonly string[] {
  if (purpose === undefined) return ["any"];

  const tokens = new Set<string>();
  for (const token of purpose.trim().split(WHITESPACE_RX)) {
    if (!PURPOSE_TOKENS.has(token)) {
      issues.push(
        `${label}: unknown purpose "${token}". Use "any", "maskable" or "monochrome".`
      );
    } else if (tokens.has(token)) {
      issues.push(`${label}: purpose token "${token}" is repeated.`);
    }
    tokens.add(token);
  }
  return [...tokens];
}

/** Validates the `sizes` of one image against the rules for its format and kind. */
function validateSizes(
  image: ImageLike,
  label: string,
  kind: ImageKind,
  issues: string[]
): void {
  const tokens = toSizeTokens(image.sizes);

  for (const token of tokens) {
    if (!(isAnySize(token) || SIZE_RX.test(token))) {
      issues.push(
        `${label}: size "${token}" must be "<width>x<height>" with positive integers (e.g. "192x192") or "any".`
      );
    }
  }

  const hasAny = tokens.some(isAnySize);
  if (isSvg(image)) {
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
  if (!isIco(image) && tokens.length > 1) {
    issues.push(`${label}: Only ICO files can have multiple sizes.`);
  }

  if (kind === "icon") {
    // Icons must be square per platform conventions (Android adaptive icons, etc.)
    for (const token of tokens) {
      const groups = SIZE_RX.exec(token)?.groups;
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
 * Checks src validity, purpose tokens, size tokens, SVG/ICO-specific size
 * rules, and (for icons) square-size enforcement. Duplicate `src` values
 * and, for icons, duplicate sizes are reported per purpose token: the
 * same file or size may legitimately appear once as `"any"` and once as
 * `"maskable"`.
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

    const src = normalizeUrl(image.src);
    if (purposes.some((purpose) => seenSrcs.has(`${purpose} ${src}`))) {
      issues.push(`Duplicate src "${image.src}" in ${fieldName}.`);
    }
    for (const purpose of purposes) seenSrcs.add(`${purpose} ${src}`);

    validateSizes(image, label, kind, issues);

    if (kind === "icon") {
      // Two icons with the same size and purpose waste bandwidth; one will always be preferred
      for (const token of toSizeTokens(image.sizes)) {
        if (purposes.some((purpose) => seenSizes.has(`${purpose} ${token}`))) {
          issues.push(`Duplicate size "${token}" in ${fieldName}.`);
        }
        for (const purpose of purposes) seenSizes.add(`${purpose} ${token}`);
      }
    }
  }
}

/**
 * Prepares image resources for JSON output: normalizes each `src` and
 * serializes array `sizes` as the manifest's space-separated string.
 *
 * @param images - The image resources to serialize.
 * @returns New image objects ready for `JSON.stringify`.
 */
export function serializeImageResources<T extends ManifestImageResourceBase>(
  images: readonly T[]
): SerializedImage<T>[] {
  return images.map((image) => {
    const { sizes, ...rest } = image;
    const serialized: SerializedImage<T> = {
      ...rest,
      src: normalizeUrl(image.src)
    };
    if (sizes !== undefined) {
      serialized.sizes = typeof sizes === "string" ? sizes : sizes.join(" ");
    }
    return serialized;
  });
}
