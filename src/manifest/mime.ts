/**
 * MIME type and file extension checks for manifest file filters
 * (`file_handlers[].accept` and `share_target.params.files[].accept`).
 *
 * @module
 */

/** Matches `type/subtype` made of RFC 9110 token characters, lowercase. */
const MEDIA_TYPE_RX =
  /^(?<type>[!#$%&'*+.^_`|~\da-z-]+)\/(?<subtype>[!#$%&'*+.^_`|~\da-z-]+)$/u;

/** IANA top-level media types that Chromium accepts in file filters. */
const TOP_LEVEL_TYPES: ReadonlySet<string> = new Set([
  "application",
  "audio",
  "example",
  "font",
  "image",
  "message",
  "model",
  "multipart",
  "text",
  "video"
]);

/** Longest file extension, including the dot, that file handlers accept. */
const MAX_EXTENSION_LENGTH = 16;

/**
 * Checks a MIME type such as `"image/png"` or `"image/*"`: two tokens with
 * an IANA top-level type.
 *
 * @param value - The MIME type to check.
 * @returns `true` if browsers accept the type in a file filter.
 */
export function isValidMediaType(value: string): boolean {
  const groups = MEDIA_TYPE_RX.exec(value.toLowerCase())?.groups;
  return groups?.type !== undefined && TOP_LEVEL_TYPES.has(groups.type);
}

/**
 * Checks a file extension such as `".png"`: a dot followed by at least one
 * character, at most 16 characters in total.
 *
 * @param value - The extension to check.
 * @returns `true` if browsers accept the extension in a file filter.
 */
export function isValidFileExtension(value: string): boolean {
  return (
    value.startsWith(".") &&
    value.length > 1 &&
    value.length <= MAX_EXTENSION_LENGTH
  );
}
