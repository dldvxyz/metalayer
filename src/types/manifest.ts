import type {
  AbsoluteUrl,
  NonEmptyArray,
  NonUnitaryArray,
  PathString
} from "./_shared";

export type ManifestDisplay =
  | "fullscreen"
  | "standalone"
  | "minimal-ui"
  | "browser";

export type ManifestDisplayOverride =
  | ManifestDisplay
  | "window-controls-overlay"
  | (string & {});

export type ManifestOrientation =
  | "any"
  | "natural"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary";

export type ImagePurpose = "any" | "maskable" | "monochrome" | (string & {});

export type ImageMimeType =
  | "image/png"
  | "image/svg+xml"
  | "image/webp"
  | "image/x-icon"
  | (`image/${string}` & {});

export type ImageSize = `${number}x${number}`;

/** CSS color: hex, rgb(), hsl(), or named color */
export type CssColor =
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`
  | (string & {});

/** URL: absolute or path-relative */
export type UrlString = AbsoluteUrl | PathString;

export interface ManifestImageResource {
  src: UrlString;
  sizes?: "any" | ImageSize | NonUnitaryArray<ImageSize>;
  type?: ImageMimeType;
  purpose?: ImagePurpose;
}

export type ManifestScreenshot = ManifestImageResource & {
  label?: string;
  platform?: string;
  form_factor?: "narrow" | "wide";
};

export interface ManifestShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: UrlString;
  icons?: NonEmptyArray<ManifestImageResource>;
}

export type ManifestRelatedApplication =
  | { platform: string; url: AbsoluteUrl; id?: string }
  | { platform: string; url?: AbsoluteUrl; id: string };

export interface ManifestProtocolHandler {
  protocol: string;
  url: UrlString;
}

export interface ManifestFileHandler {
  action: UrlString;
  accept: Record<`${string}/${string}`, NonEmptyArray<`.${string}`>>;
}

interface ShareTargetParams {
  title?: string;
  text?: string;
  url?: string;
}

interface ShareTargetFile {
  name: string;
  accept: `.${string}` | NonUnitaryArray<`.${string}`>;
}

interface ManifestShareTargetGet {
  action: UrlString;
  method?: "GET";
  params: ShareTargetParams;
}

interface ManifestShareTargetPost {
  action: UrlString;
  method: "POST";
  enctype?: "application/x-www-form-urlencoded" | "multipart/form-data";
  params: ShareTargetParams & {
    files?: NonEmptyArray<ShareTargetFile>;
  };
}

export type ManifestShareTarget =
  | ManifestShareTargetGet
  | ManifestShareTargetPost;

type LaunchHandlerClientMode =
  | "auto"
  | "navigate-new"
  | "navigate-existing"
  | "focus-existing";

export interface ManifestLaunchHandler {
  client_mode?:
    | LaunchHandlerClientMode
    | NonUnitaryArray<LaunchHandlerClientMode>;
}

/**
 * Web App Manifest options.
 * Field names use snake_case to match the manifest JSON format.
 * @see https://www.w3.org/TR/appmanifest/
 */
interface WebManifestOptionsBase {
  description?: string;
  start_url?: UrlString;
  scope?: UrlString;
  id?: string;
  display?: ManifestDisplay;
  display_override?: NonEmptyArray<ManifestDisplayOverride>;
  orientation?: ManifestOrientation;
  theme_color?: CssColor;
  background_color?: CssColor;
  icons?: NonEmptyArray<ManifestImageResource>;
  screenshots?: NonEmptyArray<ManifestScreenshot>;
  shortcuts?: NonEmptyArray<ManifestShortcut>;
  categories?: NonEmptyArray<string>;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  prefer_related_applications?: boolean;
  related_applications?: NonEmptyArray<ManifestRelatedApplication>;
  protocol_handlers?: NonEmptyArray<ManifestProtocolHandler>;
  file_handlers?: NonEmptyArray<ManifestFileHandler>;
  share_target?: ManifestShareTarget;
  launch_handler?: ManifestLaunchHandler;
  scope_extensions?: NonEmptyArray<{ origin: AbsoluteUrl }>;
}

export type WebManifestOptions = WebManifestOptionsBase &
  (
    | { name: string; short_name?: string }
    | { name?: string; short_name: string }
  );
