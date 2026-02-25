import type {
  AbsoluteUrl,
  NonEmptyArray,
  NonUnitaryArray,
  UrlPath
} from "./_shared.js";

/**
 * Display mode for the web app.
 *
 * - `"fullscreen"` — Full screen with no browser UI.
 * - `"standalone"` — Standalone app window without browser navigation UI.
 * - `"minimal-ui"` — Standalone window with minimal browser UI (e.g. back button).
 * - `"browser"` — Standard browser tab (default).
 */
export type ManifestDisplay =
  | "fullscreen"
  | "standalone"
  | "minimal-ui"
  | "browser";

/** Display mode override; accepts standard modes plus "window-controls-overlay" or any custom string. */
export type ManifestDisplayOverride =
  | ManifestDisplay
  | "window-controls-overlay"
  | (string & {});

/**
 * Preferred screen orientation for the web app.
 *
 * - `"any"` — No preference; follows device orientation.
 * - `"natural"` — Natural orientation of the device (portrait on phones, landscape on tablets).
 * - `"landscape"` / `"portrait"` — Either primary or secondary variant.
 * - `"landscape-primary"` / `"portrait-primary"` — The "default" landscape/portrait rotation.
 * - `"landscape-secondary"` / `"portrait-secondary"` — The "upside-down" landscape/portrait rotation.
 */
export type ManifestOrientation =
  | "any"
  | "natural"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary";

/** Purpose of a manifest image resource. */
export type ImagePurpose =
  | "any"
  | "maskable"
  | "monochrome"
  | "maskable monochrome"
  | "monochrome maskable";

/** MIME type of a manifest image resource. Common types are provided as autocomplete suggestions. */
export type ImageMimeType =
  | "image/png"
  | "image/svg+xml"
  | "image/webp"
  | "image/x-icon"
  | (`image/${string}` & {});

/**
 * Image dimensions in "widthxheight" format (e.g. `"192x192"`).
 *
 * Both dimensions must be positive integers. For icons,
 * {@link validateManifest} also enforces that sizes are square.
 */
export type ImageSize = `${number}x${number}`;

/**
 * CSS color value (sRGB only).
 *
 * The W3C manifest spec restricts `theme_color` and `background_color`
 * to sRGB colors. Modern CSS functions like `oklch()`, `lab()`, and
 * `color()` are not supported in manifest color fields.
 *
 * Accepted formats: hex (`#rgb`, `#rrggbb`, `#rrggbbaa`),
 * `rgb()`, `rgba()`, `hsl()`, `hsla()`, or a named color (e.g. `"rebeccapurple"`).
 *
 * @example "#4285f4"
 * @example "rgb(66, 133, 244)"
 * @example "hsl(217, 89%, 61%)"
 */
