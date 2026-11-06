/**
 * CSS color validation for manifest color members.
 *
 * Browsers parse `theme_color` and `background_color` as CSS `<color>`
 * values and accept any color that can be converted to sRGB without
 * context. This module recognises hex notation, the color functions
 * (`rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`,
 * `color()`) with plausible arguments, and the CSS named colors.
 * Context-dependent values such as `currentcolor` are rejected.
 *
 * @module
 */

/** Matches hex color values: #RGB, #RGBA, #RRGGBB, or #RRGGBBAA. */
const HEX_COLOR_RX = /^#(?:[\da-fA-F]{3,4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/u;

/** Matches a lowercase color function call and captures its name and argument list. */
const COLOR_FUNCTION_RX =
  /^(?<name>rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?<args>[^()]*)\)$/u;

/** Matches a numeric color component: number or percentage, optional angle unit, or the `none` keyword. */
const COLOR_COMPONENT_RX =
  /^(?:none|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|deg|grad|rad|turn)?)$/u;

/** Matches a predefined color-space identifier for `color()` (e.g. `srgb`, `display-p3`, `xyz-d65`). */
const COLOR_SPACE_RX = /^[a-z][a-z0-9-]*$/u;

/** Splits color-function arguments on commas, whitespace, or the alpha slash. */
const COLOR_ARGUMENT_SEPARATOR_RX = /\s*[,/]\s*|\s+/u;

/** Three channels, optionally followed by alpha. */
const MIN_CHANNELS = 3;
const MAX_CHANNELS = 4;

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

/** Checks that every component is numeric and that there are three channels plus an optional alpha. */
function hasValidChannels(components: readonly string[]): boolean {
  return (
    components.length >= MIN_CHANNELS &&
    components.length <= MAX_CHANNELS &&
    components.every((component) => COLOR_COMPONENT_RX.test(component))
  );
}

/**
 * Checks whether the arguments of a color function look like a color.
 * `color()` takes a color-space identifier before its channels; the other
 * functions take channels only.
 */
function hasValidColorArguments(name: string, args: string): boolean {
  const components = args.trim().split(COLOR_ARGUMENT_SEPARATOR_RX);
  if (name !== "color") return hasValidChannels(components);

  const [space, ...channels] = components;
  return (
    space !== undefined &&
    COLOR_SPACE_RX.test(space) &&
    hasValidChannels(channels)
  );
}

/**
 * Checks whether a string is a CSS color that browsers accept in a
 * manifest: hex notation, a color function with plausible arguments, or
 * a CSS named color (case-insensitive).
 *
 * @param color - The color string to check.
 * @returns `true` if the string is a recognised CSS color.
 */
export function isValidCssColor(color: string): boolean {
  const trimmed = color.trim();
  if (HEX_COLOR_RX.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (NAMED_COLORS.has(lower)) return true;

  const groups = COLOR_FUNCTION_RX.exec(lower)?.groups;
  if (groups?.name === undefined || groups.args === undefined) return false;
  return hasValidColorArguments(groups.name, groups.args);
}
