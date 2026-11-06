import type {
  AbsoluteUrl,
  NonEmptyArray,
  NonUnitaryArray,
  UrlPath
} from "../shared/types.js";

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

/**
 * Display mode override: the standard modes plus the incubating
 * `"window-controls-overlay"`, `"tabbed"` and `"unframed"` modes
 * (`"unframed"` was previously called `"borderless"`). Browsers silently
 * skip values they do not recognise, so {@link validateManifest} rejects
 * anything outside this list.
 */
export type ManifestDisplayOverride =
  | ManifestDisplay
  | "window-controls-overlay"
  | "tabbed"
  | "unframed";

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

/** A single purpose token for a manifest image resource. */
export type ImagePurposeToken = "any" | "maskable" | "monochrome";

/** Two different purpose tokens, space-separated. */
type ImagePurposePair = {
  [First in ImagePurposeToken]: `${First} ${Exclude<ImagePurposeToken, First>}`;
}[ImagePurposeToken];

/** Three different purpose tokens, space-separated. */
type ImagePurposeTriple = {
  [First in ImagePurposeToken]: {
    [
      Second in Exclude<ImagePurposeToken, First>
    ]: `${First} ${Second} ${Exclude<ImagePurposeToken, First | Second>}`;
  }[Exclude<ImagePurposeToken, First>];
}[ImagePurposeToken];

/**
 * Purpose of a manifest image resource: one or more different tokens,
 * space-separated (e.g. `"any maskable"`).
 *
 * Browsers ignore unknown tokens and drop an icon whose tokens are all
 * unknown, so {@link validateManifest} rejects unknown and repeated tokens.
 */
export type ImagePurpose =
  | ImagePurposeToken
  | ImagePurposePair
  | ImagePurposeTriple;

/** MIME type of a manifest image resource. Common types are provided as autocomplete suggestions. */
export type ImageMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/avif"
  | "image/gif"
  | "image/svg+xml"
  | "image/x-icon"
  | "image/vnd.microsoft.icon"
  | (`image/${string}` & Record<never, never>);

/**
 * Image dimensions in "widthxheight" format (e.g. `"192x192"`).
 *
 * Both dimensions must be positive integers without leading zeros
 * (checked by {@link validateManifest}, which also enforces that icon
 * sizes are square).
 */
export type ImageSize = `${number}${"x" | "X"}${number}`;

/**
 * CSS color value.
 *
 * Browsers accept any CSS color that can be converted to sRGB without
 * context: hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), the
 * `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`,
 * `oklch()` and `color()` functions, and the CSS named colors
 * (e.g. `"rebeccapurple"`). Context-dependent values such as
 * `currentcolor` are not allowed. The template-literal members exist for
 * autocompletion; any string is accepted at the type level and checked
 * by {@link validateManifest}.
 *
 * @example "#4285f4"
 * @example "rgb(66 133 244)"
 * @example "oklch(62% 0.19 258)"
 */
export type CssColor =
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`
  | `hwb(${string})`
  | `lab(${string})`
  | `lch(${string})`
  | `oklab(${string})`
  | `oklch(${string})`
  | `color(${string})`
  | (string & Record<never, never>);

/**
 * Absolute http(s) URL or URL path starting with "/".
 *
 * Used for manifest fields that accept either form
 * (e.g. `start_url`, icon `src`). Protocol-relative URLs
 * (`//cdn.example.com/icon.png`) are not supported; use an absolute URL.
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
  /**
   * Image dimensions. Format depends on the resource type. Give multiple
   * sizes as an array; it is serialized as the manifest's space-separated
   * string (e.g. `["16x16", "32x32"]` becomes `"16x16 32x32"`).
   */
  sizes?: "any" | ImageSize | NonUnitaryArray<ImageSize> | undefined;
  /** MIME type of the image (e.g. `"image/png"`). */
  type?: ImageMimeType | undefined;
}

