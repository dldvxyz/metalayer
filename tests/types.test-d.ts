import { describe, expectTypeOf, it } from "vitest";

import type {
  AbsoluteUrl,
  CssColor,
  ImagePurpose,
  IsoDate,
  IsoDateTime,
  ManifestOptions,
  ManifestShareTarget,
  NonEmptyArray,
  NonUnitaryArray,
  RobotsOptions,
  RobotsRule,
  SitemapOptions,
  UrlPath,
  UserAgent,
  ValidationResult
} from "../src/index.js";
import {
  generateRobotsTxt,
  validateManifest,
  validateRobotsTxt,
  validateSitemap
} from "../src/index.js";

describe("shared types", () => {
  it("NonEmptyArray requires at least one element and accepts readonly tuples", () => {
    expectTypeOf<["a"]>().toExtend<NonEmptyArray<string>>();
    expectTypeOf<readonly ["a", "b"]>().toExtend<NonEmptyArray<string>>();
    expectTypeOf<[]>().not.toExtend<NonEmptyArray<string>>();
    expectTypeOf<string[]>().not.toExtend<NonEmptyArray<string>>();
  });

  it("NonUnitaryArray requires at least two elements", () => {
    expectTypeOf<["a", "b"]>().toExtend<NonUnitaryArray<string>>();
    expectTypeOf<["a"]>().not.toExtend<NonUnitaryArray<string>>();
  });

  it("AbsoluteUrl accepts only http(s) URLs", () => {
    expectTypeOf<"https://example.com">().toExtend<AbsoluteUrl>();
    expectTypeOf<"http://example.com">().toExtend<AbsoluteUrl>();
    expectTypeOf<"ftp://example.com">().not.toExtend<AbsoluteUrl>();
    expectTypeOf<"/path">().not.toExtend<AbsoluteUrl>();
  });

  it("UrlPath accepts only strings starting with /", () => {
    expectTypeOf<"/">().toExtend<UrlPath>();
    expectTypeOf<"/about">().toExtend<UrlPath>();
    expectTypeOf<"about">().not.toExtend<UrlPath>();
  });

  it("ValidationResult is a union discriminated by the valid flag", () => {
    type Result = ValidationResult<{ id: number }>;
    expectTypeOf<Extract<Result, { valid: true }>["options"]>().toEqualTypeOf<{
      id: number;
    }>();
    expectTypeOf<Extract<Result, { valid: false }>["issues"]>().toEqualTypeOf<
      string[]
    >();
    expectTypeOf<Result["valid"]>().toEqualTypeOf<boolean>();
  });
});

describe("sitemap types", () => {
  it("IsoDate requires two-digit month and day", () => {
    expectTypeOf<"2024-01-15">().toExtend<IsoDate>();
    expectTypeOf<"2024-12-31">().toExtend<IsoDate>();
    expectTypeOf<"2024-1-5">().not.toExtend<IsoDate>();
    expectTypeOf<"2024-13-01">().not.toExtend<IsoDate>();
    expectTypeOf<"2024-01-32">().not.toExtend<IsoDate>();
    expectTypeOf<"01-15-2024">().not.toExtend<IsoDate>();
  });

  it("IsoDateTime requires a time zone and allows optional seconds and fractions", () => {
    expectTypeOf<"2024-01-15T10:30Z">().toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15T10:30:00Z">().toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15T10:30:00.123Z">().toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15T10:30:00+05:30">().toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15T10:30:00-08:00">().toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15T10:30:00">().not.toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15T10:30:0garbage">().not.toExtend<IsoDateTime>();
    expectTypeOf<"2024-01-15 10:30:00Z">().not.toExtend<IsoDateTime>();
  });

  it("SitemapOptions accepts as-const input", () => {
    const options = {
      origin: "https://example.com",
      urls: [
        {
          path: "/",
          lastmod: "2024-01-15T10:30:00Z",
          changefreq: "weekly",
          priority: 0.5
        }
      ]
    } as const;
    expectTypeOf(options).toExtend<SitemapOptions>();
    expectTypeOf(validateSitemap(options)).toEqualTypeOf<
      ValidationResult<SitemapOptions>
    >();
  });
});

