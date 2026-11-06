import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  NonEmptyArray,
  SitemapOptions,
  SitemapUrl
} from "../src/index.js";
import { generateSitemap, validateSitemap } from "../src/index.js";
import { expectIssues, expectValid, untyped } from "./helpers.js";

const ORIGIN = "https://example.com";

/** Builds a path whose full URL under {@link ORIGIN} has the given length. */
function pathForUrlLength(length: number): `/${string}` {
  return `/${"a".repeat(length - ORIGIN.length - 1)}`;
}

/** Builds the given number of distinct URL entries. */
function entries(count: number): NonEmptyArray<SitemapUrl> {
  return [
    { path: "/p/0" },
    ...Array.from({ length: count - 1 }, (_, index): SitemapUrl => ({
      path: `/p/${index + 1}`
    }))
  ];
}

/** Validates a single-URL sitemap with the given lastmod, bypassing the types. */
function validateLastmod(lastmod: string) {
  return validateSitemap(
    untyped({ origin: ORIGIN, urls: [{ path: "/", lastmod }] })
  );
}

describe(generateSitemap, () => {
  it("generates exact output for a full entry", () => {
    expect(
      generateSitemap({
        origin: ORIGIN,
        urls: [
          {
            path: "/",
            lastmod: "2024-06-01",
            changefreq: "daily",
            priority: 0.8
          }
        ]
      })
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://example.com/</loc>",
        "    <lastmod>2024-06-01</lastmod>",
        "    <changefreq>daily</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
        "</urlset>",
        ""
      ].join("\n")
    );
  });

  it("writes one <url> per entry with only the fields given", () => {
    expect(
      generateSitemap({
        origin: ORIGIN,
        urls: [
          { path: "/", priority: 1 },
          { path: "/about", lastmod: "2024-01-01" },
          { path: "/blog", changefreq: "weekly" }
        ]
      })
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://example.com/</loc>",
        "    <priority>1.0</priority>",
        "  </url>",
        "  <url>",
        "    <loc>https://example.com/about</loc>",
        "    <lastmod>2024-01-01</lastmod>",
        "  </url>",
        "  <url>",
        "    <loc>https://example.com/blog</loc>",
        "    <changefreq>weekly</changefreq>",
        "  </url>",
        "</urlset>",
        ""
      ].join("\n")
    );
  });

  it.each([
    [0, "0.0"],
    [0.5, "0.5"],
    [1, "1.0"]
  ])("formats priority %d as %s", (priority, formatted) => {
    expect(
      generateSitemap({ origin: ORIGIN, urls: [{ path: "/", priority }] })
    ).toContain(`<priority>${formatted}</priority>`);
  });

  it.each([
    ["https://example.com/", "/about", "https://example.com/about"],
    ["https://example.com//", "/about", "https://example.com/about"],
    ["https://example.com/blog", "/post", "https://example.com/blog/post"],
    [
      "https://example.com",
      "/search?a=1&b=2",
      "https://example.com/search?a=1&amp;b=2"
    ],
    ["https://example.com", "/it's", "https://example.com/it&apos;s"],
    ["https://example.com", "/café", "https://example.com/caf%C3%A9"]
  ] as const)("joins %s and %s into %s", (origin, path, loc) => {
    expect(generateSitemap({ origin, urls: [{ path }] })).toContain(
      `    <loc>${loc}</loc>\n`
    );
  });

  it("does not mutate its input", () => {
    const options = {
      origin: ORIGIN,
      urls: [{ path: "/", lastmod: "2024-01-01", priority: 0.5 }]
    } as const;
    const snapshot = structuredClone(options);
    generateSitemap(options);
    expect(options).toStrictEqual(snapshot);
  });
});

