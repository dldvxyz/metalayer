import { expect } from "vitest";

import type { ValidationResult } from "../src/index.js";

/**
 * Asserts the exact list of issues a validation reported, matching each
 * issue by substring. On failure the diff shows the full actual messages.
 *
 * @param result - The validation result to check.
 * @param expected - One substring per expected issue, in order.
 */
export function expectIssues(
  result: ValidationResult<unknown>,
  expected: readonly string[]
): void {
  const actual = result.valid ? [] : result.issues;
  const matched = actual.map((issue, index) => {
    const substring = expected[index];
    return substring !== undefined && issue.includes(substring)
      ? substring
      : issue;
  });
  expect(matched).toStrictEqual(expected);
}

/**
 * Asserts that a validation passed. On failure the diff shows the issues.
 *
 * @param result - The validation result to check.
 */
export function expectValid(result: ValidationResult<unknown>): void {
  expectIssues(result, []);
}

/**
 * Passes a value through without type checking, to simulate input from
 * JavaScript callers or parsed JSON that the types would reject.
 *
 * @param value - The untyped input.
 * @returns The same value, typed as whatever the call site expects.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- T is inferred from the call site
export function untyped<T>(value: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate escape hatch for runtime-validation tests
  return value as T;
}

/**
 * Parses generated JSON without letting `any` leak into assertions.
 *
 * @param json - The JSON text to parse.
 * @returns The parsed value.
 */
export function parseJson(json: string): unknown {
  const parsed: unknown = JSON.parse(json);
  return parsed;
}
