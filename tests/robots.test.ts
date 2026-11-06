import { describe, expect, it } from "vitest";

import type { NonEmptyArray, RobotsOptions, RobotsPath } from "../src/index.js";
import { generateRobotsTxt, validateRobotsTxt } from "../src/index.js";
import { expectIssues, expectValid, untyped } from "./helpers.js";

const LINE_SEPARATOR = String.fromCodePoint(0x20_28);
const PARAGRAPH_SEPARATOR = String.fromCodePoint(0x20_29);
const NEXT_LINE = String.fromCodePoint(0x85);
const LONE_SURROGATE = String.fromCodePoint(0xd8_00);

/** Builds the given number of distinct disallow patterns of roughly `length` characters. */
function patterns(count: number, length: number): NonEmptyArray<RobotsPath> {
  const pad = "x".repeat(length);
  return [
    `/p/0/${pad}`,
    ...Array.from(
      { length: count - 1 },
      (_, index): RobotsPath => `/p/${index + 1}/${pad}`
    )
  ];
}

describe(generateRobotsTxt, () => {
  it.each<{ name: string; options: RobotsOptions; expected: string }>([
    {
      name: "a disallow-all group",
      options: { rules: [{ userAgent: ["*"], disallow: ["/"] }] },
      expected: "User-agent: *\nDisallow: /\n"
    },
    {
      name: "an allow-all group",
      options: { rules: [{ userAgent: ["*"], allow: ["/"] }] },
      expected: "User-agent: *\nAllow: /\n"
    },
    {
      name: "groups separated by a blank line",
      options: {
        rules: [
          { userAgent: ["Googlebot"], allow: ["/"] },
          { userAgent: ["Bingbot"], disallow: ["/private"] }
        ]
      },
      expected:
        "User-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nDisallow: /private\n"
    },
    {
      name: "several user agents in one group",
      options: {
        rules: [{ userAgent: ["Googlebot", "Bingbot"], disallow: ["/secret"] }]
      },
      expected:
        "User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /secret\n"
    },
    {
      name: "allow before disallow, keeping array order, then crawl-delay",
      options: {
        rules: [
          {
            userAgent: ["*"],
            allow: ["/public", "/assets"],
            disallow: ["/admin", "/api"],
            crawlDelay: 5
          }
        ]
      },
      expected:
        "User-agent: *\nAllow: /public\nAllow: /assets\nDisallow: /admin\nDisallow: /api\nCrawl-delay: 5\n"
    },
    {
      name: "wildcard and end-anchor patterns verbatim",
      options: {
        rules: [{ userAgent: ["*"], disallow: ["/*.php$", "/fish*", "/*//"] }]
      },
      expected:
        "User-agent: *\nDisallow: /*.php$\nDisallow: /fish*\nDisallow: /*//\n"
    },
    {
      name: "normalized sitemaps after the groups, one per line",
      options: {
        rules: [{ userAgent: ["*"], disallow: ["/"] }],
        sitemaps: ["https://example.com/sitemap.xml", "https://hello.world"]
      },
      expected:
        "User-agent: *\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml\nSitemap: https://hello.world/\n"
    },
    {
      name: "the host directive last",
      options: {
        rules: [
          { userAgent: ["*"], allow: ["/"] },
          { userAgent: ["GPTBot"], disallow: ["/"] }
        ],
        sitemaps: ["https://example.com/sitemap.xml"],
        host: "example.com"
      },
      expected: [
        "User-agent: *",
        "Allow: /",
        "",
        "User-agent: GPTBot",
        "Disallow: /",
        "",
        "Sitemap: https://example.com/sitemap.xml",
        "Host: example.com",
        ""
      ].join("\n")
    },
    {
      name: "no host directive for an empty host",
      options: { rules: [{ userAgent: ["*"], allow: ["/"] }], host: "" },
      expected: "User-agent: *\nAllow: /\n"
    }
  ])("generates $name", ({ options, expected }) => {
    expect(generateRobotsTxt(options)).toBe(expected);
  });

  it.each([
    ["HTTPS://Example.COM:8080", "Host: https://example.com:8080"],
    ["москва.рф", "Host: xn--80adxhks.xn--p1ai"]
  ])("writes the host %j in canonical form", (host, line) => {
    expect(
      generateRobotsTxt({ rules: [{ userAgent: ["*"], allow: ["/"] }], host })
    ).toContain(`${line}\n`);
  });

  it("percent-encodes line breaks so unvalidated values cannot add directives", () => {
    const output = generateRobotsTxt(
      untyped({
        rules: [
          {
            userAgent: ["x\nUser-agent: *"],
            disallow: [`/a\nAllow: /`, `/b${LINE_SEPARATOR}c`]
          }
        ],
        sitemaps: ["https://example.com/sitemap.xml\nDisallow: /"]
      })
    );
    expect(output).toBe(
      [
        "User-agent: x%0AUser-agent: *",
        "Disallow: /a%0AAllow: /",
        "Disallow: /b%E2%80%A8c",
        "",
        "Sitemap: https://example.com/sitemap.xml%0ADisallow: /",
        ""
      ].join("\n")
    );
  });

  it("accepts readonly input and does not mutate it", () => {
    const options = {
      rules: [{ userAgent: ["*"], allow: ["/a"], disallow: ["/b"] }],
      sitemaps: ["https://example.com/sitemap.xml"]
    } as const;
    const snapshot = structuredClone(options);
    generateRobotsTxt(options);
    expect(options).toStrictEqual(snapshot);
  });
});