/** An image resource in the manifest (used for icons). */
export interface ManifestImageResource extends ManifestImageResourceBase {
  /**
   * One or more image dimensions.
   *
   * Use `"any"` for scalable formats (SVG). ICO files may specify multiple
   * sizes, which are serialized as a space-separated string. All other
   * formats must specify a single, square size.
   *
   * @example "192x192"
   * @example ["16x16", "32x32"] // ICO only
   */
  sizes?: "any" | ImageSize | NonUnitaryArray<ImageSize> | undefined;
  /**
   * Intended purpose of the image.
   * @default "any"
   */
  purpose?: ImagePurpose | undefined;
}

/** Platforms and stores defined by the Web App Manifest "Application Information" spec. */
export type ScreenshotPlatform =
  | "android"
  | "chromeos"
  | "ipados"
  | "ios"
  | "kaios"
  | "macos"
  | "windows"
  | "xbox"
  | "chrome_web_store"
  | "itunes"
  | "microsoft-inbox"
  | "microsoft-store"
  | "play"
  | (string & Record<never, never>);

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
  sizes?: "any" | ImageSize | undefined;
  /** Accessible description of the screenshot. */
  label?: string | undefined;
  /** Platform or store the screenshot applies to (e.g. `"ios"`, `"android"`, `"windows"`). */
  platform?: ScreenshotPlatform | undefined;
  /** Form factor: `"narrow"` for mobile, `"wide"` for desktop/tablet. */
  form_factor?: "narrow" | "wide" | undefined;
}

/** A shortcut entry for the manifest app. */
export interface ManifestShortcut {
  /** Human-readable label for the shortcut. */
  name: string;
  /** Short version of the name, used where space is limited. */
  short_name?: string | undefined;
  /** Description of what the shortcut does. */
  description?: string | undefined;
  /** URL that opens when the shortcut is activated. Must be within the manifest scope. */
  url: UrlOrPath;
  /** Icons representing this shortcut. */
  icons?: NonEmptyArray<ManifestImageResource> | undefined;
}

/** A cryptographic fingerprint identifying a related native application. */
export interface ManifestFingerprint {
  /** Fingerprint type, as defined by the platform (e.g. `"sha256_cert"`). */
  type: string;
  /** Fingerprint value. */
  value: string;
}

// Base fields shared by both ManifestRelatedApplication variants.
interface ManifestRelatedApplicationBase {
  /** Application platform (e.g. `"play"`, `"itunes"`, `"windows"`). */
  platform: string;
  /** Minimum version of the application considered related. */
  min_version?: string | undefined;
  /** Fingerprints used to verify the application. */
  fingerprints?: NonEmptyArray<ManifestFingerprint> | undefined;
}

/**
 * A related native application listing. Requires at least one of `url` or `id`.
 *
 * @example { platform: "play", url: "https://play.google.com/store/apps/details?id=com.example" }
 * @example { platform: "itunes", id: "123456789" }
 */
export type ManifestRelatedApplication = ManifestRelatedApplicationBase &
  (
    | {
        /** URL to the application's store listing. */
        url: AbsoluteUrl;
        /** Platform-specific application identifier (e.g. a package name or store ID). */
        id?: string | undefined;
      }
    | {
        /** URL to the application's store listing. */
        url?: AbsoluteUrl | undefined;
        /** Platform-specific application identifier (e.g. a package name or store ID). */
        id: string;
      }
  );

/** A custom protocol handler registration. */
export interface ManifestProtocolHandler {
  /**
   * Protocol scheme to handle. Must be a safelisted scheme (e.g. `"mailto"`, `"tel"`)
   * or start with `"web+"` followed by lowercase letters (e.g. `"web+myapp"`).
   */
  protocol: string;
  /**
   * URL template that handles the protocol. Must contain a `"%s"` placeholder
   * that will be replaced with the protocol URL, and must be within the manifest scope.
   *
   * @example "/handle?url=%s"
   */
  url: UrlOrPath;
}

/** A file type handler registration. */
export interface ManifestFileHandler {
  /**
   * URL that handles the file open action. Must be within the manifest scope.
   * @example "/open-file"
   */
  action: UrlOrPath;
  /** Human-readable name of the file type, shown in file dialogs. */
  name?: string | undefined;
  /**
   * Map of MIME types to accepted file extension(s).
   *
   * @example { "image/png": ".png", "image/jpeg": [".jpg", ".jpeg"] }
   */
  accept: Record<
    `${string}/${string}`,
    `.${string}` | NonEmptyArray<`.${string}`>
  >;
  /** Icons representing the file type. */
  icons?: NonEmptyArray<ManifestImageResource> | undefined;
  /**
   * Whether multiple files open in one client (`"single-client"`) or one
   * client per file (`"multiple-clients"`).
   * @default "single-client"
   */
  launch_type?: "single-client" | "multiple-clients" | undefined;
}

