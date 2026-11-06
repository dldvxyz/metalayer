/**
 * Validation of manifest protocol handlers.
 *
 * @module
 */

import { parseUrlOrPath } from "../shared/url.js";
import type { ManifestScope } from "./scope.js";
import { validateScopedUrl } from "./scope.js";
import type { ManifestProtocolHandler } from "./types.js";

/**
 * URL schemes that browsers recognize as safe to delegate to external handlers,
 * allowed in manifest protocol_handlers without the "web+" prefix.
 *
 * @see https://html.spec.whatwg.org/multipage/system-state.html#safelisted-scheme
 */
const SAFELISTED_PROTOCOLS: ReadonlySet<string> = new Set([
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

/** Matches custom protocol schemes of the form "web+<ASCII letters>", after lowercasing. */
const WEB_PLUS_RX = /^web\+[a-z]+$/u;

/** Placeholder that the browser replaces with the handled URL. */
export const PROTOCOL_PLACEHOLDER = "%s";

/**
 * Stand-in for `%s` while a handler URL is parsed or normalized. "%" is a
 * forbidden host code point, so a URL with `%s` in its host would not parse
 * at all; substituting lets the host check and normalization run.
 * Lowercase, because the parser lowercases hosts. Chosen to be vanishingly
 * unlikely in a real URL.
 */
export const PLACEHOLDER_TOKEN = "metalayer-ps-a9f2";

/**
 * Validates protocol handlers: the scheme must be safelisted or a `web+`
 * scheme, the URL template must contain `%s` in its path or query and be
 * a valid URL within the manifest scope, and no scheme may be registered twice.
 *
 * @param handlers - The protocol handlers to validate.
 * @param scope - The parsed scope, or `undefined` if no valid scope is set.
 * @param issues - Mutable array to push any validation issues into.
 */
export function validateProtocolHandlers(
  handlers: readonly ManifestProtocolHandler[],
  scope: ManifestScope | undefined,
  issues: string[]
): void {
  const seenProtocols = new Set<string>();

  for (const [index, handler] of handlers.entries()) {
    const label = `protocol_handlers[${index}]`;
    const protocol = handler.protocol.toLowerCase();

    if (!(WEB_PLUS_RX.test(protocol) || SAFELISTED_PROTOCOLS.has(protocol))) {
      issues.push(
        `${label}: invalid protocol "${handler.protocol}". Must start with "web+" followed by letters, or be a safelisted scheme such as "mailto".`
      );
    }
    if (seenProtocols.has(protocol)) {
      issues.push(
        `Duplicate protocol "${handler.protocol}" in protocol_handlers.`
      );
    }
    seenProtocols.add(protocol);

    if (!handler.url.includes(PROTOCOL_PLACEHOLDER)) {
      issues.push(
        `${label}: URL "${handler.url}" must contain a "%s" placeholder.`
      );
    }

    const substituted = handler.url.replaceAll(
      PROTOCOL_PLACEHOLDER,
      PLACEHOLDER_TOKEN
    );
    if (
      parseUrlOrPath(substituted)?.host.includes(PLACEHOLDER_TOKEN) === true
    ) {
      issues.push(
        `${label}: URL "${handler.url}" has "%s" in its host; the placeholder must be in the path or query.`
      );
    }

    validateScopedUrl(substituted, `${label}: URL`, scope, issues, handler.url);
  }
}
