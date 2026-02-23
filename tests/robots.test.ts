import { describe, expect, it } from "vitest";
import { generateRobotsTxt, validateRobotsTxt } from "../src/robots.js";

describe("generateRobotsTxt", () => {
  it("generates a basic disallow-all robots.txt", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", disallow: "/" }]
    });
    expect(result).toBe("User-agent: *\nDisallow: /");
  });

  it("generates allow-all robots.txt", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }]
    });
    expect(result).toBe("User-agent: *\nAllow: /");
  });

  it("handles multiple rules with blank line separator", () => {
    const result = generateRobotsTxt({
      rules: [
        { userAgent: "Googlebot", allow: "/" },
        { userAgent: "Bingbot", disallow: "/private" }
      ]
    });
    expect(result).toBe(
      "User-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nDisallow: /private"
    );
  });

  it("handles multiple user agents in one rule", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: ["Googlebot", "Bingbot"], disallow: "/secret" }]
    });
    expect(result).toBe(
      "User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /secret"
    );
  });

  it("handles arrays of allow and disallow paths", () => {
    const result = generateRobotsTxt({
      rules: [
        {
          userAgent: "*",
          allow: ["/public", "/assets"],
          disallow: ["/admin", "/api"]
        }
      ]
    });
    expect(result).toBe(
      "User-agent: *\nAllow: /public\nAllow: /assets\nDisallow: /admin\nDisallow: /api"
    );
  });

  it("outputs allow before disallow", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/public", disallow: "/private" }]
    });
    const allowIndex = result.indexOf("Allow:");
    const disallowIndex = result.indexOf("Disallow:");
    expect(allowIndex).toBeLessThan(disallowIndex);
  });

  it("includes crawl-delay", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", disallow: "/", crawlDelay: 10 }]
    });
    expect(result).toBe("User-agent: *\nDisallow: /\nCrawl-delay: 10");
  });

  it("includes a single sitemap", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemaps: ["https://example.com/sitemap.xml"]
    });
    expect(result).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml"
    );
  });

  it("includes multiple sitemaps", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemaps: [
        "https://example.com/sitemap.xml",
        "https://example.com/sitemap-news.xml"
      ]
    });
    expect(result).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(result).toContain("Sitemap: https://example.com/sitemap-news.xml");
  });

  it("includes host directive", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      host: "example.com"
    });
    expect(result).toContain("Host: example.com");
  });

  it("includes host and sitemaps together", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemaps: ["https://example.com/sitemap.xml"],
      host: "example.com"
    });
    expect(result).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(result).toContain("Host: example.com");
  });

  it("handles both allow and disallow as single paths", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/yes", disallow: "/no" }]
    });
    expect(result).toBe("User-agent: *\nAllow: /yes\nDisallow: /no");
  });

  it("places sitemaps after rules", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemaps: ["https://example.com/sitemap.xml"]
    });
    expect(result).toBe(
      "User-agent: *\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml"
    );
  });

  it("places host after sitemaps", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemaps: ["https://example.com/sitemap.xml"],
      host: "example.com"
    });
    const sitemapIndex = result.indexOf("Sitemap:");
    const hostIndex = result.indexOf("Host:");
    expect(sitemapIndex).toBeLessThan(hostIndex);
  });

  it("outputs multiple sitemaps on separate lines", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemaps: [
        "https://example.com/sitemap.xml",
        "https://example.com/sitemap-news.xml"
      ]
    });
    expect(result).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/sitemap-news.xml"
    );
  });

  it("includes crawl-delay with allow and disallow paths", () => {
    const result = generateRobotsTxt({
      rules: [
        {
          userAgent: "*",
          allow: "/public",
          disallow: "/private",
          crawlDelay: 5
        }
      ]
    });
    expect(result).toBe(
      "User-agent: *\nAllow: /public\nDisallow: /private\nCrawl-delay: 5"
    );
  });

  it("combines all directives in one output", () => {
    const result = generateRobotsTxt({
      rules: [
        { userAgent: "*", allow: "/" },
        { userAgent: "GPTBot", disallow: "/" }
      ],
      sitemaps: ["https://example.com/sitemap.xml"],
      host: "example.com"
    });
    expect(result).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "",
        "User-agent: GPTBot",
        "Disallow: /",
        "",
        "Sitemap: https://example.com/sitemap.xml",
        "Host: example.com"
      ].join("\n")
    );
  });

  it("does not end with a trailing newline", () => {
    const result = generateRobotsTxt({
      rules: [{ userAgent: "*", disallow: "/" }]
    });
    expect(result.endsWith("\n")).toBe(false);
  });
});

