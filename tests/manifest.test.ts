import { describe, expect, it } from "vitest";

import type { CssColor, ManifestOptions } from "../src/index.js";
import { generateManifest, validateManifest } from "../src/index.js";
import { expectIssues, expectValid, parseJson, untyped } from "./helpers.js";

/** Generates a manifest and parses it back for structural assertions. */
function generate(options: ManifestOptions): unknown {
  return parseJson(generateManifest(options));
}

describe(generateManifest, () => {
  it("outputs pretty-printed JSON with a trailing newline", () => {
    expect(generateManifest({ name: "Test", short_name: "T" })).toBe(
      '{\n  "name": "Test",\n  "short_name": "T"\n}\n'
    );
  });

  it("passes through fields that need no normalization", () => {
    const options = {
      name: "My PWA",
      short_name: "PWA",
      description: "A progressive web app",
      id: "com.example.pwa",
      display: "standalone",
      display_override: ["window-controls-overlay", "tabbed", "standalone"],
      orientation: "portrait",
      theme_color: "#4285f4",
      background_color: "#ffffff",
      categories: ["productivity", "utilities"],
      iarc_rating_id: "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7",
      lang: "en",
      dir: "ltr",
      prefer_related_applications: false,
      launch_handler: { client_mode: ["navigate-existing", "auto"] }
    } as const satisfies ManifestOptions;
    expect(generate(options)).toStrictEqual(options);
  });

  it("handles empty options", () => {
    expect(generate(untyped({}))).toStrictEqual({});
  });

  it("serializes image sizes as space-separated strings", () => {
    expect(
      generate({
        name: "App",
        icons: [
          {
            src: "/favicon.ico",
            sizes: ["16x16", "32x32", "48x48"],
            type: "image/x-icon"
          },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
          { src: "/icon.png" }
        ],
        shortcuts: [
          {
            name: "Home",
            url: "/",
            icons: [{ src: "/s.ico", sizes: ["16x16", "32x32"] }]
          }
        ]
      })
    ).toStrictEqual({
      name: "App",
      icons: [
        {
          src: "/favicon.ico",
          sizes: "16x16 32x32 48x48",
          type: "image/x-icon"
        },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/icon.png" }
      ],
      shortcuts: [
        {
          name: "Home",
          url: "/",
          icons: [{ src: "/s.ico", sizes: "16x16 32x32" }]
        }
      ]
    });
  });

  it("normalizes scope, start_url, id, shortcut and icon URLs", () => {
    expect(
      generate({
        name: "App",
        scope: "https://Example.COM/app",
        start_url: "https://Example.COM:443/app/home",
        id: "/app/./main",
        shortcuts: [
          { name: "Home", url: "https://Example.COM/app/" },
          { name: "Settings", url: "/app/settings" }
        ],
        icons: [{ src: "https://CDN.example.com/icon.png", sizes: "192x192" }]
      })
    ).toStrictEqual({
      name: "App",
      scope: "https://example.com/app",
      start_url: "https://example.com/app/home",
      id: "/app/main",
      shortcuts: [
        { name: "Home", url: "https://example.com/app/" },
        { name: "Settings", url: "/app/settings" }
      ],
      icons: [{ src: "https://cdn.example.com/icon.png", sizes: "192x192" }]
    });
  });

  it("lowercases protocol schemes and preserves the %s placeholder", () => {
    expect(
      generate({
        name: "App",
        protocol_handlers: [
          { protocol: "WEB+Custom", url: "https://Example.com/handle?val=%s" }
        ]
      })
    ).toStrictEqual({
      name: "App",
      protocol_handlers: [
        { protocol: "web+custom", url: "https://example.com/handle?val=%s" }
      ]
    });
  });

  it('writes scope extensions with type "origin" and a bare origin', () => {
    expect(
      generate({
        name: "App",
        scope_extensions: [
          { origin: "https://Other.com" },
          { type: "origin", origin: "https://other.example:8443/" }
        ]
      })
    ).toStrictEqual({
      name: "App",
      scope_extensions: [
        { type: "origin", origin: "https://other.com" },
        { type: "origin", origin: "https://other.example:8443" }
      ]
    });
  });

  it("normalizes file handler, share target, note-taking and related application URLs", () => {
    expect(
      generate({
        name: "App",
        file_handlers: [
          {
            name: "Text",
            action: "/open/./file",
            accept: { "text/plain": [".txt"], "text/markdown": ".md" },
            icons: [{ src: "/txt.png", sizes: "64x64" }],
            launch_type: "multiple-clients"
          }
        ],
        share_target: {
          action: "/share/../s",
          method: "POST",
          params: { title: "t" }
        },
        note_taking: { new_note_url: "/notes/./new" },
        related_applications: [
          {
            platform: "play",
            url: "https://PLAY.google.com/store/apps/details?id=com.example",
            min_version: "2",
            fingerprints: [{ type: "sha256_cert", value: "AB:CD" }]
          },
          { platform: "itunes", id: "123" }
        ]
      })
    ).toStrictEqual({
      name: "App",
      file_handlers: [
        {
          name: "Text",
          action: "/open/file",
          accept: { "text/plain": [".txt"], "text/markdown": ".md" },
          icons: [{ src: "/txt.png", sizes: "64x64" }],
          launch_type: "multiple-clients"
        }
      ],
      share_target: { action: "/s", method: "POST", params: { title: "t" } },
      note_taking: { new_note_url: "/notes/new" },
      related_applications: [
        {
          platform: "play",
          url: "https://play.google.com/store/apps/details?id=com.example",
          min_version: "2",
          fingerprints: [{ type: "sha256_cert", value: "AB:CD" }]
        },
        { platform: "itunes", id: "123" }
      ]
    });
  });

  it("does not mutate its input", () => {
    const options = {
      name: "App",
      icons: [{ src: "/favicon.ico", sizes: ["16x16", "32x32"] }],
      shortcuts: [{ name: "Home", url: "/./home" }],
      scope_extensions: [{ origin: "https://other.com" }]
    } as const satisfies ManifestOptions;
    const snapshot = structuredClone(options);
    generateManifest(options);
    expect(options).toStrictEqual(snapshot);
  });
});

