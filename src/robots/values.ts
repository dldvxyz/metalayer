/**
 * Rules for values written into robots.txt, shared by the validator and
 * the generator so the two cannot drift.
 *
 * @module
 */

import { validateUrl } from "../shared/url.js";

/**
 * Matches control characters (C0, DEL and C1, including U+0085 NEXT LINE)
 * and U+2028/U+2029. Some robots.txt parsers, such as Python's, split lines
 * on all of them, so a raw one would start a new directive.
 */
const LINE_BREAK_OR_CONTROL_RX = /[\p{Cc}\u2028\u2029]/u;

/** Global variant of {@link LINE_BREAK_OR_CONTROL_RX}, for replacing. */
const LINE_BREAK_OR_CONTROL_GLOBAL_RX = /[\p{Cc}\u2028\u2029]/gu;

/** Matches a Host value: an optional http(s) scheme, a hostname and an optional port. */
const HOST_RX =
  /^(?<scheme>https?:\/\/)?(?<hostname>[^\s/?#\\@:[\]]+)(?::(?<port>\d{1,5}))?$/iu;

/** Matches an ASCII DNS name: LDH labels and a letter or Punycode top-level label, with an optional trailing dot. */
const DNS_NAME_RX =
  /^(?:(?!-)[a-z\d-]{1,63}(?<!-)\.)+(?:[a-z]{2,63}|xn--[a-z\d-]{1,59})\.?$/u;

/** Longest DNS name, including a trailing dot. */
const MAX_DNS_NAME_LENGTH = 254;

/** Highest TCP port number. */
const MAX_PORT = 65_535;

/**
 * Checks whether a value contains a control character or line separator.
 *
 * @param value - The value to check.
 * @returns `true` if writing the value raw could break the line structure.
 */
export function hasLineBreakOrControl(value: string): boolean {
  return LINE_BREAK_OR_CONTROL_RX.test(value);
}

/**
 * Percent-encodes control characters and line separators so that a value
 * can never start a new line, even when the options were not validated.
 *
 * @param value - The value to write.
 * @returns The value with those characters percent-encoded.
 */
export function encodeLineBreaks(value: string): string {
  return value.replaceAll(LINE_BREAK_OR_CONTROL_GLOBAL_RX, (char) =>
    encodeURIComponent(char)
  );
}

/**
 * Parses a Host directive value: a DNS name with an optional http(s)
 * scheme and port. Internationalized names are converted to Punycode and
 * letters are lowercased.
 *
 * @param value - The Host value as configured.
 * @returns The canonical value, or `undefined` if it is not a valid host.
 */
export function parseHost(value: string): string | undefined {
  const groups = HOST_RX.exec(value)?.groups;
  if (groups?.hostname === undefined) return undefined;
  if (groups.port !== undefined && Number(groups.port) > MAX_PORT) {
    return undefined;
  }

  const hostname = validateUrl(`https://${groups.hostname}`)?.hostname;
  if (
    hostname === undefined ||
    hostname.length > MAX_DNS_NAME_LENGTH ||
    !DNS_NAME_RX.test(hostname)
  ) {
    return undefined;
  }

  const scheme = groups.scheme?.toLowerCase() ?? "";
  const port = groups.port === undefined ? "" : `:${groups.port}`;
  return scheme + hostname + port;
}
