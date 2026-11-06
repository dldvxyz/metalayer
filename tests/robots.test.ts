import { describe, expect, it } from "vitest";

import type { RobotsOptions } from "../src/index.js";
import { generateRobotsTxt, validateRobotsTxt } from "../src/index.js";
import { expectIssues, expectValid, untyped } from "./helpers.js";

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
      name: "product tokens with digits",
      options: { rules: [{ userAgent: ["360Spider"], disallow: ["/"] }] }
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
            allow: ["/products", "/A", "/a/"],
            disallow: ["/products?", "/a", "/*"]
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
        ['wildcard "*" mixed with specific user agents: Googlebot, Bingbot']
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
      ["/a\nAllow: /", "control character"],
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
        validateRobotsTxt(untyped({ rules: [{ userAgent: ["*"] }] })),
        ["has neither Allow nor Disallow paths"]
      );
    });

    it("rejects an empty rules array", () => {
      expectIssues(validateRobotsTxt(untyped({ rules: [] })), [
        "At least one rule is required"
      ]);
    });
  });

  describe("allow/disallow overlap", () => {
    it("lists every pattern that appears in both lists", () => {
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
        ['Path(s) "/b", "/c" appear in both Allow and Disallow']
      );
    });

    it.each([
      ["/café", "/caf%C3%A9"],
      ["/%7Ejoe", "/~joe"],
      ["/a%2fb", "/a%2Fb"],
      ["/page", "/page"]
    ] as const)("treats %j and %j as the same pattern", (allow, disallow) => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*"], allow: [allow], disallow: [disallow] }]
        }),
        ["appear in both Allow and Disallow"]
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
      "not-a-url",
      "ftp://example.com/sitemap.xml",
      "https://example.com//sitemap.xml"
    ])("rejects %j", (sitemap) => {
      expectIssues(
        validateRobotsTxt(
          untyped({
            rules: [{ userAgent: ["*"], allow: ["/"] }],
            sitemaps: [sitemap]
          })
        ),
        [`Sitemap URL "${sitemap}" is not a valid absolute URL`]
      );
    });

    it("rejects duplicate sitemap URLs after normalization", () => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*"], allow: ["/"] }],
          sitemaps: [
            "https://example.com/sitemap.xml",
            "https://EXAMPLE.com/sitemap.xml"
          ]
        }),
        ['Duplicate sitemap URL "https://example.com/sitemap.xml"']
      );
    });
  });

  describe("host", () => {
    it.each([
      "example.com",
      "https://example.com",
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
      ""
    ])("rejects %j", (host) => {
      expectIssues(
        validateRobotsTxt({
          rules: [{ userAgent: ["*"], allow: ["/"] }],
          host
        }),
        [`Host "${host}" is not a valid hostname`]
      );
    });
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
        'wildcard "*" mixed',
        "appear in both Allow and Disallow",
        'Duplicate user agent "Googlebot"'
      ]
    );
  });
});
