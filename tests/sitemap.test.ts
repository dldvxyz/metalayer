import { describe, expect, it } from "vitest";
import { generateSitemap, validateSitemap } from "../src/sitemap.js";

describe("generateSitemap", () => {
  it("generates a sitemap with a single URL", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/" }]
    });
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).toContain("</urlset>");
  });

  it("includes optional fields", () => {
    const result = generateSitemap({
      urls: [
        {
          loc: "https://example.com/",
          lastmod: "2024-01-15",
          changefreq: "weekly",
          priority: 1.0
        }
      ]
    });
    expect(result).toContain("<lastmod>2024-01-15</lastmod>");
    expect(result).toContain("<changefreq>weekly</changefreq>");
    expect(result).toContain("<priority>1.0</priority>");
  });

  it("handles multiple URLs", () => {
    const result = generateSitemap({
      urls: [
        { loc: "https://example.com/" },
        { loc: "https://example.com/about" },
        { loc: "https://example.com/contact" }
      ]
    });
    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).toContain("<loc>https://example.com/about</loc>");
    expect(result).toContain("<loc>https://example.com/contact</loc>");
  });

  it("formats priority with one decimal place", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/", priority: 0.5 }]
    });
    expect(result).toContain("<priority>0.5</priority>");
  });

  it("produces compact output when pretty is false", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/" }],
      pretty: false
    });
    expect(result).not.toContain("\n\n");
    expect(result).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>'
    );
  });

  it("pretty-prints by default", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/" }]
    });
    expect(result).toContain("  <url>");
    expect(result).toContain("    <loc>");
  });

  it("includes the correct XML namespace", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/" }]
    });
    expect(result).toContain(
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    );
  });

  it("does not end with a trailing newline", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/" }]
    });
    expect(result.endsWith("\n")).toBe(false);
  });

  it("generates exact pretty output for a full URL entry", () => {
    const result = generateSitemap({
      urls: [
        {
          loc: "https://example.com/",
          lastmod: "2024-06-01",
          changefreq: "daily",
          priority: 0.8
        }
      ]
    });
    expect(result).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://example.com/</loc>",
        "    <lastmod>2024-06-01</lastmod>",
        "    <changefreq>daily</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
        "</urlset>"
      ].join("\n")
    );
  });

  it("generates multiple URLs with mixed optional fields", () => {
    const result = generateSitemap({
      urls: [
        { loc: "https://example.com/", priority: 1.0 },
        { loc: "https://example.com/about", lastmod: "2024-01-01" },
        { loc: "https://example.com/blog", changefreq: "weekly" }
      ]
    });
    expect(result).toContain("<priority>1.0</priority>");
    expect(result).toContain("<lastmod>2024-01-01</lastmod>");
    expect(result).toContain("<changefreq>weekly</changefreq>");
    // Each URL should have its own <url> block
    const urlCount = (result.match(/<url>/g) || []).length;
    expect(urlCount).toBe(3);
  });

  it("formats priority 0 as 0.0", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/", priority: 0 }]
    });
    expect(result).toContain("<priority>0.0</priority>");
  });

  it("formats priority 1 as 1.0", () => {
    const result = generateSitemap({
      urls: [{ loc: "https://example.com/", priority: 1 }]
    });
    expect(result).toContain("<priority>1.0</priority>");
  });
});

describe("validateSitemap", () => {
  // Valid cases

  it("returns valid for a single URL", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/" }]
    });
    expect(result.valid).toBe(true);
  });

  it("normalizes URLs in returned options", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com" }]
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.options.urls[0].loc).toBe("https://example.com/");
    }
  });

  it("accepts multiple URLs with the same origin", () => {
    const result = validateSitemap({
      urls: [
        { loc: "https://example.com/" },
        { loc: "https://example.com/about" }
      ]
    });
    expect(result.valid).toBe(true);
  });

  // URL validation

  it("rejects an invalid URL", () => {
    const result = validateSitemap({
      urls: [{ loc: "not-a-url" as any }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("not a valid URL");
    }
  });

  it("rejects URLs with different origins", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/" }, { loc: "https://other.com/" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("different origin");
    }
  });

  it("detects duplicate URLs", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/" }, { loc: "https://example.com/" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate URL");
    }
  });

  it("detects duplicates after normalization", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com" }, { loc: "https://example.com/" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Duplicate URL");
    }
  });

  // Priority validation

  it("rejects priority below 0", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/", priority: -0.1 }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("out of range");
    }
  });

  it("rejects priority above 1", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/", priority: 1.1 }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("out of range");
    }
  });

  it("accepts priority at boundaries 0 and 1", () => {
    const result = validateSitemap({
      urls: [
        { loc: "https://example.com/", priority: 0 },
        { loc: "https://example.com/page", priority: 1 }
      ]
    });
    expect(result.valid).toBe(true);
  });

  // Lastmod validation

  it("accepts a valid lastmod date", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/", lastmod: "2024-01-15" }]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects an invalid lastmod format", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/", lastmod: "01-15-2024" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid lastmod");
    }
  });

  it("rejects an impossible date", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/", lastmod: "2024-02-30" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid lastmod");
    }
  });

  it("rejects a date before 1900", () => {
    const result = validateSitemap({
      urls: [{ loc: "https://example.com/", lastmod: "1899-12-31" }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toContain("Invalid lastmod");
    }
  });

  // Multiple issues

  it("collects multiple issues", () => {
    const result = validateSitemap({
      urls: [{ loc: "not-valid" as any, priority: 2, lastmod: "bad" as any }]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});
