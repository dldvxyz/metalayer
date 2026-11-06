/**
 * Text helpers that follow the web platform's definition of whitespace.
 *
 * Manifest token lists (`sizes`, `purpose`) and CSS values are split and
 * trimmed on ASCII whitespace only. JavaScript's `\s` and `String#trim`
 * also treat characters such as U+00A0 NO-BREAK SPACE as whitespace, which
 * would accept values that browsers parse differently.
 *
 * @module
 */

/** Matches a run of ASCII whitespace: tab, line feed, form feed, carriage return and space. */
const ASCII_WHITESPACE_RX = /[\t\n\f\r ]+/u;

/** Matches leading or trailing ASCII whitespace. */
const ASCII_WHITESPACE_EDGES_RX = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu;

/**
 * Removes leading and trailing ASCII whitespace.
 *
 * @param value - The string to trim.
 * @returns The string without surrounding ASCII whitespace.
 */
export function trimAsciiWhitespace(value: string): string {
  return value.replaceAll(ASCII_WHITESPACE_EDGES_RX, "");
}

/**
 * Splits a string on ASCII whitespace, ignoring leading and trailing runs.
 *
 * @param value - The space-separated token list.
 * @returns The tokens; empty when the string contains only whitespace.
 */
export function splitAsciiWhitespace(value: string): string[] {
  const trimmed = trimAsciiWhitespace(value);
  return trimmed === "" ? [] : trimmed.split(ASCII_WHITESPACE_RX);
}

/** Largest code points encoded in one, two and three UTF-8 bytes. */
const MAX_ONE_BYTE = 0x7f;
const MAX_TWO_BYTES = 0x7_ff;
const MAX_THREE_BYTES = 0xff_ff;

/**
 * Counts the bytes a string occupies when encoded as UTF-8.
 *
 * @param value - The string to measure.
 * @returns The UTF-8 byte length.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= MAX_ONE_BYTE) bytes += 1;
    else if (codePoint <= MAX_TWO_BYTES) bytes += 2;
    else if (codePoint <= MAX_THREE_BYTES) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