describe(validateRobotsTxt, () => {
  it("returns the options when valid", () => {
    const options = {
      rules: [{ userAgent: ["*"], allow: ["/"] }],
      sitemaps: ["https://example.com/sitemap.xml"],
      host: "example.com"
    } as const;
    expect(validateRobotsTxt(options)).toStrictEqual({ valid: true, options });
  });

  it.each<{ name: string; options: RobotsOptions }>([
    {
      name: "the README example",
      options: {
        rules: [
          { userAgent: ["*"], allow: ["/"] },
          { userAgent: ["GPTBot"], disallow: ["/"] }
        ],
        sitemaps: ["https://example.com/sitemap.xml"]
      }
    },
    {
      name: "* alongside specific agents in separate rules",
      options: {
        rules: [
          { userAgent: ["*"], disallow: ["/"] },
          { userAgent: ["Googlebot"], allow: ["/"] }
        ]
      }
    },
    {
      name: "product tokens with digits and dots",
      options: {
        rules: [
          {
            userAgent: ["360Spider", "archive.org_bot", "Mail.RU_Bot"],
            disallow: ["/"]
          }
        ]
      }
    },
    {
      name: "wildcard, end-anchor and consecutive-slash patterns",
      options: {
        rules: [
          {
            userAgent: ["*"],
            allow: ["/public/", "/*.css$"],
            disallow: ["/private/", "/fish*", "/*//", "/a$"]
          }
        ]
      }
    },
    {
      name: "patterns that differ for a crawler",
      options: {
        rules: [
          {
            userAgent: ["*"],
            allow: [
              "/products",
              "/A",
              "/a/",
              "/a%2Ab",
              "/a%24",
              "/a%2Fb",
              "/a%3Fb"
            ],
            disallow: ["/products?", "/a", "/*", "/a*b", "/a$", "/a/b", "/a?b"]
          }
        ]
      }
    },
    {
      name: "a positive integer crawl delay",
      options: {
        rules: [{ userAgent: ["*"], disallow: ["/"], crawlDelay: 10 }]
      }
    },
    {
      name: "sitemaps on different hosts and trailing-slash variants",
      options: {
        rules: [{ userAgent: ["*"], allow: ["/"] }],
        sitemaps: [
          "https://example.com/sitemap.xml",
          "https://example.com/sitemap.xml/",
          "https://www.example.com/sitemap.xml",
          "https://sitemaps.example.net/host1.xml"
        ]
      }
    },
    {
      name: "an empty host, which is treated as absent",
      options: { rules: [{ userAgent: ["*"], allow: ["/"] }], host: "" }
    }
  ])("accepts $name", ({ options }) => {
    expectValid(validateRobotsTxt(options));
  });

  describe("user agents", () => {
    it("rejects * mixed with specific agents in the same rule", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*", "Googlebot", "Bingbot"], disallow: ["/"] }]
        }),
        [
          'The rule for user agent *, Googlebot, Bingbot mixes the wildcard "*" with specific user agents (Googlebot, Bingbot)'
        ]
      );
    });

    it("reports ['*', '*'] as a repeated agent, not as wildcard mixing", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*", "*"], disallow: ["/"] }]
        }),
        ['User agent "*" is listed twice in the same rule']
      );
    });

    it("rejects duplicate user agents across rules, case-insensitively", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [
            { userAgent: ["Googlebot", "Bingbot"], allow: ["/"] },
            { userAgent: ["googlebot"], disallow: ["/other"] }
          ]
        }),
        ['Duplicate user agent "googlebot" found across multiple rules']
      );
    });

    it.each([
      ["Mozilla/5.0", "is not a valid product token"],
      ["Yahoo! Slurp", "is not a valid product token"],
      ["Google bot", "is not a valid product token"],
      [" Googlebot", "is not a valid product token"],
      ["x\nUser-agent: *", "is not a valid product token"],
      ["", "is empty"]
    ])("rejects the user agent %j", (agent, problem) => {
      expectIssues(
        validateRobotsTxt({ rules: [{ userAgent: [agent], disallow: ["/"] }] }),
        [`User agent ${JSON.stringify(agent)} ${problem}`]
      );
    });

    it("rejects a rule without user agents", () => {
      expectIssues(
        validateRobotsTxt(
          untyped({ rules: [{ userAgent: [], disallow: ["/"] }] })
        ),
        ["Rule #1 has no user agents"]
      );
    });
  });

  describe("paths", () => {
    it.each([
      ["/a#b", "%23"],
      ["/my page", "%20"],
      ["/a$b", "%24"],
      ["/a\nAllow: /", "control character or line break"],
      [`/a${LINE_SEPARATOR}Allow: /`, "control character or line break"],
      [`/a${PARAGRAPH_SEPARATOR}b`, "control character or line break"],
      [`/a${NEXT_LINE}b`, "control character or line break"],
      [`/caf${LONE_SURROGATE}`, "unpaired surrogate"],
      ["admin", 'must start with "/"']
    ])("rejects the pattern %j", (path, problem) => {
      expectIssues(
        validateRobotsTxt(
          untyped({ rules: [{ userAgent: ["*"], disallow: [path] }] })
        ),
        [`Disallow path ${JSON.stringify(path)} for user agent *`]
      );
      expectIssues(
        validateRobotsTxt(
          untyped({ rules: [{ userAgent: ["*"], allow: [path] }] })
        ),
        [problem]
      );
    });

    it("rejects a rule with neither allow nor disallow", () => {
      expectIssues(
        validateRobotsTxt(
          untyped({ rules: [{ userAgent: ["Bingbot"], crawlDelay: 10 }] })
        ),
        [
          'The rule for user agent Bingbot has neither Allow nor Disallow paths. Crawlers merge a group without rules into the next group; use allow: ["/"]'
        ]
      );
    });

    it("names a rule by position when it has no user agents", () => {
      expectIssues(validateRobotsTxt(untyped({ rules: [{ userAgent: [] }] })), [
        "Rule #1 has no user agents",
        "Rule #1 has neither Allow nor Disallow paths"
      ]);
    });

    it("rejects an empty rules array", () => {
      expectIssues(validateRobotsTxt(untyped({ rules: [] })), [
        "At least one rule is required"
      ]);
    });
  });

  describe("allow/disallow overlap", () => {
    it("reports every pattern that appears in both lists", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [
            {
              userAgent: ["*"],
              allow: ["/a", "/b", "/c"],
              disallow: ["/b", "/c", "/d"]
            }
          ]
        }),
        [
          'Path "/b" appears in both Allow and Disallow for user agent *',
          'Path "/c" appears in both Allow and Disallow for user agent *'
        ]
      );
    });

    it.each([
      ["/café", "/caf%C3%A9"],
      ["/%7Ejoe", "/~joe"],
      ["/a%2fb", "/a%2Fb"]
    ] as const)("treats %j and %j as the same pattern", (allow, disallow) => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*"], allow: [allow], disallow: [disallow] }]
        }),
        [
          `Allow ${JSON.stringify(allow)} and Disallow ${JSON.stringify(disallow)} are the same pattern`
        ]
      );
    });

    it("compares malformed escapes verbatim", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [
            {
              userAgent: ["*"],
              allow: ["/a%", "/b%2"],
              disallow: ["/a%", "/b%2"]
            }
          ]
        }),
        ['Path "/a%" appears in both', 'Path "/b%2" appears in both']
      );
    });
  });

  describe("crawl delay", () => {
    it.each([0, -1, 0.5, Number.POSITIVE_INFINITY, Number.NaN])(
      "rejects %d",
      (crawlDelay) => {
        expectIssues(
          validateRobotsTxt({
            rules: [{ userAgent: ["*"], disallow: ["/"], crawlDelay }]
          }),
          ["must be a positive integer number of seconds"]
        );
      }
    );
  });

  describe("sitemaps", () => {
    it.each([
      ["not-a-url", "is not a valid URL"],
      ["ftp://example.com/sitemap.xml", "must use http or https"],
      ["https://example.com//sitemap.xml", 'has "//" in its path'],
      [
        "https://user:pass@example.com/sitemap.xml",
        "must not contain credentials"
      ],
      [
        "https://example.com/sitemap.xml#a",
        'contains "#", which starts a comment'
      ],
      [
        "https://example.com/sitemap.xml\nDisallow: /",
        "contains a control character"
      ]
    ])("rejects %j", (sitemap, problem) => {
      expectIssues(
        validateRobotsTxt(
          untyped({
            rules: [{ userAgent: ["*"], allow: ["/"] }],
            sitemaps: [sitemap]
          })
        ),
        [`Sitemap URL ${JSON.stringify(sitemap)} ${problem}`]
      );
    });

    it("rejects duplicate sitemap URLs after normalization", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*"], allow: ["/"] }],
          sitemaps: [
            "https://example.com/sitemap.xml",
            "https://EXAMPLE.com/sitemap.xml",
            "https://example.com/caf%c3%a9.xml",
            "https://example.com/café.xml"
          ]
        }),
        [
          'Duplicate sitemap URL "https://example.com/sitemap.xml"',
          'Duplicate sitemap URL "https://example.com/caf%C3%A9.xml"'
        ]
      );
    });
  });

  describe("host", () => {
    it.each([
      "example.com",
      "https://example.com",
      "HTTPS://Example.COM",
      "http://example.com",
      "example.com.",
      "example.xn--p1ai",
      "москва.рф",
      "example.com:8080"
    ])("accepts %j", (host) => {
      expectValid(
        validateRobotsTxt({ rules: [{ userAgent: ["*"], allow: ["/"] }], host })
      );
    });

    it.each([
      "example.com/",
      "example.com/path",
      "https://example.com/?q=1",
      "user:pass@example.com",
      "exa mple.com",
      "example.com#",
      "example.com?",
      "//example.com",
      "*.example.com",
      "a..b.com",
      "-x-.com",
      "localhost",
      "127.0.0.1",
      "[::1]",
      "example.com:99999",
      "example.com\nCrawl-delay: 9"
    ])("rejects %j", (host) => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*"], allow: ["/"] }],
          host
        }),
        [`Host ${JSON.stringify(host)} is not a valid hostname`]
      );
    });
  });

  it("rejects a file larger than the 500 KiB Google reads", () => {
    expectIssues(
      validateRobotsTxt({
        rules: [{ userAgent: ["*"], disallow: patterns(20_000, 20) }]
      }),
      ["Google ignores everything after 512000 bytes (500 KiB)"]
    );
  });

  it("collects every issue, in order", () => {
    expectIssues(
      validateRobotsTxt({
        rules: [
          {
            userAgent: ["*", "Googlebot"],
            allow: ["/page"],
            disallow: ["/page"]
          },
          { userAgent: ["Googlebot"], disallow: ["/"] }
        ]
      }),
      [
        'mixes the wildcard "*"',
        'Path "/page" appears in both Allow and Disallow',
        'Duplicate user agent "Googlebot"'
      ]
    );
  });
});