/** Parameters that can be shared to the target app. */
export interface ShareTargetParams {
  /** Name of the query parameter for the shared title. */
  title?: string | undefined;
  /** Name of the query parameter for the shared text. */
  text?: string | undefined;
  /** Name of the query parameter for the shared URL. */
  url?: string | undefined;
}

/** A MIME type (`"image/png"`, `"image/*"`) or file extension (`".png"`) accepted by a share target. */
export type ShareTargetAccept = `.${string}` | `${string}/${string}`;

/** A file type accepted by a share target. */
export interface ShareTargetFile {
  /** Name of the form field for the file data. */
  name: string;
  /** Accepted MIME type(s) or file extension(s) (e.g. `"image/*"`, `".png"` or `[".jpg", ".jpeg"]`). */
  accept: ShareTargetAccept | NonEmptyArray<ShareTargetAccept>;
}

/** Share target using HTTP GET. Params are appended as query string parameters. */
export interface ManifestShareTargetGet {
  /** URL that handles the share action. Must be within the manifest scope. */
  action: UrlOrPath;
  /** HTTP method. Omit or set to `"GET"` for query-string-based sharing. */
  method?: "GET" | undefined;
  /** Parameters to include in the share URL's query string. Files need a multipart POST. */
  params: ShareTargetParams & { files?: undefined };
}

/** Share target using HTTP POST with a URL-encoded body (no files). */
export interface ManifestShareTargetPostUrlEncoded {
  /** URL that handles the share action. Must be within the manifest scope. */
  action: UrlOrPath;
  /** HTTP method. Must be `"POST"` for form-based sharing. */
  method: "POST";
  /**
   * Encoding type for the POST body.
   * @default "application/x-www-form-urlencoded"
   */
  enctype?: "application/x-www-form-urlencoded" | undefined;
  /** Parameters to include in the POST body. Files need `enctype: "multipart/form-data"`. */
  params: ShareTargetParams & { files?: undefined };
}

/** Share target using HTTP POST with a multipart body, which is required to receive files. */
export interface ManifestShareTargetPostMultipart {
  /** URL that handles the share action. Must be within the manifest scope. */
  action: UrlOrPath;
  /** HTTP method. Must be `"POST"` for form-based sharing. */
  method: "POST";
  /** Encoding type for the POST body. Required when sharing files. */
  enctype: "multipart/form-data";
  /** Parameters to include in the POST body, optionally including files. */
  params: ShareTargetParams & {
    /** Files the share target accepts. */
    files?: NonEmptyArray<ShareTargetFile> | undefined;
  };
}

/** Share target using HTTP POST. Files can only be received with `enctype: "multipart/form-data"`. */
export type ManifestShareTargetPost =
  | ManifestShareTargetPostUrlEncoded
  | ManifestShareTargetPostMultipart;

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

/** How an app launch is routed to a client when the app is already running. */
export type LaunchHandlerClientMode =
  | "auto"
  | "navigate-new"
  | "navigate-existing"
  | "focus-existing";

/**
 * Launch handler configuration for controlling how the app responds
 * when launched while already running.
 *
 * `client_mode` determines whether a new window is opened or an
 * existing one is reused. An array lists modes in order of preference.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Manifest/launch_handler
 */
export interface ManifestLaunchHandler {
  client_mode?:
    | LaunchHandlerClientMode
    | NonUnitaryArray<LaunchHandlerClientMode>
    | undefined;
}

/**
 * An additional origin that is considered part of the app scope.
 *
 * Serialized with `type: "origin"` (required by browsers) and the origin
 * reduced to scheme and host.
 */
export interface ManifestScopeExtension {
  /** Kind of extension. Only `"origin"` is currently defined and it is emitted automatically. */
  type?: "origin" | undefined;
  /** Bare https origin (scheme and host, no path) to extend the scope to. */
  origin: `https://${string}`;
}

