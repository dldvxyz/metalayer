import { describe, expectTypeOf, it } from "vitest";
import type {
  AbsoluteUrl,
  ManifestOptions,
  NonEmptyArray,
  NonUnitaryArray,
  RobotsRule,
  UrlPath,
  ValidationResult
} from "../src/index.js";

describe("shared types", () => {
  it("NonEmptyArray requires at least one element", () => {
    expectTypeOf<["a"]>().toExtend<NonEmptyArray<string>>();
    expectTypeOf<["a", "b"]>().toExtend<NonEmptyArray<string>>();
    expectTypeOf<[]>().not.toExtend<NonEmptyArray<string>>();
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

  it("ValidationResult narrows on the valid flag", () => {
    const result = {} as ValidationResult<{ id: number }>;
    if (result.valid) {
      expectTypeOf(result.options).toEqualTypeOf<{ id: number }>();
    } else {
      expectTypeOf(result.issues).toEqualTypeOf<string[]>();
    }
  });
});

describe("option types", () => {
  it("ManifestOptions requires name or short_name", () => {
    expectTypeOf<{ name: string }>().toExtend<ManifestOptions>();
    expectTypeOf<{ short_name: string }>().toExtend<ManifestOptions>();
    expectTypeOf<{ description: string }>().not.toExtend<ManifestOptions>();
  });

  it("RobotsRule requires allow or disallow", () => {
    expectTypeOf<{ userAgent: ["*"]; allow: ["/"] }>().toExtend<RobotsRule>();
    expectTypeOf<{
      userAgent: ["*"];
      disallow: ["/"];
    }>().toExtend<RobotsRule>();
    expectTypeOf<{ userAgent: ["*"] }>().not.toExtend<RobotsRule>();
  });
});