describe(validateManifest, () => {
  it("returns the options when valid", () => {
    const options = { name: "App" };
    expect(validateManifest(options)).toStrictEqual({ valid: true, options });
  });

  it.each<{ name: string; options: ManifestOptions }>([
    {
      name: "the README example",
      options: {
        name: "My App",
        short_name: "App",
        start_url: "/",
        display: "standalone",
        theme_color: "#4285f4",
        background_color: "#ffffff",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }
        ]
      }
    },
    {
      name: "a fully populated manifest",
      options: {
        name: "My PWA",
        short_name: "PWA",
        description: "A progressive web app",
        start_url: "/app/?source=pwa",
        scope: "/app/",
        id: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        theme_color: "oklch(62% 0.19 258)",
        background_color: "rgb(0 0 0)",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-192.png", sizes: "192x192", purpose: "maskable" },
          { src: "/mono.svg", sizes: "any", purpose: "monochrome" }
        ],
        screenshots: [
          { src: "/narrow.png", sizes: "750x1334", form_factor: "narrow" },
          { src: "/wide.png", sizes: "1920x1080", form_factor: "wide" }
        ],
        shortcuts: [{ name: "Inbox", url: "/app/inbox" }],
        protocol_handlers: [{ protocol: "web+pwa", url: "/app/open?u=%s" }],
        file_handlers: [
          { action: "/app/open", accept: { "text/plain": [".txt"] } }
        ],
        share_target: {
          action: "/app/share",
          method: "POST",
          enctype: "multipart/form-data",
          params: { files: [{ name: "media", accept: ["image/*", ".png"] }] }
        },
        note_taking: { new_note_url: "/app/notes/new" },
        categories: ["productivity"],
        prefer_related_applications: true,
        related_applications: [{ platform: "play", id: "com.example.pwa" }],
        scope_extensions: [{ origin: "https://example.net" }]
      }
    }
  ])("accepts $name", ({ options }) => {
    expectValid(validateManifest(options));
  });

  describe("names", () => {
    it("rejects a manifest without a usable name", () => {
      expectIssues(validateManifest({ name: "  " }), [
        'At least one of "name" or "short_name" must be a non-empty string'
      ]);
    });

    it("rejects a blank short_name next to a valid name", () => {
      expectIssues(validateManifest({ name: "App", short_name: " " }), [
        "short_name must not be blank"
      ]);
    });
  });

  describe("icons", () => {
    it.each([
      [{ src: "/icon.svg", type: "image/svg+xml", sizes: "192x192" }],
      [{ src: "/icon.svg", sizes: "192x192" }],
      [{ src: "/icon.SVG?v=2", sizes: "192x192" }],
      [{ src: "/icon.svg", sizes: ["16x16", "32x32"] }]
    ] as const)("requires sizes 'any' for the SVG icon %j", (icon) => {
      expectIssues(validateManifest({ name: "App", icons: [icon] }), [
        'icons[0]: SVG images must have sizes set to "any"'
      ]);
    });

    it("detects SVG icons by type, extension or MIME parameters", () => {
      expectValid(
        validateManifest({
          name: "App",
          icons: [
            { src: "/icon.svg", sizes: "any" },
            {
              src: "/mono",
              type: "image/svg+xml; charset=utf-8",
              sizes: "any",
              purpose: "monochrome"
            }
          ]
        })
      );
    });

    it("rejects sizes 'any' on non-SVG icons", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [{ src: "/icon.png", sizes: "any" }]
        }),
        ['icons[0]: Only SVG images can have sizes set to "any"']
      );
    });

    it("rejects non-square and malformed icon sizes", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [
            { src: "/a.png", sizes: "192x256" },
            { src: "/b.png", sizes: "1.5x2" },
            { src: "/c.png", sizes: untyped("0x0") }
          ]
        }),
        [
          'icons[0]: Icon size "192x256" must be square',
          'icons[1]: size "1.5x2" must be "<width>x<height>"',
          'icons[2]: size "0x0" must be "<width>x<height>"'
        ]
      );
    });

    it("accepts multiple sizes for ICO files, detected by type or extension", () => {
      expectValid(
        validateManifest({
          name: "App",
          icons: [
            {
              src: "/favicon.ico",
              sizes: ["16x16", "32x32"],
              type: "image/x-icon"
            },
            {
              src: "/legacy",
              sizes: ["48x48", "64x64"],
              type: "image/vnd.microsoft.icon"
            },
            { src: "/FAVICON.ICO?v=1", sizes: ["96x96", "128x128"] }
          ]
        })
      );
    });

    it("rejects multiple sizes for other formats", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [{ src: "/icon.png", sizes: ["16x16", "32x32"] }]
        }),
        ["icons[0]: Only ICO files can have multiple sizes"]
      );
    });

    it.each(["/icon//bad.png", "//cdn.example.com/icon.png", "icon.png"])(
      "rejects the src %j",
      (src) => {
        expectIssues(
          validateManifest(untyped({ name: "App", icons: [{ src }] })),
          [`icons[0]: src "${src}" is not a valid URL or path`]
        );
      }
    );

    it("detects duplicate srcs after normalization", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [
            { src: "/icon.png", sizes: "192x192" },
            { src: "/./icon.png", sizes: "512x512" }
          ]
        }),
        ['Duplicate src "/./icon.png" in icons']
      );
    });

    it("allows the same src and size for different purposes", () => {
      expectValid(
        validateManifest({
          name: "App",
          icons: [
            { src: "/icon.png", sizes: "192x192", purpose: "any" },
            { src: "/icon.png", sizes: "192x192", purpose: "maskable" }
          ]
        })
      );
    });

    it("compares duplicates per purpose token", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [
            { src: "/icon.png", sizes: "192x192", purpose: "any maskable" },
            { src: "/icon.png", sizes: "192x192", purpose: "maskable" }
          ]
        }),
        [
          'Duplicate src "/icon.png" in icons',
          'Duplicate size "192x192" in icons'
        ]
      );
    });

    it("detects duplicate sizes for the same purpose", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [
            { src: "/a.png", sizes: "192x192" },
            { src: "/b.png", sizes: "192x192", purpose: "any" }
          ]
        }),
        ['Duplicate size "192x192" in icons']
      );
    });

    it("rejects unknown and repeated purpose tokens", () => {
      expectIssues(
        validateManifest({
          name: "App",
          icons: [
            { src: "/a.png", purpose: untyped("badge") },
            { src: "/b.png", purpose: "maskable maskable" }
          ]
        }),
        [
          'icons[0]: unknown purpose "badge"',
          'icons[1]: purpose token "maskable" is repeated'
        ]
      );
    });

    it("applies the icon rules to shortcut and file handler icons", () => {
      expectIssues(
        validateManifest({
          name: "App",
          shortcuts: [
            {
              name: "Home",
              url: "/",
              icons: [{ src: "/s.png", sizes: "64x128" }]
            }
          ],
          file_handlers: [
            {
              action: "/open",
              accept: { "text/plain": [".txt"] },
              icons: [{ src: "/f.png", sizes: "any" }]
            }
          ]
        }),
        [
          'shortcuts[0].icons[0]: Icon size "64x128" must be square',
          'file_handlers[0].icons[0]: Only SVG images can have sizes set to "any"'
        ]
      );
    });
  });

  describe("screenshots", () => {
    it("rejects duplicate srcs and malformed sizes but allows any aspect ratio", () => {
      expectIssues(
        validateManifest({
          name: "App",
          screenshots: [
            { src: "/shot.png", sizes: "1920x1080" },
            { src: "/shot.png", sizes: "1x1.5" }
          ]
        }),
        [
          'Duplicate src "/shot.png" in screenshots',
          'screenshots[1]: size "1x1.5" must be "<width>x<height>"'
        ]
      );
    });
  });

  describe("scope", () => {
    it.each(["app", "not-a-url", "ftp://example.com/"])(
      "rejects the scope %j",
      (scope) => {
        expectIssues(validateManifest(untyped({ name: "App", scope })), [
          `Invalid scope "${scope}"`
        ]);
      }
    );

    it("rejects a scope with a query or fragment", () => {
      expectIssues(
        validateManifest({ name: "App", scope: "https://example.com/app?x=1" }),
        [
          'Scope "https://example.com/app?x=1" must not contain a query or fragment'
        ]
      );
    });

    it("skips scope checks when the scope is invalid", () => {
      expectIssues(
        validateManifest(
          untyped({ name: "App", scope: "not-a-url", start_url: "/other" })
        ),
        ['Invalid scope "not-a-url"']
      );
    });

    it("accepts URLs within the scope, ignoring query strings", () => {
      expectValid(
        validateManifest({
          name: "App",
          scope: "https://example.com/app",
          start_url: "/app?source=pwa",
          id: "/app/main",
          shortcuts: [
            { name: "Settings", url: "/app/settings" },
            { name: "Absolute", url: "https://example.com/app/" }
          ],
          protocol_handlers: [{ protocol: "web+app", url: "/app/handle?u=%s" }],
          file_handlers: [
            { action: "/app/open", accept: { "text/plain": [".txt"] } }
          ],
          share_target: { action: "/app/share", params: { title: "t" } },
          note_taking: { new_note_url: "/app/new" }
        })
      );
    });

    it("rejects URLs outside the scope", () => {
      expectIssues(
        validateManifest({
          name: "App",
          scope: "https://example.com/app/",
          start_url: "/other",
          shortcuts: [{ name: "Settings", url: "/settings" }],
          protocol_handlers: [{ protocol: "web+app", url: "/handle?u=%s" }],
          file_handlers: [
            { action: "/open", accept: { "text/plain": [".txt"] } }
          ],
          share_target: {
            action: "https://other.com/app/share",
            params: { title: "t" }
          },
          note_taking: { new_note_url: "/new" }
        }),
        [
          'start_url "/other" is outside the manifest scope',
          'shortcuts[0]: url "/settings" is outside the manifest scope',
          'protocol_handlers[0]: URL "/handle?u=%s" is outside the manifest scope',
          'file_handlers[0]: action "/open" is outside the manifest scope',
          'share_target.action "https://other.com/app/share" is outside the manifest scope',
          'note_taking.new_note_url "/new" is outside the manifest scope'
        ]
      );
    });

    it("flags URLs that are in scope only because the scope lacks a trailing slash", () => {
      expectIssues(
        validateManifest({
          name: "App",
          scope: "https://example.com/app",
          start_url: "/application"
        }),
        [
          'start_url "/application" is within the manifest scope "https://example.com/app" only because the scope has no trailing slash'
        ]
      );
    });

    it("compares only paths when the scope is relative", () => {
      expectIssues(
        validateManifest({
          name: "App",
          scope: "/app/",
          start_url: "https://example.com/app/home",
          shortcuts: [{ name: "Other", url: "https://example.com/other" }]
        }),
        [
          'shortcuts[0]: url "https://example.com/other" is outside the manifest scope'
        ]
      );
    });
  });

  describe("id", () => {
    it.each<{ name: string; options: ManifestOptions }>([
      { name: "a freeform id", options: { name: "App", id: "my-app" } },
      {
        name: 'id "/" with a narrower scope',
        options: {
          name: "App",
          id: "/",
          scope: "https://example.com/app/",
          start_url: "/app/"
        }
      },
      {
        name: "a same-origin absolute id",
        options: {
          name: "App",
          id: "https://example.com/?app=1",
          start_url: "https://example.com/app/"
        }
      }
    ])("accepts $name", ({ options }) => {
      expectValid(validateManifest(options));
    });

    it.each<{ name: string; options: ManifestOptions; issue: string }>([
      {
        name: "an id on another origin than start_url",
        options: {
          name: "App",
          id: "https://other.com/app",
          start_url: "https://example.com/"
        },
        issue:
          'id "https://other.com/app" must be same-origin with start_url (https://example.com)'
      },
      {
        name: "an id on another origin than an absolute scope",
        options: {
          name: "App",
          id: "https://other.com/",
          scope: "https://example.com/"
        },
        issue: 'id "https://other.com/" must be same-origin'
      },
      {
        name: "a blank id",
        options: { name: "App", id: "  " },
        issue: "id must not be blank"
      },
      {
        name: "an invalid URL-like id",
        options: { name: "App", id: "/a//b" },
        issue: 'id "/a//b" is not a valid URL or path'
      }
    ])("rejects $name", ({ options, issue }) => {
      expectIssues(validateManifest(options), [issue]);
    });
  });

  describe("shortcuts", () => {
    it("detects duplicate names, ignoring surrounding whitespace", () => {
      expectIssues(
        validateManifest({
          name: "App",
          shortcuts: [
            { name: "Home", url: "/" },
            { name: "Home ", url: "/home" }
          ]
        }),
        ['Duplicate shortcut name "Home "']
      );
    });

    it("rejects a blank name", () => {
      expectIssues(
        validateManifest({ name: "App", shortcuts: [{ name: " ", url: "/" }] }),
        ["shortcuts[0]: name must be a non-empty string"]
      );
    });
  });

  describe("colors", () => {
    it.each<CssColor>([
      "#fff",
      "#f00a",
      "#FFAA00",
      "#ff0000aa",
      "rgb(255, 0, 0)",
      "RGB(255 0 0)",
      "rgb(255 0 0 / 50%)",
      "rgba(255, 0, 0, 0.5)",
      "hsl(120, 100%, 50%)",
      "hsl(120deg 100% 50%)",
      "hsla(120, 100%, 50%, 0.8)",
      "hwb(194 0% 0%)",
      "lab(52% 40 59)",
      "lch(52% 72 56)",
      "oklab(0.6 0.1 0.1)",
      "oklch(62% 0.19 258)",
      "color(display-p3 1 0 0)",
      "color(srgb 1 0 0 / 0.5)",
      "red",
      "transparent",
      "RebeccaPurple"
    ])("accepts %s", (color) => {
      expectValid(
        validateManifest({
          name: "App",
          theme_color: color,
          background_color: color
        })
      );
    });

    it.each([
      "not-a-color",
      "notacolor",
      "currentColor",
      "inherit",
      "#ggg",
      "#12345",
      "rgb(garbage)",
      "rgb(1, 2)",
      "color(1 0 0)",
      ""
    ])("rejects %j", (color) => {
      expectIssues(validateManifest({ name: "App", theme_color: color }), [
        `Invalid theme_color "${color}"`
      ]);
    });

    it("reports background_color separately", () => {
      expectIssues(
        validateManifest({ name: "App", background_color: "nope" }),
        ['Invalid background_color "nope"']
      );
    });
  });

  describe("protocol handlers", () => {
    it("accepts web+ and safelisted schemes in any case", () => {
      expectValid(
        validateManifest({
          name: "App",
          protocol_handlers: [
            { protocol: "web+custom", url: "/handle?val=%s" },
            { protocol: "mailto", url: "/compose?to=%s" },
            { protocol: "web+MyApp", url: "/app?u=%s" },
            { protocol: "TEL", url: "/call?n=%s" }
          ]
        })
      );
    });

    it("rejects invalid schemes and URL templates", () => {
      expectIssues(
        validateManifest({
          name: "App",
          protocol_handlers: [
            { protocol: "custom", url: "/handle?val=%s" },
            { protocol: "web+", url: "/handle?val=%s" },
            { protocol: "web+foo", url: "/handle" },
            { protocol: "web+bar", url: "https://%s.example.com/" }
          ]
        }),
        [
          'protocol_handlers[0]: invalid protocol "custom"',
          'protocol_handlers[1]: invalid protocol "web+"',
          'protocol_handlers[2]: URL "/handle" must contain a "%s" placeholder',
          'protocol_handlers[3]: URL "https://%s.example.com/" has "%s" in its host'
        ]
      );
    });

    it("rejects a scheme registered twice, case-insensitively", () => {
      expectIssues(
        validateManifest({
          name: "App",
          protocol_handlers: [
            { protocol: "web+app", url: "/a?u=%s" },
            { protocol: "WEB+APP", url: "/b?u=%s" }
          ]
        }),
        ['Duplicate protocol "WEB+APP" in protocol_handlers']
      );
    });
  });

  describe("file handlers and share target", () => {
    it("rejects file handlers with the same action", () => {
      expectIssues(
        validateManifest({
          name: "App",
          file_handlers: [
            { action: "/open", accept: { "text/plain": [".txt"] } },
            { action: "/./open", accept: { "text/csv": ".csv" } }
          ]
        }),
        ['Duplicate action "/./open" in file_handlers']
      );
    });

    it("requires a multipart POST to receive files", () => {
      expectIssues(
        validateManifest(
          untyped({
            name: "App",
            share_target: {
              action: "/share",
              params: { files: [{ name: "f", accept: "image/*" }] }
            }
          })
        ),
        ['share_target.params.files requires method "POST"']
      );
    });

    it("rejects an invalid note-taking URL", () => {
      expectIssues(
        validateManifest({
          name: "App",
          note_taking: { new_note_url: "/a//b" }
        }),
        ['note_taking.new_note_url "/a//b" is not a valid URL or path']
      );
    });
  });

  describe("categories and display_override", () => {
    it("detects case-insensitive duplicate categories", () => {
      expectIssues(
        validateManifest({ name: "App", categories: ["Games", "games"] }),
        ['Duplicate category "games"']
      );
    });

    it.each<{ name: string; options: ManifestOptions; issue: string }>([
      {
        name: "an override that only repeats display",
        options: {
          name: "App",
          display: "standalone",
          display_override: ["standalone"]
        },
        issue: 'display_override contains only "standalone"'
      },
      {
        name: "an override that only repeats the default display",
        options: { name: "App", display_override: ["browser"] },
        issue: 'display_override contains only "browser"'
      },
      {
        name: "a repeated value",
        options: {
          name: "App",
          display_override: ["standalone", "minimal-ui", "standalone"]
        },
        issue: 'Duplicate value "standalone" in display_override'
      },
      {
        name: "an unknown value",
        options: untyped({ name: "App", display_override: ["standalon"] }),
        issue: 'Unknown display_override value "standalon"'
      }
    ])("rejects $name", ({ options, issue }) => {
      expectIssues(validateManifest(options), [issue]);
    });
  });

  describe("scope_extensions", () => {
    it("accepts bare https origins", () => {
      expectValid(
        validateManifest({
          name: "App",
          scope_extensions: [
            { origin: "https://other.com" },
            { type: "origin", origin: "https://other.example:8443" }
          ]
        })
      );
    });

    it.each([
      ["not-a-url", "is not a valid URL"],
      ["http://other.com", "must use the https scheme"],
      ["https://other.com/app", "must be a bare origin"],
      ["https://other.com?", "must be a bare origin"],
      ["https://user@other.com", "must be a bare origin"]
    ])("rejects %j", (origin, problem) => {
      expectIssues(
        validateManifest(
          untyped({ name: "App", scope_extensions: [{ origin }] })
        ),
        [`scope_extensions[0]: origin "${origin}" ${problem}`]
      );
    });

    it("rejects the same origin listed twice", () => {
      expectIssues(
        validateManifest({
          name: "App",
          scope_extensions: [
            { origin: "https://other.com" },
            { origin: "https://OTHER.com" }
          ]
        }),
        ['Duplicate origin "https://OTHER.com" in scope_extensions']
      );
    });
  });

  describe("related_applications", () => {
    it("rejects an invalid URL", () => {
      expectIssues(
        validateManifest(
          untyped({
            name: "App",
            related_applications: [{ platform: "play", url: "not-a-url" }]
          })
        ),
        [
          'Related application URL "not-a-url" for platform "play" is not a valid URL'
        ]
      );
    });

    it("rejects preferring related applications without listing any", () => {
      expectIssues(
        validateManifest({ name: "App", prefer_related_applications: true }),
        [
          "prefer_related_applications is true but related_applications is empty"
        ]
      );
    });

    it("rejects the same application listed twice", () => {
      expectIssues(
        validateManifest({
          name: "App",
          related_applications: [
            { platform: "play", id: "com.example" },
            { platform: "play", id: "com.example" }
          ]
        }),
        ['Duplicate related application for platform "play"']
      );
    });
  });

  it("collects every issue, in member order", () => {
    expectIssues(
      validateManifest({
        name: "App",
        theme_color: "not-a-color",
        background_color: "still-not-a-color",
        categories: ["A", "a"],
        icons: [
          { src: "/icon.svg", sizes: "192x192" },
          { src: "/icon.png", sizes: "any" }
        ]
      }),
      [
        'icons[0]: SVG images must have sizes set to "any"',
        'icons[1]: Only SVG images can have sizes set to "any"',
        'Invalid theme_color "not-a-color"',
        'Invalid background_color "still-not-a-color"',
        'Duplicate category "a"'
      ]
    );
  });
});
