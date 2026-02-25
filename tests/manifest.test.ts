import { describe, expect, it } from "vitest";
import { generateManifest, validateManifest } from "../src/manifest.js";

describe("generateManifest", () => {
  it("generates a minimal manifest", () => {
    const result = generateManifest({ name: "My App" });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("My App");
  });

  it("outputs valid JSON", () => {
    const result = generateManifest({
      name: "Test",
      short_name: "T",
      start_url: "/"
    });
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("includes all provided fields", () => {
    const result = generateManifest({
      name: "My PWA",
      short_name: "PWA",
      description: "A progressive web app",
      start_url: "/",
      display: "standalone",
      theme_color: "#ffffff",
      background_color: "#000000",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("My PWA");
    expect(parsed.display).toBe("standalone");
    expect(parsed.icons).toHaveLength(2);
    expect(parsed.icons[0].sizes).toBe("192x192");
  });

  it("generates pretty-printed output", () => {
    const result = generateManifest({ name: "Test" });
    expect(result).toContain("\n");
    expect(result).toContain("  ");
  });

  it("handles empty options", () => {
    const result = generateManifest({} as any);
    expect(JSON.parse(result)).toEqual({});
  });

  it("ends with a trailing newline", () => {
    const result = generateManifest({ name: "Test" });
    expect(result.endsWith("\n")).toBe(true);
  });

  it("includes shortcuts", () => {
    const result = generateManifest({
      name: "App",
      shortcuts: [
        { name: "Home", url: "/" },
        { name: "Settings", url: "/settings" }
      ]
    });
    const parsed = JSON.parse(result);
    expect(parsed.shortcuts).toHaveLength(2);
    expect(parsed.shortcuts[1].url).toBe("/settings");
  });

  it("generates a manifest with short_name only", () => {
    const result = generateManifest({ short_name: "App" });
    const parsed = JSON.parse(result);
    expect(parsed.short_name).toBe("App");
    expect(parsed.name).toBeUndefined();
  });

  it("includes related_applications", () => {
    const result = generateManifest({
      name: "App",
      prefer_related_applications: true,
      related_applications: [
        {
          platform: "play",
          url: "https://play.google.com/store/apps/details?id=com.example"
        }
      ]
    });
    const parsed = JSON.parse(result);
    expect(parsed.prefer_related_applications).toBe(true);
    expect(parsed.related_applications).toHaveLength(1);
    expect(parsed.related_applications[0].platform).toBe("play");
  });

  it("includes file_handlers", () => {
    const result = generateManifest({
      name: "Editor",
      file_handlers: [
        {
          action: "/open",
          accept: { "text/plain": [".txt"] }
        }
      ]
    });
    const parsed = JSON.parse(result);
    expect(parsed.file_handlers[0].action).toBe("/open");
    expect(parsed.file_handlers[0].accept["text/plain"]).toEqual([".txt"]);
  });

  it("includes share_target", () => {
    const result = generateManifest({
      name: "Share App",
      share_target: {
        action: "/share",
        method: "POST",
        enctype: "multipart/form-data",
        params: { title: "name", text: "body" }
      }
    });
    const parsed = JSON.parse(result);
    expect(parsed.share_target.action).toBe("/share");
    expect(parsed.share_target.method).toBe("POST");
  });

  it("includes launch_handler", () => {
    const result = generateManifest({
      name: "App",
      launch_handler: { client_mode: "navigate-existing" }
    });
    const parsed = JSON.parse(result);
    expect(parsed.launch_handler.client_mode).toBe("navigate-existing");
  });

  it("includes protocol_handlers in output", () => {
    const result = generateManifest({
      name: "App",
      protocol_handlers: [{ protocol: "web+custom", url: "/handle?val=%s" }]
    });
    const parsed = JSON.parse(result);
    expect(parsed.protocol_handlers[0].protocol).toBe("web+custom");
    expect(parsed.protocol_handlers[0].url).toContain("%s");
  });

  it("includes display_override in output", () => {
    const result = generateManifest({
      name: "App",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone"]
    });
    const parsed = JSON.parse(result);
    expect(parsed.display_override).toEqual([
      "window-controls-overlay",
      "standalone"
    ]);
  });

  it("includes orientation and categories", () => {
    const result = generateManifest({
      name: "App",
      orientation: "portrait",
      categories: ["games", "entertainment"]
    });
    const parsed = JSON.parse(result);
    expect(parsed.orientation).toBe("portrait");
    expect(parsed.categories).toEqual(["games", "entertainment"]);
  });

  it("includes scope and start_url", () => {
    const result = generateManifest({
      name: "App",
      start_url: "/app/home",
      scope: "https://example.com/app"
    });
    const parsed = JSON.parse(result);
    expect(parsed.start_url).toBe("/app/home");
    expect(parsed.scope).toBe("https://example.com/app");
  });

  it("normalizes absolute URLs", () => {
    const result = generateManifest({
      name: "App",
      scope: "https://Example.COM/app",
      start_url: "https://Example.COM/app/home",
      shortcuts: [{ name: "Home", url: "https://Example.COM/app/" }]
    });
    const parsed = JSON.parse(result);
    expect(parsed.scope).toBe("https://example.com/app");
    expect(parsed.start_url).toBe("https://example.com/app/home");
    expect(parsed.shortcuts[0].url).toBe("https://example.com/app/");
  });

  it("preserves path URLs without normalization", () => {
    const result = generateManifest({
      name: "App",
      start_url: "/app/home",
      shortcuts: [{ name: "Home", url: "/app/" }]
    });
    const parsed = JSON.parse(result);
    expect(parsed.start_url).toBe("/app/home");
    expect(parsed.shortcuts[0].url).toBe("/app/");
  });

  it("round-trips a comprehensive manifest", () => {
    const result = generateManifest({
      name: "Full PWA",
      short_name: "PWA",
      description: "A fully featured app",
      start_url: "/",
      scope: "https://example.com/",
      id: "com.example.pwa",
      display: "standalone",
      display_override: ["window-controls-overlay", "standalone"],
      orientation: "portrait",
      theme_color: "#4285f4",
      background_color: "#ffffff",
      lang: "en",
      dir: "ltr",
      categories: ["productivity", "utilities"],
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ],
      shortcuts: [{ name: "Home", url: "/" }]
    });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("Full PWA");
    expect(parsed.short_name).toBe("PWA");
    expect(parsed.display).toBe("standalone");
    expect(parsed.lang).toBe("en");
    expect(parsed.dir).toBe("ltr");
    expect(parsed.id).toBe("com.example.pwa");
    expect(parsed.icons).toHaveLength(2);
    expect(parsed.categories).toHaveLength(2);
  });
});

describe("validateManifest", () => {
  // Valid cases

  it("returns valid for a minimal manifest", () => {
    const options = { name: "App" };
    const result = validateManifest(options);
    expect(result).toEqual({ valid: true, options });
  });

  it("returns valid for a fully populated manifest", () => {
    const result = validateManifest({
      name: "My PWA",
      short_name: "PWA",
      description: "A progressive web app",
      start_url: "/app",
      scope: "https://example.com/app",
      display: "standalone",
      theme_color: "#ffffff",
      background_color: "rgb(0, 0, 0)",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" }
      ],
      categories: ["productivity"]
    });
    expect(result.valid).toBe(true);
  });

  // Icon validation

  it("detects duplicate icon src", () => {
    const result = validateManifest({
      name: "App",
      icons: [
        { src: "/icon.png", sizes: "192x192" },
        { src: "/icon.png", sizes: "512x512" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate src");
      expect(result.issues[0]).toContain("/icon.png");
    }
  });

  it("requires SVG icons (by type) to have sizes 'any'", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "192x192" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("SVG");
      expect(result.issues[0]).toContain('"any"');
    }
  });

  it("requires SVG icons (by .svg extension) to have sizes 'any'", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon.svg", sizes: "192x192" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("SVG");
    }
  });

  it("accepts SVG icon with sizes 'any'", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects non-SVG icon with sizes 'any'", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon.png", sizes: "any", type: "image/png" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Only SVG");
    }
  });

  it("rejects non-square icon sizes", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon.png", sizes: "192x256" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("192x256");
      expect(result.issues[0]).toContain("square");
    }
  });

  it("accepts square icon sizes", () => {
    const result = validateManifest({
      name: "App",
      icons: [
        { src: "/icon-192.png", sizes: "192x192" },
        { src: "/icon-512.png", sizes: "512x512" }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("detects duplicate sizes across icons", () => {
    const result = validateManifest({
      name: "App",
      icons: [
        { src: "/icon-a.png", sizes: "192x192" },
        { src: "/icon-b.png", sizes: "192x192" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain('Duplicate size "192x192"');
    }
  });

  // Screenshot validation

  it("accepts non-square screenshot sizes", () => {
    const result = validateManifest({
      name: "App",
      screenshots: [{ src: "/screenshot.png", sizes: "192x256" }]
    });
    expect(result.valid).toBe(true);
  });

  it("detects duplicate screenshot src", () => {
    const result = validateManifest({
      name: "App",
      screenshots: [
        { src: "/shot.png", sizes: "192x192" },
        { src: "/shot.png", sizes: "512x512" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate src");
    }
  });

  // Shortcut validation

  it("detects duplicate shortcut names", () => {
    const result = validateManifest({
      name: "App",
      shortcuts: [
        { name: "Home", url: "/" },
        { name: "Home", url: "/home" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate shortcut name");
      expect(result.issues[0]).toContain("Home");
    }
  });

  it("detects shortcut URL outside scope", () => {
    const result = validateManifest({
      name: "App",
      scope: "https://example.com/app",
      shortcuts: [{ name: "Settings", url: "/settings" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.stringContaining("outside the manifest scope")
      );
    }
  });

  it("accepts shortcut URL within scope", () => {
    const result = validateManifest({
      name: "App",
      scope: "https://example.com/app",
      shortcuts: [{ name: "Settings", url: "/app/settings" }]
    });
    expect(result.valid).toBe(true);
  });

  it("validates shortcut icons", () => {
    const result = validateManifest({
      name: "App",
      shortcuts: [
        {
          name: "Home",
          url: "/",
          icons: [{ src: "/shortcut.png", sizes: "64x128" }]
        }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("64x128");
      expect(result.issues[0]).toContain("square");
    }
  });

  // Scope validation

  it("detects start_url outside scope", () => {
    const result = validateManifest({
      name: "App",
      start_url: "/other",
      scope: "https://example.com/app"
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.stringContaining("outside the manifest scope")
      );
    }
  });

  it("accepts start_url within scope", () => {
    const result = validateManifest({
      name: "App",
      start_url: "/app/home",
      scope: "https://example.com/app"
    });
    expect(result.valid).toBe(true);
  });

  it("accepts absolute start_url within scope", () => {
    const result = validateManifest({
      name: "App",
      start_url: "https://example.com/app/home",
      scope: "https://example.com/app"
    });
    expect(result.valid).toBe(true);
  });

  it("rejects absolute start_url outside scope", () => {
    const result = validateManifest({
      name: "App",
      start_url: "https://other.com/app",
      scope: "https://example.com/app"
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.stringContaining("outside the manifest scope")
      );
    }
  });

  it("rejects invalid scope", () => {
    const result = validateManifest({
      name: "App",
      scope: "/app" as any
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid scope");
    }
  });

  it("skips scope checks when scope is invalid", () => {
    const result = validateManifest({
      name: "App",
      scope: "not-a-url" as any,
      start_url: "/other"
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Should only have the invalid scope issue, not a start_url scope issue
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("Invalid scope");
    }
  });

  // Color validation

  it("accepts valid hex colors", () => {
    for (const color of ["#fff", "#ffffff", "#ffffffaa", "#FFAA00"]) {
      const result = validateManifest({
        name: "App",
        theme_color: color
      });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts valid rgb and hsl colors", () => {
    const result = validateManifest({
      name: "App",
      theme_color: "rgb(255, 0, 0)" as any,
      background_color: "hsl(120, 100%, 50%)"
    });
    expect(result.valid).toBe(true);
  });

  it("accepts named CSS colors", () => {
    for (const color of ["red", "transparent", "RebeccaPurple"]) {
      const result = validateManifest({
        name: "App",
        theme_color: color
      });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects invalid theme_color", () => {
    const result = validateManifest({
      name: "App",
      theme_color: "not-a-color"
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid theme_color");
    }
  });

  it("rejects invalid background_color", () => {
    const result = validateManifest({
      name: "App",
      background_color: "not-a-color"
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid background_color");
    }
  });

  // Protocol handlers

  it("accepts web+ custom protocol", () => {
    const result = validateManifest({
      name: "App",
      protocol_handlers: [{ protocol: "web+custom", url: "/handle?val=%s" }]
    });
    expect(result.valid).toBe(true);
  });

  it("accepts safelisted protocol", () => {
    const result = validateManifest({
      name: "App",
      protocol_handlers: [{ protocol: "mailto", url: "/compose?to=%s" }]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid protocol", () => {
    const result = validateManifest({
      name: "App",
      protocol_handlers: [{ protocol: "custom", url: "/handle?val=%s" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid protocol");
    }
  });

  it("rejects protocol handler URL missing %s", () => {
    const result = validateManifest({
      name: "App",
      protocol_handlers: [{ protocol: "web+foo", url: "/handle" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("%s");
    }
  });

  // Categories

  it("detects case-insensitive duplicate categories", () => {
    const result = validateManifest({
      name: "App",
      categories: ["Games", "games"]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate category");
    }
  });

  // display_override

  it("warns when display_override is redundant with display", () => {
    const result = validateManifest({
      name: "App",
      display: "standalone",
      display_override: ["standalone"]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("redundant");
    }
  });

  it("accepts display_override with different values", () => {
    const result = validateManifest({
      name: "App",
      display: "standalone",
      display_override: ["fullscreen", "standalone"]
    });
    expect(result.valid).toBe(true);
  });

  // Multiple icon issues at once

  it("collects multiple icon issues at once", () => {
    const result = validateManifest({
      name: "App",
      icons: [
        { src: "/icon.svg", sizes: "192x192" },
        { src: "/icon.png", sizes: "any", type: "image/png" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("detects duplicate icon src across shortcut icons", () => {
    const result = validateManifest({
      name: "App",
      shortcuts: [
        {
          name: "Page A",
          url: "/a",
          icons: [
            { src: "/shortcut.png", sizes: "96x96" },
            { src: "/shortcut.png", sizes: "128x128" }
          ]
        }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate src");
    }
  });

  it("accepts rgba and hsla colors", () => {
    const result = validateManifest({
      name: "App",
      theme_color: "rgba(255, 0, 0, 0.5)" as any,
      background_color: "hsla(120, 100%, 50%, 0.8)"
    });
    expect(result.valid).toBe(true);
  });

  it("accepts 4-digit and 8-digit hex colors", () => {
    const resultShort = validateManifest({
      name: "App",
      theme_color: "#f00a"
    });
    expect(resultShort.valid).toBe(true);

    const resultLong = validateManifest({
      name: "App",
      theme_color: "#ff0000aa"
    });
    expect(resultLong.valid).toBe(true);
  });

  // Path validation

  it("rejects invalid icon src path", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon//bad.png" as any, sizes: "192x192" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL or path");
    }
  });

  it("accepts valid icon src path", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid start_url path", () => {
    const result = validateManifest({
      name: "App",
      start_url: "/app//home" as any
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL or path");
    }
  });

  it("rejects invalid shortcut URL path", () => {
    const result = validateManifest({
      name: "App",
      shortcuts: [{ name: "Home", url: "/app//home" as any }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL or path");
    }
  });

  it("rejects invalid file handler action path", () => {
    const result = validateManifest({
      name: "App",
      file_handlers: [
        { action: "/open//file" as any, accept: { "text/plain": [".txt"] } }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL or path");
    }
  });

  it("rejects invalid share target action path", () => {
    const result = validateManifest({
      name: "App",
      share_target: {
        action: "/share//target" as any,
        params: { title: "t" }
      }
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL or path");
    }
  });

  // Name validation

  it("rejects whitespace-only name", () => {
    const result = validateManifest({ name: "  " } as any);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("name");
    }
  });

  // Id validation

  it("accepts freeform id without validation", () => {
    const result = validateManifest({ name: "App", id: "my-app" });
    expect(result.valid).toBe(true);
  });

  it("accepts URL-like id within scope", () => {
    const result = validateManifest({
      name: "App",
      scope: "https://example.com/app",
      id: "/app/main"
    });
    expect(result.valid).toBe(true);
  });

  it("rejects URL-like id outside scope", () => {
    const result = validateManifest({
      name: "App",
      scope: "https://example.com/app",
      id: "/other"
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("outside the manifest scope");
    }
  });

  // ICO / multi-size icons

  it("accepts ICO file with multiple sizes", () => {
    const result = validateManifest({
      name: "App",
      icons: [
        { src: "/favicon.ico", sizes: ["16x16", "32x32"], type: "image/x-icon" }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects non-ICO file with multiple sizes", () => {
    const result = validateManifest({
      name: "App",
      icons: [{ src: "/icon.png", sizes: ["16x16", "32x32"] as any }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Only ICO");
    }
  });

  // scope_extensions

  it("accepts valid scope_extensions origin", () => {
    const result = validateManifest({
      name: "App",
      scope_extensions: [{ origin: "https://other.com" }]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects scope_extensions origin with path", () => {
    const result = validateManifest({
      name: "App",
      scope_extensions: [{ origin: "https://other.com/app" as any }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("bare origin");
    }
  });

  // related_applications

  it("rejects invalid related_applications URL", () => {
    const result = validateManifest({
      name: "App",
      related_applications: [{ platform: "play", url: "not-a-url" as any }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL");
    }
  });

  // display_override duplicates

  it("detects duplicate display_override values", () => {
    const result = validateManifest({
      name: "App",
      display_override: ["standalone", "standalone"]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate value");
    }
  });

  // Multiple issues

  it("collects multiple issues", () => {
    const result = validateManifest({
      name: "App",
      theme_color: "not-a-color" as any,
      background_color: "still-not-a-color" as any,
      categories: ["A", "a"]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("generateManifest — protocol handler %s preservation", () => {
  it("preserves %s in protocol handler URL after normalization", () => {
    const result = generateManifest({
      name: "App",
      protocol_handlers: [{ protocol: "web+custom", url: "/handle?val=%s" }]
    });
    const parsed = JSON.parse(result);
    expect(parsed.protocol_handlers[0].url).toContain("%s");
  });
});
