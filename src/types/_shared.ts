/**
 * Array that is guaranteed to contain at least one element.
 *
 * Used throughout the API to enforce non-empty collections at the type level.
 *
 * @example
 * const agents: NonEmptyArray<string> = ["Googlebot"]; // OK
 * const empty: NonEmptyArray<string> = []; // Type error
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Array that is guaranteed to contain at least two elements.
 *
 * Used where a single-element array would be semantically meaningless
 * (e.g. ICO files with multiple sizes, display_override lists).
 *
 * @remarks
 * Named "non-unitary" to mean "not a single-element array."
 * Sometimes referred to as "AtLeastTwo" in other libraries.
 *
 * @example
 * const sizes: NonUnitaryArray<string> = ["16x16", "32x32"]; // OK
 * const one: NonUnitaryArray<string> = ["16x16"]; // Type error
 */
export type NonUnitaryArray<T> = [T, T, ...T[]];

/**
 * Absolute URL starting with https:// or http://.
 *
 * @example "https://example.com"
 */
export type AbsoluteUrl = `https://${string}` | `http://${string}`;

/**
 * Path starting with /.
 *
 * @example "/"
 * @example "/about"
 */
export type UrlPath = `/${string}`;

/**
 * Discriminated union returned by all validate functions.
 *
 * When valid, contains the original options.
 * When invalid, contains an array of human-readable issue descriptions.
 *
 * @example
 * const result = validateSitemap(options);
 * if (result.valid) {
 *   // TypeScript narrows to { valid: true; options: SitemapOptions }
 *   return new Response(generateSitemap(result.options));
 * } else {
 *   // TypeScript narrows to { valid: false; issues: string[] }
 *   console.error(result.issues);
 * }
 */
export type ValidationResult<T> =
  | {
      valid: true;
      /** The original options, passed through for convenience after type narrowing. */
      options: T;
    }
  | {
      valid: false;
      /** Human-readable descriptions of each issue found. */
      issues: string[];
    };