describe(validateSitemap, () => {
  it("returns the options when valid", () => {
    const options = {
      origin: ORIGIN,
      urls: [{ path: "/" }, { path: "/about", priority: 0.8 }]
    } as const;
    expect(validateSitemap(options)).toStrictEqual({ valid: true, options });
  });

  it.each<{ name: string; options: SitemapOptions }>([
    {
      name: "the README example",
      options: {
        origin: ORIGIN,
        urls: [
          {
            path: "/",
            lastmod: "2025-01-15",
            changefreq: "weekly",
            priority: 1
          },
          { path: "/about", priority: 0.8 }
        ]
      }
    },
    {
      name: "an origin with trailing slashes",
      options: { origin: "https://example.com//", urls: [{ path: "/" }] }
    },
    {
      name: "an origin with a path prefix",
      options: { origin: "https://example.com/blog", urls: [{ path: "/post" }] }
    },
    {
      name: "valid percent-encoding",
      options: { origin: ORIGIN, urls: [{ path: "/caf%C3%A9" }] }
    },
    {
      name: "priorities at the boundaries",
      options: {
        origin: ORIGIN,
        urls: [
          { path: "/a", priority: 0 },
          { path: "/b", priority: 0.1 },
          { path: "/c", priority: 1 }
        ]
      }
    },
    {
      name: "a URL just under the length limit",
      options: { origin: ORIGIN, urls: [{ path: pathForUrlLength(2047) }] }
    },
    {
      name: "50,000 URLs",
      options: { origin: ORIGIN, urls: entries(50_000) }
    }
  ])("accepts $name", ({ options }) => {
    expectValid(validateSitemap(options));
  });

  describe("origin", () => {
    it("reports an invalid origin once, not once per URL", () => {
      expectIssues(
        validateSitemap(
          untyped({
            origin: "not-a-url",
            urls: [{ path: "/" }, { path: "/a" }]
          })
        ),
        ['Origin "not-a-url" is not a valid URL']
      );
    });

    it.each([
      "https://example.com?x=1",
      "https://example.com#frag",
      "https://user:pass@example.com"
    ] as const)("rejects %s", (origin) => {
      expectIssues(validateSitemap({ origin, urls: [{ path: "/" }] }), [
        "must not contain a query, fragment or credentials"
      ]);
    });
  });

  describe("paths", () => {
    it.each([
      ["about", 'Path "about" must start with "/"'],
      ["//page", 'URL for path "//page"'],
      ["/about ", "leading or trailing whitespace"],
      [" /about", "leading or trailing whitespace"],
      ["/ab\ncd", String.raw`Path "/ab\ncd" contains a control character`],
      ["/ab\tcd", String.raw`Path "/ab\tcd" contains a control character`],
      ["/%zz", 'Path "/%zz" contains an invalid percent-encoding'],
      [pathForUrlLength(2048), "A <loc> must be shorter than 2048 characters"]
    ])("rejects %j", (path, issue) => {
      expectIssues(
        validateSitemap(untyped({ origin: ORIGIN, urls: [{ path }] })),
        [issue]
      );
    });

    it("flags fragments and treats them as duplicates of the bare URL", () => {
      expectIssues(
        validateSitemap({
          origin: ORIGIN,
          urls: [{ path: "/about" }, { path: "/about#team" }]
        }),
        [
          'URL "https://example.com/about#team" contains a fragment',
          "Duplicate URL"
        ]
      );
    });

    it("detects duplicate URLs after normalization", () => {
      expectIssues(
        validateSitemap({
          origin: ORIGIN,
          urls: [
            { path: "/café" },
            { path: "/caf%C3%A9" },
            { path: "/b/../café" }
          ]
        }),
        [
          'Duplicate URL "https://example.com/caf%C3%A9"',
          'Duplicate URL "https://example.com/caf%C3%A9"'
        ]
      );
    });
  });

  describe("entry count", () => {
    it("rejects an empty urls array", () => {
      expectIssues(validateSitemap(untyped({ origin: ORIGIN, urls: [] })), [
        "Sitemap has no URLs"
      ]);
    });

    it("rejects more than 50,000 URLs", () => {
      expectIssues(validateSitemap({ origin: ORIGIN, urls: entries(50_001) }), [
        "Sitemap contains 50001 URLs. A single sitemap may contain at most 50000"
      ]);
    });
  });

  describe("priority", () => {
    it.each([-0.1, 1.1, 0.55, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects %d",
      (priority) => {
        expectIssues(
          validateSitemap({ origin: ORIGIN, urls: [{ path: "/", priority }] }),
          [`Priority ${priority} for "https://example.com/" is invalid`]
        );
      }
    );
  });

  describe("changefreq", () => {
    it("rejects values outside the protocol's list", () => {
      expectIssues(
        validateSitemap(
          untyped({
            origin: ORIGIN,
            urls: [{ path: "/", changefreq: "Weekly" }]
          })
        ),
        ['Invalid changefreq "Weekly"']
      );
    });
  });

  describe("lastmod", () => {
    it.each([
      "2024-01-15",
      "2024-01-15T10:30Z",
      "2024-01-15T10:30:00Z",
      "2024-01-15T10:30:00.123Z",
      "2024-01-15T10:30:00+05:30",
      "2024-01-15T10:30:00-08:00",
      "2024-01-15T24:00:00Z",
      "2024-01-15T10:30:00+14:00"
    ])("accepts %s", (lastmod) => {
      expectValid(validateLastmod(lastmod));
    });

    it.each([
      "01-15-2024",
      "2024-1-5",
      "2024",
      "2024-01",
      "2024-02-30",
      "2024-13-01",
      "1899-12-31",
      "2024-01-15T10:30:00",
      "2024-01-15T25:00:00Z",
      "2024-01-15T10:60:00Z",
      "2024-01-15T24:00:01Z",
      "2024-01-15T10:30:00+15:00",
      "2024-01-15T10:30:00+14:30",
      "2024-01-15 10:30:00Z",
      "2099-01-01"
    ])("rejects %s", (lastmod) => {
      expectIssues(validateLastmod(lastmod), [`Invalid lastmod "${lastmod}"`]);
    });

    describe("relative to the current time", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-15T23:00:00Z"));
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each([
        "2024-01-15",
        // Already 2024-01-16 in time zones east of UTC+1
        "2024-01-16",
        "2024-01-15T23:00:00Z",
        "2024-01-16T03:59:00+05:00",
        // Within the five-minute clock-skew tolerance
        "2024-01-15T23:04:00Z"
      ])("accepts %s", (lastmod) => {
        expectValid(validateLastmod(lastmod));
      });

      it.each(["2024-01-17", "2024-01-15T23:10:00Z", "2099-01-01T00:00:00Z"])(
        "rejects %s as being in the future",
        (lastmod) => {
          expectIssues(validateLastmod(lastmod), [
            `Invalid lastmod "${lastmod}"`
          ]);
        }
      );
    });
  });

  it("collects every issue, in order", () => {
    expectIssues(
      validateSitemap(
        untyped({
          origin: ORIGIN,
          urls: [{ path: "/", priority: 2, lastmod: "bad" }, { path: "/" }]
        })
      ),
      ["Priority 2", 'Invalid lastmod "bad"', "Duplicate URL"]
    );
  });
});
