import type { ValidationResult } from "./types/_shared.js";
import type {
  ManifestImageResource,
  WebManifestOptions
} from "./types/manifest.js";

const SQUARE_SIZE_RX = /^(\d+)x(\d+)$/;

const CSS_NAMED_COLORS = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "transparent",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen"
]);

const HEX_COLOR_RX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_FN_COLOR_RX = /^(?:rgb|rgba|hsl|hsla)\(.+\)$/i;

const SAFELISTED_PROTOCOLS = new Set([
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

const WEB_PLUS_RX = /^web\+[a-z]+$/;

function isSvg(image: ManifestImageResource): boolean {
  return image.type === "image/svg+xml" || image.src.endsWith(".svg");
}

function toSizesArray(sizes: ManifestImageResource["sizes"]): string[] {
  if (sizes === undefined) return [];
  if (typeof sizes === "string") return [sizes];
  return sizes;
}

function isValidCssColor(color: string): boolean {
  if (HEX_COLOR_RX.test(color)) return true;
  if (CSS_FN_COLOR_RX.test(color)) return true;
  if (CSS_NAMED_COLORS.has(color.toLowerCase())) return true;
  return false;
}

function validateImageResources(
  images: ManifestImageResource[],
  context: string,
  issues: string[]
) {
  const seenSrcs = new Set<string>();
  const seenSizes = new Set<string>();

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const label = context + "[" + i + "]";

    // Duplicate src
    if (seenSrcs.has(image.src)) {
      issues.push(`Duplicate src "${image.src}" in ${context}.`);
    }
    seenSrcs.add(image.src);

    const sizes = toSizesArray(image.sizes);

    if (isSvg(image)) {
      // SVG must have sizes: "any"
      if (image.sizes !== "any") {
        issues.push(`${label}: SVG images must have sizes set to "any".`);
      }
    } else {
      // Non-SVG must not have sizes: "any"
      if (image.sizes === "any") {
        issues.push(`${label}: Only SVG images can have sizes set to "any".`);
      }

      // Each size must be square (NxN where N matches)
      for (const size of sizes) {
        if (size === "any") continue;
        const match = SQUARE_SIZE_RX.exec(size);
        if (!match || match[1] !== match[2]) {
          issues.push(
            `${label}: Icon size "${size}" must be square (e.g. "192x192").`
          );
        }
      }
    }

    // Duplicate sizes across images
    for (const size of sizes) {
      if (seenSizes.has(size)) {
        issues.push(`Duplicate size "${size}" in ${context}.`);
      }
      seenSizes.add(size);
    }
  }
}

function isUrlWithinScope(url: string, scope: string): boolean {
  return url.startsWith(scope);
}

export function validateManifest(
  options: WebManifestOptions
): ValidationResult<WebManifestOptions> {
  const issues: string[] = [];

  // Icons
  if (options.icons) {
    validateImageResources(options.icons, "icons", issues);
  }

  // Screenshots
  if (options.screenshots) {
    validateImageResources(options.screenshots, "screenshots", issues);
  }

  // Shortcuts
  if (options.shortcuts) {
    const seenShortcutNames = new Set<string>();

    for (let i = 0; i < options.shortcuts.length; i++) {
      const shortcut = options.shortcuts[i];

      // Duplicate shortcut names
      if (seenShortcutNames.has(shortcut.name)) {
        issues.push(`Duplicate shortcut name "${shortcut.name}".`);
      }
      seenShortcutNames.add(shortcut.name);

      // Shortcut icons
      if (shortcut.icons) {
        validateImageResources(
          shortcut.icons,
          "shortcuts[" + i + "].icons",
          issues
        );
      }

      // Shortcut URL must be within scope
      if (options.scope && !isUrlWithinScope(shortcut.url, options.scope)) {
        issues.push(
          `Shortcut "${shortcut.name}" URL "${shortcut.url}" is outside the manifest scope "${options.scope}".`
        );
      }
    }
  }

  // start_url must be within scope
  if (
    options.start_url &&
    options.scope &&
    !isUrlWithinScope(options.start_url, options.scope)
  ) {
    issues.push(
      `start_url "${options.start_url}" is outside the manifest scope "${options.scope}".`
    );
  }

  // Colors
  if (options.theme_color && !isValidCssColor(options.theme_color)) {
    issues.push(
      `Invalid theme_color "${options.theme_color}". Must be a valid CSS color (hex, rgb(), hsl(), or named color).`
    );
  }

  if (options.background_color && !isValidCssColor(options.background_color)) {
    issues.push(
      `Invalid background_color "${options.background_color}". Must be a valid CSS color (hex, rgb(), hsl(), or named color).`
    );
  }

  // Protocol handlers
  if (options.protocol_handlers) {
    for (const handler of options.protocol_handlers) {
      // Protocol must be web+<lowercase> or safelisted
      const validProtocol =
        WEB_PLUS_RX.test(handler.protocol) ||
        SAFELISTED_PROTOCOLS.has(handler.protocol);
      if (!validProtocol) {
        issues.push(
          `Invalid protocol "${handler.protocol}". Must start with "web+" followed by lowercase letters, or be a safelisted scheme.`
        );
      }

      // URL must contain %s placeholder
      if (!handler.url.includes("%s")) {
        issues.push(
          `Protocol handler URL "${handler.url}" must contain a "%s" placeholder.`
        );
      }
    }
  }

  // Categories
  if (options.categories) {
    const seenCategories = new Set<string>();
    for (const category of options.categories) {
      const lower = category.toLowerCase();
      if (seenCategories.has(lower)) {
        issues.push(`Duplicate category "${category}".`);
      }
      seenCategories.add(lower);
    }
  }

  // display_override should not only contain the same value as display
  if (
    options.display_override &&
    options.display &&
    options.display_override.length === 1 &&
    options.display_override[0] === options.display
  ) {
    issues.push(
      `display_override contains only "${options.display}", which is the same as display. This is redundant.`
    );
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, options };
}

export function generateManifest(options: WebManifestOptions): string {
  return JSON.stringify(options, null, 2);
}