describe("validateRobotsTxt", () => {
  it("returns valid for a correct config", () => {
    const result = validateRobotsTxt({
      rules: [{ userAgent: "*", disallow: "/" }]
    });
    expect(result).toEqual({
      valid: true,
      options: { rules: [{ userAgent: "*", disallow: "/" }] }
    });
  });

  it("returns valid for multiple rules with different agents", () => {
    const result = validateRobotsTxt({
      rules: [
        { userAgent: "Googlebot", allow: "/" },
        { userAgent: "Bingbot", disallow: "/private" }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("returns valid for * alongside specific agents in separate rules", () => {
    const result = validateRobotsTxt({
      rules: [
        { userAgent: "*", disallow: "/" },
        { userAgent: "Googlebot", allow: "/" }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("returns valid when allow and disallow have different paths", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: "*",
          allow: "/public",
          disallow: "/private"
        }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("returns the options back when valid", () => {
    const result = validateRobotsTxt({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemaps: ["https://example.com/sitemap.xml"],
      host: "example.com"
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.options.rules[0].userAgent).toBe("*");
      expect(result.options.sitemaps).toEqual([
        "https://example.com/sitemap.xml"
      ]);
      expect(result.options.host).toBe("example.com");
    }
  });

  // Wildcard mixed with specific agents in the same rule

  it("detects * mixed with a specific agent in the same rule", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: ["*", "Googlebot"],
          disallow: "/"
        }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("wildcard");
      expect(result.issues[0]).toContain("Googlebot");
    }
  });

  it("detects * mixed with multiple specific agents in the same rule", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: ["*", "Googlebot", "Bingbot"],
          disallow: "/"
        }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Googlebot");
      expect(result.issues[0]).toContain("Bingbot");
    }
  });

  // Duplicate user agents across rules

  it("detects duplicate user agents across rules", () => {
    const result = validateRobotsTxt({
      rules: [
        { userAgent: "Googlebot", allow: "/" },
        { userAgent: "Googlebot", disallow: "/private" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("Duplicate");
      expect(result.issues[0]).toContain("Googlebot");
    }
  });

  it("detects duplicate * across rules", () => {
    const result = validateRobotsTxt({
      rules: [
        { userAgent: "*", allow: "/" },
        { userAgent: "*", disallow: "/secret" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate");
      expect(result.issues[0]).toContain("*");
    }
  });

  it("detects duplicate agent when one is in an array", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: ["Googlebot", "Bingbot"],
          allow: "/"
        },
        { userAgent: "Googlebot", disallow: "/other" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate");
      expect(result.issues[0]).toContain("Googlebot");
    }
  });

  // Overlapping paths in allow and disallow

  it("detects the same path in allow and disallow", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: "*",
          allow: "/page",
          disallow: "/page"
        }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("/page");
      expect(result.issues[0]).toContain("Allow");
      expect(result.issues[0]).toContain("Disallow");
    }
  });

  it("detects multiple overlapping paths", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: "*",
          allow: ["/a", "/b", "/c"],
          disallow: ["/b", "/c", "/d"]
        }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("/b");
      expect(result.issues[0]).toContain("/c");
    }
  });

  it("does not flag non-overlapping array paths", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: "*",
          allow: ["/public", "/assets"],
          disallow: ["/admin", "/api"]
        }
      ]
    });
    expect(result.valid).toBe(true);
  });

  // Multiple issues at once

  it("collects multiple issues from different rules", () => {
    const result = validateRobotsTxt({
      rules: [
        {
          userAgent: ["*", "Googlebot"],
          allow: "/page",
          disallow: "/page"
        },
        { userAgent: "Googlebot", disallow: "/" }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // wildcard mixed + overlapping path + duplicate Googlebot = 3 issues
      expect(result.issues).toHaveLength(3);
    }
  });
});