export type CssColor =
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`
  | (string & {});

/**
 * Absolute URL or URL path starting with "/".
 *
 * Used for manifest fields that accept either form
 * (e.g. `start_url`, `scope`, icon `src`).
 *
 * @example "https://example.com/icon.png"
 * @example "/icon.png"
 */
export type UrlOrPath = AbsoluteUrl | UrlPath;

/**
 * Base fields shared by all manifest image resources (icons and screenshots).
 *
 * Primarily used internally for shared validation logic.
 * Most users should use {@link ManifestImageResource} or
 * {@link ManifestScreenshot} instead.
 */
export interface ManifestImageResourceBase {
  /** URL or path to the image file. */
  src: UrlOrPath;
  /** Image dimensions. Format depends on the resource type. */
  sizes?: "any" | ImageSize | NonUnitaryArray<ImageSize>;
  /** MIME type of the image (e.g. `"image/png"`). */
  type?: ImageMimeType;
}

/** An image resource in the manifest (used for icons). */
export interface ManifestImageResource extends ManifestImageResourceBase {
  /**
   * One or more image dimensions.
   *
   * Use `"any"` for scalable formats (SVG). ICO files may specify multiple sizes.
   * All other formats must specify a single size.
   *
   * @example "192x192"
   * @example ["16x16", "32x32"] // ICO only
   */
  sizes?: "any" | ImageSize | NonUnitaryArray<ImageSize>;
  /**
   * Intended purpose of the image.
   * @default "any"
   */
  purpose?: ImagePurpose;
}

/** A screenshot entry for the manifest. */
export interface ManifestScreenshot extends ManifestImageResourceBase {
  /**
   * Image dimensions.
   *
   * Use `"any"` for scalable formats (SVG).
   * Unlike icons, screenshots cannot declare multiple sizes.
   *
   * @example "1280x720"
   */
  sizes?: "any" | ImageSize;
  /** Accessible description of the screenshot. */
  label?: string;
  /** Platform the screenshot was taken on (e.g. `"iOS"`, `"Android"`, `"Windows"`). */
  platform?: string;
  /** Form factor: `"narrow"` for mobile, `"wide"` for desktop/tablet. */
  form_factor?: "narrow" | "wide";
}

/** A shortcut entry for the manifest app. */
export interface ManifestShortcut {
  /** Human-readable label for the shortcut. */
  name: string;
  /** Short version of the name, used where space is limited. */
  short_name?: string;
  /** Description of what the shortcut does. */
  description?: string;
  /** URL that opens when the shortcut is activated. Must be within the manifest scope. */
  url: UrlOrPath;
  /** Icons representing this shortcut. */
  icons?: NonEmptyArray<ManifestImageResource>;
}

/**
 * A related native application listing. Requires at least one of `url` or `id`.
 *
 * @example { platform: "play", url: "https://play.google.com/store/apps/details?id=com.example" }
 * @example { platform: "itunes", id: "123456789" }
 */
export type ManifestRelatedApplication =
  | {
      /** Application platform (e.g. `"play"`, `"itunes"`, `"windows"`). */
      platform: string;
      /** URL to the application's store listing. */
      url: AbsoluteUrl;
      /** Platform-specific application identifier (e.g. a package name or store ID). */
      id?: string;
    }
  | {
      /** Application platform (e.g. `"play"`, `"itunes"`, `"windows"`). */
      platform: string;
      /** URL to the application's store listing. */
      url?: AbsoluteUrl;
      /** Platform-specific application identifier (e.g. a package name or store ID). */
      id: string;
    };

/** A custom protocol handler registration. */
export interface ManifestProtocolHandler {
  /**
   * Protocol scheme to handle. Must be a safelisted scheme (e.g. `"mailto"`, `"tel"`)
   * or start with `"web+"` followed by lowercase letters (e.g. `"web+myapp"`).
   */
  protocol: string;
  /**
   * URL template that handles the protocol. Must contain a `"%s"` placeholder
   * that will be replaced with the protocol URL.
   *
   * @example "/handle?url=%s"
   */
  url: UrlOrPath;
}

/** A file type handler registration. */
export interface ManifestFileHandler {
  /**
   * URL that handles the file open action.
   * @example "/open-file"
   */
  action: UrlOrPath;
  /**
   * Map of MIME types to accepted file extensions.
   *
   * @example { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] }
   */
  accept: Record<`${string}/${string}`, NonEmptyArray<`.${string}`>>;
}

// Internal types composing the ManifestShareTarget discriminated union.

/** Parameters that can be shared to the target app. */
interface ShareTargetParams {
  /** Name of the query parameter for the shared title. */
  title?: string;
  /** Name of the query parameter for the shared text. */
  text?: string;
  /** Name of the query parameter for the shared URL. */
  url?: string;
}

/** A file type accepted by a share target. */
interface ShareTargetFile {
  /** Name of the form field for the file data. */
  name: string;
  /** Accepted file extension(s) (e.g. `".png"` or `[".jpg", ".jpeg"]`). */
  accept: `.${string}` | NonUnitaryArray<`.${string}`>;
}

/** Share target using HTTP GET. Params are appended as query string parameters. */
interface ManifestShareTargetGet {
  /** URL that handles the share action. Must be within the manifest scope. */
  action: UrlOrPath;
  /** HTTP method. Omit or set to `"GET"` for query-string-based sharing. */
  method?: "GET";
  /** Parameters to include in the share URL's query string. */
  params: ShareTargetParams;
}

/** Share target using HTTP POST. Supports file uploads via the `files` param. */
interface ManifestShareTargetPost {
  /** URL that handles the share action. Must be within the manifest scope. */
  action: UrlOrPath;
  /** HTTP method. Must be `"POST"` for form-based sharing. */
  method: "POST";
  /** Encoding type for the POST body. Use `"multipart/form-data"` when sharing files. */
  enctype?: "application/x-www-form-urlencoded" | "multipart/form-data";
  /** Parameters to include in the POST body, optionally including files. */
  params: ShareTargetParams & {
    /** Files the share target accepts. */
    files?: NonEmptyArray<ShareTargetFile>;
  };
}

/**
 * Web Share Target configuration (GET or POST).
 *
 * @example
 * // GET share target
 * { action: "/share", method: "GET", params: { title: "title", url: "url" } }
 *
 * @example
 * // POST share target with file upload
 * { action: "/share", method: "POST", enctype: "multipart/form-data", params: { files: [{ name: "media", accept: [".png", ".jpg"] }] } }
 */
export type ManifestShareTarget =
  | ManifestShareTargetGet
  | ManifestShareTargetPost;

// Internal: valid client_mode values for ManifestLaunchHandler.
type LaunchHandlerClientMode =
  | "auto"
  | "navigate-new"
  | "navigate-existing"
  | "focus-existing";

/**
 * Launch handler configuration for controlling how the app responds
 * when launched while already running.
 *
 * `client_mode` determines whether a new window is opened or an
 * existing one is reused.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Manifest/launch_handler
 */
export interface ManifestLaunchHandler {
  client_mode?:
    | LaunchHandlerClientMode
    | NonUnitaryArray<LaunchHandlerClientMode>;
}

/**
 * Web App Manifest options.
 *
 * Requires at least one of `name` or `short_name`.
 * Field names use snake_case to match the manifest JSON format.
 *
 * @see https://www.w3.org/TR/appmanifest/
 */
interface ManifestOptionsBase {
  /** A human-readable description of the application. */
  description?: string;
  /**
   * URL that loads when the app is launched.
   * Must be within the manifest scope (if set).
   *
   * @example "/home"
   */
  start_url?: UrlOrPath;
  /**
   * Navigation scope of the app. Pages outside this scope are opened in a browser tab.
   * Must be a valid absolute URL. Use a trailing slash to indicate a directory
   * (e.g. `"https://example.com/app/"` matches all pages under `/app/`).
   *
   * @example "https://example.com/app/"
   */
  scope?: AbsoluteUrl;
  /**
   * Unique identifier for the application.
   * When specified as a URL or path, it is validated and normalized.
   *
   * @example "/"
   * @example "https://example.com/?app=myapp"
   */
  id?: string;
  /**
   * Preferred display mode for the application.
   * @default "browser"
   */
  display?: ManifestDisplay;
  /**
   * Ordered list of preferred display modes. The browser uses the first supported mode.
   * Should not contain only the same value as `display`.
   */
  display_override?: NonEmptyArray<ManifestDisplayOverride>;
  /** Default screen orientation for the application. */
  orientation?: ManifestOrientation;
  /**
   * Default theme color for the application (e.g. browser toolbar).
   * @example "#4285f4"
   */
  theme_color?: CssColor;
  /**
   * Expected background color of the application (shown during load).
   * @example "#ffffff"
   */
  background_color?: CssColor;
  /** Icons representing the application in various contexts. */
  icons?: NonEmptyArray<ManifestImageResource>;
  /** Screenshots for use in app stores and install prompts. */
  screenshots?: NonEmptyArray<ManifestScreenshot>;
  /** App shortcuts shown in the OS context menu (e.g. long-press on icon). */
  shortcuts?: NonEmptyArray<ManifestShortcut>;
  /**
   * Categories the application belongs to, used as hints for app stores.
   * @example ["productivity", "utilities"]
   */
  categories?: NonEmptyArray<string>;
  /**
   * Primary language of the manifest values (BCP 47 tag).
   *
   * Not validated at runtime because BCP 47 parsing is complex
   * and the browser is the authoritative validator.
   *
   * @example "en-US"
   */
  lang?: string;
  /**
   * Base text direction.
   * @default "auto"
   */
  dir?: "ltr" | "rtl" | "auto";
  /** Hint that related native applications are preferred over the web app. */
  prefer_related_applications?: boolean;
  /** Native applications related to this web app. */
  related_applications?: NonEmptyArray<ManifestRelatedApplication>;
  /** Custom URL protocol handlers the app can handle. */
  protocol_handlers?: NonEmptyArray<ManifestProtocolHandler>;
  /** File types the app can open. */
  file_handlers?: NonEmptyArray<ManifestFileHandler>;
  /** Enables the app to receive shared data from other apps. */
  share_target?: ManifestShareTarget;
  /** Controls how the app is launched (e.g. reuse existing window). */
  launch_handler?: ManifestLaunchHandler;
  /** Additional origins that are considered part of the app scope. */
  scope_extensions?: NonEmptyArray<{ origin: AbsoluteUrl }>;
}

/**
 * Web App Manifest configuration.
 *
 * At least one of `name` or `short_name` must be provided.
 * This constraint is enforced at the type level: either `name` is
 * required (with optional `short_name`), or vice versa.
 */
export type ManifestOptions = ManifestOptionsBase &
  (
    | { name: string; short_name?: string }
    | { name?: string; short_name: string }
  );
