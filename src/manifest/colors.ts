/**
 * CSS color validation for manifest color members.
 *
 * Browsers parse `theme_color` and `background_color` as CSS `<color>`
 * values and accept any color that can be converted to sRGB without
 * context. This module checks the forms that make sense in a manifest
 * against the CSS Color 4 grammar: hex notation, the named colors, and the
 * `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and
 * `color()` functions. Context-dependent values such as `currentcolor`,
 * system colors and relative colors are rejected.
 *
 * @module
 */

import { splitAsciiWhitespace, trimAsciiWhitespace } from "../shared/text.js";

/** Matches hex color values: #RGB, #RGBA, #RRGGBB, or #RRGGBBAA. */
const HEX_COLOR_RX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/u;

/** Matches a lowercase function call without nested parentheses. */
const COLOR_FUNCTION_RX = /^(?<name>[a-z-]+)\((?<args>[^()]*)\)$/u;

/** Matches a CSS number. */
const NUMBER_RX = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/u;

/** Matches a CSS percentage. */
const PERCENTAGE_RX = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?%$/u;

/** Matches a CSS angle. */
const ANGLE_RX =
  /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:deg|grad|rad|turn)$/u;

/** Channel count of every color function. */
const CHANNEL_COUNT = 3;

/** What a channel accepts, besides `none` in the modern syntax. */
type ChannelKind = "number-or-percentage" | "hue";

const NUMBER_OR_PERCENTAGE: ChannelKind = "number-or-percentage";
const HUE: ChannelKind = "hue";

/** Channels of each function in the modern, space-separated syntax (CSS Color 4). */
const MODERN_CHANNELS: ReadonlyMap<string, readonly ChannelKind[]> = new Map([
  ["rgb", [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["rgba", [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["hsl", [HUE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["hsla", [HUE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["hwb", [HUE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["lab", [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["oklab", [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE]],
  ["lch", [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, HUE]],
  ["oklch", [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, HUE]]
]);

/** Functions that also have the legacy, comma-separated syntax. */
const LEGACY_FUNCTIONS: ReadonlySet<string> = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla"
]);

/** Color spaces of the `color()` function (CSS Color 4). */
const COLOR_SPACES: ReadonlySet<string> = new Set([
  "srgb",
  "srgb-linear",
  "display-p3",
  "display-p3-linear",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz",
  "xyz-d50",
  "xyz-d65"
]);

/**
 * The CSS named colors (CSS Color Module Level 4, section 6.1) plus the
 * `transparent` keyword. Matching is case-insensitive. `currentcolor` is
 * deliberately absent: it depends on context and browsers reject it here.
 */
const NAMED_COLORS: ReadonlySet<string> = new Set([
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
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
  "transparent"
]);

const isNumber = (value: string): boolean => NUMBER_RX.test(value);
const isPercentage = (value: string): boolean => PERCENTAGE_RX.test(value);
const isNumberOrPercentage = (value: string): boolean =>
  isNumber(value) || isPercentage(value);
const isHue = (value: string): boolean =>
  isNumber(value) || ANGLE_RX.test(value);

/** Checks one modern-syntax channel against what its position accepts. */
function isModernChannel(value: string, kind: ChannelKind): boolean {
  if (value === "none") return true;
  return kind === HUE ? isHue(value) : isNumberOrPercentage(value);
}

/**
 * Checks the legacy, comma-separated syntax: three channels and an
 * optional alpha, with no `none`. `rgb()` channels must be all numbers or
 * all percentages; `hsl()` saturation and lightness must be percentages.
 */
function isLegacySyntax(name: string, args: string): boolean {
  if (!LEGACY_FUNCTIONS.has(name)) return false;

  const parts = args.split(",").map(trimAsciiWhitespace);
  if (parts.length !== CHANNEL_COUNT && parts.length !== CHANNEL_COUNT + 1) {
    return false;
  }
  const [first = "", second = "", third = "", alpha] = parts;
  if (alpha !== undefined && !isNumberOrPercentage(alpha)) return false;

  if (name.startsWith("rgb")) {
    const channels = [first, second, third];
    return channels.every(isNumber) || channels.every(isPercentage);
  }
  return isHue(first) && isPercentage(second) && isPercentage(third);
}

/**
 * Checks the modern, space-separated syntax: three channels, then
 * optionally "/" and an alpha. `color()` takes a color space first.
 */
function isModernSyntax(name: string, args: string): boolean {
  const [channelPart = "", alphaPart, ...extra] = args.split("/");
  if (extra.length > 0) return false;

  if (alphaPart !== undefined) {
    const alpha = splitAsciiWhitespace(alphaPart);
    if (
      alpha.length !== 1 ||
      !isModernChannel(alpha[0] ?? "", NUMBER_OR_PERCENTAGE)
    ) {
      return false;
    }
  }

  let channels = splitAsciiWhitespace(channelPart);
  let kinds = MODERN_CHANNELS.get(name);
  if (name === "color") {
    const [space = "", ...rest] = channels;
    if (!COLOR_SPACES.has(space)) return false;
    channels = rest;
    kinds = [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE];
  }

  return (
    kinds !== undefined &&
    channels.length === CHANNEL_COUNT &&
    channels.every((channel, index) =>
      isModernChannel(channel, kinds[index] ?? NUMBER_OR_PERCENTAGE)
    )
  );
}

/**
 * Checks whether a string is a CSS color that browsers accept in a
 * manifest: hex notation, a color function in valid CSS Color 4 syntax,
 * or a CSS named color (case-insensitive).
 *
 * @param color - The color string to check.
 * @returns `true` if the string is a recognised CSS color.
 */
export function isValidCssColor(color: string): boolean {
  const value = trimAsciiWhitespace(color).toLowerCase();
  if (HEX_COLOR_RX.test(value) || NAMED_COLORS.has(value)) return true;

  const groups = COLOR_FUNCTION_RX.exec(value)?.groups;
  if (groups?.name === undefined || groups.args === undefined) return false;

  return groups.args.includes(",")
    ? isLegacySyntax(groups.name, groups.args)
    : isModernSyntax(groups.name, groups.args);
}
