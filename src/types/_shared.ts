export type NonEmptyArray<T> = [T, ...T[]];

/** Array with at least 2 elements */
export type NonUnitaryArray<T> = [T, T, ...T[]];

/** Absolute URL starting with https:// or http:// */
export type AbsoluteUrl = `https://${string}` | `http://${string}`;

/** Path starting with / */
export type PathString = `/${string}`;

/** Validation function return */
export type ValidationResult<T> =
  | { valid: true; options: T }
  | { valid: false; issues: string[] };
