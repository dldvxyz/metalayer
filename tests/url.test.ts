import { describe, expect, it } from "vitest";

import {
  canonicalizePercentEncoding,
  getPathname,
  hasControlCharacters,
  isValidUrlOrPath,
  normalizePath,
  normalizeUrl,
  parseUrlOrPath,
  validatePath,
  validateUrl
} from "../src/shared/url.js";

describe(hasControlCharacters, () => {
  it.each([
    ["a\tb", true],
    ["a\nb", true],
    ["a\rb", true],
    ["a\u0000b", true],
    ["a\u007Fb", true],
    ["hello world", false],
    ["café ☕", false],
    ["", false]
  ])("returns the right answer for %j", (input, expected) => {
    expect(hasControlCharacters(input)).toBe(expected);
  });
});

describe(validateUrl, () => {
  it.each([
    ["https://example.com", "https://example.com/"],
    ["http://example.com/path?q=1#h", "http://example.com/path?q=1#h"],
    [
      "https://example.com/redirect?to=https://other.com",
      "https://example.com/redirect?to=https://other.com"
    ],
    ["https://Example.COM:443/a", "https://example.com/a"]
  ])("accepts %s", (input, href) => {
    expect(validateUrl(input)?.href).toBe(href);
  });

  it.each([
    "ftp://example.com/file",
    // oxlint-disable-next-line no-script-url -- asserts that script URLs are rejected
    "javascript:alert(1)",
    "mailto:someone@example.com",
    "data:text/plain,hello",
    "file:///etc/passwd",
    "not-a-url",
    "https://",
    "",
    "https://example.com/a\nb",
    "https://example.com/a\tb",
    "https://example.com//double",
    "https://example.com/a//b"
  ])("rejects %j", (input) => {
    expect(validateUrl(input)).toBeUndefined();
  });
});

describe(validatePath, () => {
  it.each([
    ["/", true],
    ["/about", true],
    ["/search?q=a&b=c#top", true],
    ["/café", true],
    ["about", false],
    ["", false],
    ["https://example.com/", false],
    ["//protocol-relative", false],
    ["/a//b", false],
    ["/a\nb", false]
  ])("returns the right answer for %j", (input, expected) => {
    expect(validatePath(input)).toBe(expected);
  });
});

describe(normalizePath, () => {
  it.each([
    ["/a/./b/../c", "/a/c"],
    ["/café", "/caf%C3%A9"],
    ["/a b", "/a%20b"],
    ["/a?b=1#c", "/a?b=1#c"],
    ["/a//b", "/a//b"]
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe(normalizeUrl, () => {
  it.each([
    ["https://Example.COM:443/a/../b", "https://example.com/b"],
    ["https://hello.world", "https://hello.world/"],
    ["/a/./b", "/a/b"],
    ["my-app", "my-app"],
    ["ftp://example.com", "ftp://example.com"]
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });
});

describe(isValidUrlOrPath, () => {
  it.each([
    ["https://example.com/icon.png", true],
    ["/icon.png", true],
    ["icon.png", false],
    ["./icon.png", false],
    ["//cdn.example.com/icon.png", false],
    ["data:image/png;base64,AAAA", false]
  ])("returns the right answer for %j", (input, expected) => {
    expect(isValidUrlOrPath(input)).toBe(expected);
  });
});

describe(parseUrlOrPath, () => {
  it("parses paths against a placeholder origin", () => {
    expect(parseUrlOrPath("/a/b?c#d")?.pathname).toBe("/a/b");
  });

  it("keeps the origin of absolute URLs", () => {
    expect(parseUrlOrPath("https://cdn.example.com/x")?.origin).toBe(
      "https://cdn.example.com"
    );
  });
});

describe(getPathname, () => {
  it.each([
    ["/Icon.SVG?v=2#x", "/icon.svg"],
    ["https://cdn.example.com/Icons/App.ICO?v=1", "/icons/app.ico"],
    ["not a url", undefined],
    ["/a//b", undefined]
  ])("returns the lowercase pathname of %j", (input, expected) => {
    expect(getPathname(input)).toBe(expected);
  });
});

describe(canonicalizePercentEncoding, () => {
  it.each([
    ["/caf%c3%a9", "/caf%C3%A9"],
    ["/café", "/caf%C3%A9"],
    ["/%7Ejoe", "/~joe"],
    ["/%41%2d%5F", "/A-_"],
    ["/a%2Ab", "/a%2Ab"],
    ["/a%24", "/a%24"],
    ["/a%2fb", "/a%2Fb"],
    ["/a%3Fb", "/a%3Fb"],
    ["/a%", "/a%"],
    ["/a%2", "/a%2"],
    ["/%zz", "/%zz"],
    ["/%25", "/%25"],
    ["/😀", "/%F0%9F%98%80"],
    ["/*.php$", "/*.php$"]
  ])("canonicalizes %j to %j", (input, expected) => {
    expect(canonicalizePercentEncoding(input)).toBe(expected);
  });
});