describe("robots types", () => {
  it("RobotsRule requires allow or disallow", () => {
    expectTypeOf<{ userAgent: ["*"]; allow: ["/"] }>().toExtend<RobotsRule>();
    expectTypeOf<{
      userAgent: ["*"];
      disallow: ["/"];
    }>().toExtend<RobotsRule>();
    expectTypeOf<{ userAgent: ["*"] }>().not.toExtend<RobotsRule>();
  });

  it("paths must start with / and sitemaps must be absolute", () => {
    expectTypeOf<{
      userAgent: ["*"];
      disallow: ["admin"];
    }>().not.toExtend<RobotsRule>();
    expectTypeOf<{
      rules: [{ userAgent: ["*"]; allow: ["/"] }];
      sitemaps: ["/sitemap.xml"];
    }>().not.toExtend<RobotsOptions>();
  });

  it("UserAgent suggests known tokens but accepts any string", () => {
    expectTypeOf<"Googlebot">().toExtend<UserAgent>();
    expectTypeOf<"MyCustomBot">().toExtend<UserAgent>();
  });

  it("accepts custom user agents and as-const input", () => {
    const options = {
      rules: [{ userAgent: ["MyCustomBot", "Googlebot"], allow: ["/"] }],
      sitemaps: ["https://example.com/sitemap.xml"]
    } as const;
    expectTypeOf(options).toExtend<RobotsOptions>();
    expectTypeOf(generateRobotsTxt(options)).toEqualTypeOf<string>();
    expectTypeOf(validateRobotsTxt(options)).toEqualTypeOf<
      ValidationResult<RobotsOptions>
    >();
  });
});

describe("manifest types", () => {
  it("ManifestOptions requires name or short_name", () => {
    expectTypeOf<{ name: string }>().toExtend<ManifestOptions>();
    expectTypeOf<{ short_name: string }>().toExtend<ManifestOptions>();
    expectTypeOf<{ description: string }>().not.toExtend<ManifestOptions>();
  });

  it("restricts enumerated members and sizes", () => {
    expectTypeOf<{
      name: "a";
      display: "popup";
    }>().not.toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      display_override: ["tabbed", "borderless"];
    }>().toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      display_override: ["popup"];
    }>().not.toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      icons: [{ src: "/i.png"; sizes: "192" }];
    }>().not.toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      icons: [{ src: "/i.ico"; sizes: ["16x16"] }];
    }>().not.toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      screenshots: [{ src: "/s.png"; sizes: ["1x1", "2x2"] }];
    }>().not.toExtend<ManifestOptions>();
  });

  it("accepts an absolute or relative scope", () => {
    expectTypeOf<{ name: "a"; scope: "/" }>().toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      scope: "https://example.com/app/";
    }>().toExtend<ManifestOptions>();
    expectTypeOf<{ name: "a"; scope: "app" }>().not.toExtend<ManifestOptions>();
  });

  it("ImagePurpose accepts combinations of known tokens only", () => {
    expectTypeOf<"any">().toExtend<ImagePurpose>();
    expectTypeOf<"any maskable">().toExtend<ImagePurpose>();
    expectTypeOf<"monochrome any maskable">().toExtend<ImagePurpose>();
    expectTypeOf<"badge">().not.toExtend<ImagePurpose>();
  });

  it("CssColor suggests color functions but accepts any string", () => {
    expectTypeOf<"oklch(62% 0.19 258)">().toExtend<CssColor>();
    expectTypeOf<"rebeccapurple">().toExtend<CssColor>();
  });

  it("only a multipart POST share target can receive files", () => {
    expectTypeOf<{
      action: "/share";
      method: "POST";
      enctype: "multipart/form-data";
      params: { files: [{ name: "f"; accept: ["image/*", ".png"] }] };
    }>().toExtend<ManifestShareTarget>();
    expectTypeOf<{
      action: "/share";
      method: "POST";
      params: { files: [{ name: "f"; accept: "image/*" }] };
    }>().not.toExtend<ManifestShareTarget>();
    expectTypeOf<{
      action: "/share";
      params: { files: [{ name: "f"; accept: "image/*" }] };
    }>().not.toExtend<ManifestShareTarget>();
    expectTypeOf<{
      action: "/share";
      params: { title: "t" };
    }>().toExtend<ManifestShareTarget>();
  });

  it("scope_extensions origins must use https", () => {
    expectTypeOf<{
      name: "a";
      scope_extensions: [{ origin: "https://other.com" }];
    }>().toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      scope_extensions: [{ origin: "http://other.com" }];
    }>().not.toExtend<ManifestOptions>();
  });

  it("requires url or id on related applications", () => {
    expectTypeOf<{
      name: "a";
      related_applications: [{ platform: "play" }];
    }>().not.toExtend<ManifestOptions>();
    expectTypeOf<{
      name: "a";
      related_applications: [{ platform: "play"; id: "x" }];
    }>().toExtend<ManifestOptions>();
  });

  it("accepts as-const input", () => {
    const options = {
      name: "App",
      icons: [
        {
          src: "/favicon.ico",
          sizes: ["16x16", "32x32"],
          purpose: "any maskable"
        }
      ],
      file_handlers: [{ action: "/open", accept: { "text/plain": ".txt" } }],
      share_target: {
        action: "/share",
        method: "POST",
        enctype: "multipart/form-data",
        params: { files: [{ name: "f", accept: ".png" }] }
      }
    } as const;
    expectTypeOf(options).toExtend<ManifestOptions>();
    expectTypeOf(validateManifest(options)).toEqualTypeOf<
      ValidationResult<ManifestOptions>
    >();
  });
});
