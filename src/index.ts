/**
 * Public API for metalayer.
 *
 * Re-exports all validate/generate functions and their associated types.
 *
 * @module
 */

export { generateManifest } from "./manifest/generate.js";
export type * from "./manifest/types.js";
export { validateManifest } from "./manifest/validate.js";
export { generateRobotsTxt } from "./robots/generate.js";
export type * from "./robots/types.js";
export { validateRobotsTxt } from "./robots/validate.js";
export type * from "./shared/types.js";
export { generateSitemap } from "./sitemap/generate.js";
export type * from "./sitemap/types.js";
export { validateSitemap } from "./sitemap/validate.js";