/** Note-taking integration: lets the app be launched to create a new note. */
export interface ManifestNoteTaking {
  /** URL opened to create a new note. Must be within the manifest scope. */
  new_note_url: UrlOrPath;
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
  description?: string | undefined;
  /**
   * URL that loads when the app is launched.
   * Must be within the manifest scope (if set).
   *
   * @example "/home"
   */
  start_url?: UrlOrPath | undefined;
  /**
   * Navigation scope of the app. Pages outside this scope are opened in a browser tab.
   *
   * An absolute URL or a path, without query or fragment. Browsers treat the
   * scope path as a string prefix, so `"/app"` would also cover
   * `/application`; end the scope with a slash (`"/app/"`) to limit it to
   * that directory. {@link validateManifest} flags URLs that match only
   * because of a missing trailing slash.
   *
   * @example "/"
   * @example "https://example.com/app/"
   */
  scope?: UrlOrPath | undefined;
  /**
   * Unique identifier for the application, resolved against the
   * `start_url` origin. Must be same-origin with `start_url`; it does not
   * have to be within `scope`. Normalized when given as a URL or path.
   *
   * @example "/"
   * @example "https://example.com/?app=myapp"
   */
  id?: string | undefined;
  /**
   * Preferred display mode for the application.
   * @default "browser"
   */
  display?: ManifestDisplay | undefined;
  /**
   * Ordered list of preferred display modes. The browser uses the first supported mode.
   * Should not contain only the same value as `display`.
   */
  display_override?: NonEmptyArray<ManifestDisplayOverride> | undefined;
  /** Default screen orientation for the application. */
  orientation?: ManifestOrientation | undefined;
  /**
   * Default theme color for the application (e.g. browser toolbar).
   * @example "#4285f4"
   */
  theme_color?: CssColor | undefined;
  /**
   * Expected background color of the application (shown during load).
   * @example "#ffffff"
   */
  background_color?: CssColor | undefined;
  /** Icons representing the application in various contexts. */
  icons?: NonEmptyArray<ManifestImageResource> | undefined;
  /** Screenshots for use in app stores and install prompts. */
  screenshots?: NonEmptyArray<ManifestScreenshot> | undefined;
  /** App shortcuts shown in the OS context menu (e.g. long-press on icon). */
  shortcuts?: NonEmptyArray<ManifestShortcut> | undefined;
  /**
   * Categories the application belongs to, used as hints for app stores.
   * @example ["productivity", "utilities"]
   */
  categories?: NonEmptyArray<string> | undefined;
  /**
   * International Age Rating Coalition certificate ID.
   * @example "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7"
   */
  iarc_rating_id?: string | undefined;
  /**
   * Primary language of the manifest values (BCP 47 tag).
   *
   * Not validated at runtime because BCP 47 parsing is complex
   * and the browser is the authoritative validator.
   *
   * @example "en-US"
   */
  lang?: string | undefined;
  /**
   * Base text direction.
   * @default "auto"
   */
  dir?: "ltr" | "rtl" | "auto" | undefined;
  /** Hint that related native applications are preferred over the web app. */
  prefer_related_applications?: boolean | undefined;
  /** Native applications related to this web app. */
  related_applications?: NonEmptyArray<ManifestRelatedApplication> | undefined;
  /** Custom URL protocol handlers the app can handle. */
  protocol_handlers?: NonEmptyArray<ManifestProtocolHandler> | undefined;
  /** File types the app can open. */
  file_handlers?: NonEmptyArray<ManifestFileHandler> | undefined;
  /** Enables the app to receive shared data from other apps. */
  share_target?: ManifestShareTarget | undefined;
  /** Controls how the app is launched (e.g. reuse existing window). */
  launch_handler?: ManifestLaunchHandler | undefined;
  /** Additional origins that are considered part of the app scope. */
  scope_extensions?: NonEmptyArray<ManifestScopeExtension> | undefined;
  /** Note-taking integration. */
  note_taking?: ManifestNoteTaking | undefined;
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
    | { name: string; short_name?: string | undefined }
    | { name?: string | undefined; short_name: string }
  );
