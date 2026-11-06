/**
 * Generation of Web App Manifest files.
 *
 * @module
 */

import { normalizeUrl, validateUrl } from "../shared/url.js";
import { serializeImageResources } from "./images.js";
import { PLACEHOLDER_TOKEN, PROTOCOL_PLACEHOLDER } from "./protocols.js";
import type { ManifestOptions } from "./types.js";

/** Normalizes a protocol handler URL template while preserving its `%s` placeholder. */
function normalizeHandlerUrl(url: string): string {
  return normalizeUrl(
    url.replaceAll(PROTOCOL_PLACEHOLDER, PLACEHOLDER_TOKEN)
  ).replaceAll(PLACEHOLDER_TOKEN, PROTOCOL_PLACEHOLDER);
}

/**
 * Generates a Web App Manifest JSON string from the given options.
 *
 * All URL and path fields (src, scope, start_url, shortcut URLs, etc.)
 * are parsed and re-serialized by the platform URL parser, which applies
 * percent-encoding normalization and removes default ports. Image `sizes`
 * given as arrays are written as the manifest's space-separated string,
 * protocol schemes are lowercased, and scope extensions are written with
 * `type: "origin"` and a bare origin. The result is formatted with
 * 2-space indentation and a trailing newline.
 *
 * @remarks
 * This function does not validate the input. Call {@link validateManifest} first
 * to catch configuration errors. Passing invalid options may produce
 * malformed output.
 *
 * @param options - The manifest configuration to generate from.
 * @returns A JSON string suitable for writing to a manifest.webmanifest file.
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
  // Spread into a mutable plain object for field-by-field normalization.
  // Type safety is intentionally relaxed since the output is JSON-serialized.
  const output: Record<string, unknown> = { ...options };

  if (options.id !== undefined) {
    output.id = normalizeUrl(options.id);
  }
  if (options.scope !== undefined) {
    output.scope = normalizeUrl(options.scope);
  }
  if (options.start_url !== undefined) {
    output.start_url = normalizeUrl(options.start_url);
  }
  if (options.icons) {
    output.icons = serializeImageResources(options.icons);
  }
  if (options.screenshots) {
    output.screenshots = serializeImageResources(options.screenshots);
  }
  if (options.shortcuts) {
    output.shortcuts = options.shortcuts.map((shortcut) => ({
      ...shortcut,
      url: normalizeUrl(shortcut.url),
      ...(shortcut.icons && { icons: serializeImageResources(shortcut.icons) })
    }));
  }
  if (options.protocol_handlers) {
    output.protocol_handlers = options.protocol_handlers.map((handler) => ({
      ...handler,
      protocol: handler.protocol.toLowerCase(),
      url: normalizeHandlerUrl(handler.url)
    }));
  }
  if (options.file_handlers) {
    output.file_handlers = options.file_handlers.map((handler) => ({
      ...handler,
      action: normalizeUrl(handler.action),
      ...(handler.icons && { icons: serializeImageResources(handler.icons) })
    }));
  }
  if (options.share_target) {
    output.share_target = {
      ...options.share_target,
      action: normalizeUrl(options.share_target.action)
    };
  }
  if (options.note_taking) {
    output.note_taking = {
      ...options.note_taking,
      new_note_url: normalizeUrl(options.note_taking.new_note_url)
    };
  }
  if (options.related_applications) {
    output.related_applications = options.related_applications.map((app) => ({
      ...app,
      ...(app.url !== undefined && { url: normalizeUrl(app.url) })
    }));
  }
  if (options.scope_extensions) {
    output.scope_extensions = options.scope_extensions.map((extension) => ({
      ...extension,
      type: "origin",
      origin: validateUrl(extension.origin)?.origin ?? extension.origin
    }));
  }

  return JSON.stringify(output, null, 2) + "\n";
}
