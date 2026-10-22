/**
 * Endpoint manifest — THE file to edit when a data source changes.
 *
 * One entry per consumable data source. Loaders never hardcode where data
 * comes from anymore: they read this object through `resolveLocal()` /
 * `resolveResource()` (the remote resolver lives in `menu.service.js`).
 *
 * Per-entry fields:
 *
 * - `enabled`   — `false` skips the source entirely and yields `fallback`.
 * - `mode`      — how to consume it:
 *                 - `'auto'`   → local fixture by default; remote endpoint
 *                                when `PUBLIC_DATA_MODE=api` is set;
 *                 - `'local'`  → always the fixture (no endpoint exists yet);
 *                 - `'remote'` → always the endpoint (ignores the env flag).
 * - `fixture`   — JSON file name under `src/data/api/` (`null` → no local origin).
 * - `resource`  — name on the Google Apps Script API (`null` → local-only).
 * - `schema`    — Zod contract every resolved payload must satisfy
 *                 (`null` → not held to the v2 contract, e.g. raw v1 input).
 *                 NOTE: parse failures throw and fail the build; they are
 *                 never converted into `fallback`.
 * - `fallback`  — value returned on TRANSPORT failure only (missing fixture
 *                 file or network error). When a loader parses its local
 *                 path, the fallback must satisfy the entry's schema.
 *
 * To add a new source: drop the JSON in `src/data/api/`, add its schema to
 * `src/storefront/schemas/`, declare the entry here, then call
 * `resolveLocal('<key>')` from your loader.
 */
import {
  combosFileSchema,
  decorationsFileSchema,
  enlacesFileSchema,
  flyersFileSchema,
  galleryFileSchema,
  landingFileSchema,
  menuFileSchema,
  promotionsFileSchema,
  settingsFileSchema,
  parseFixture,
} from '../schemas';

export const ENDPOINTS = {
  // Remote-capable (mode 'auto' → fixture locally, GAS endpoint in api mode).
  menu: {
    enabled: true,
    mode: 'auto',
    fixture: 'menu.json',
    resource: 'menu',
    schema: menuFileSchema,
    fallback: { data: { blocks: [] } },
  },
  /** Raw v1 price ranges — TEMP join input for the menu adapter, no v2 schema. */
  priceRanges: {
    enabled: true,
    mode: 'auto',
    fixture: null,
    resource: 'price-range',
    schema: null,
    fallback: { data: [] },
  },
  settings: {
    enabled: true,
    mode: 'auto',
    fixture: 'settings.json',
    resource: 'settings',
    schema: settingsFileSchema,
    fallback: null,
  },
  combos: {
    enabled: true,
    mode: 'auto',
    fixture: 'combos.json',
    resource: 'combos',
    schema: combosFileSchema,
    fallback: { data: [] },
  },
  promotions: {
    enabled: true,
    mode: 'auto',
    fixture: 'promotions.json',
    resource: 'promotions',
    schema: promotionsFileSchema,
    fallback: { data: [] },
  },

  // Local-only for now (mode 'local' → the fixture, no endpoint declared).
  decorations: {
    enabled: true,
    mode: 'local',
    fixture: 'decorations.json',
    resource: null,
    schema: decorationsFileSchema,
    fallback: {
      background: 'https://picsum.photos/seed/menu-bg/400/400',
      header_background: null,
      footer_background: null,
      blocks: {},
    },
  },
  flyers: {
    enabled: true,
    mode: 'local',
    fixture: 'flyers.json',
    resource: null,
    schema: flyersFileSchema,
    // Kept exactly as the historical catch-default (no show_once_per_session).
    fallback: { enabled: false, delay_seconds: 20, items: [] },
  },
  gallery: {
    enabled: true,
    mode: 'local',
    fixture: 'gallery.json',
    resource: null,
    schema: galleryFileSchema,
    fallback: { data: [] },
  },
  landing: {
    enabled: true,
    mode: 'local',
    fixture: 'landing.json',
    resource: null,
    schema: landingFileSchema,
    fallback: { meta: {}, blocks: [] },
  },
  enlaces: {
    enabled: true,
    mode: 'local',
    fixture: 'enlaces.json',
    resource: null,
    schema: enlacesFileSchema,
    fallback: { meta: { title: '', tagline: '', logo_url: null, theme: 'dark' }, blocks: [] },
  },
};

// All fixtures, bundled at build time (the storefront is statically rendered —
// these never reach the client bundle).
const fixtureModules = import.meta.glob('/src/data/api/*.json', {
  eager: true,
  import: 'default',
});

/**
 * Raw JSON for `fixture`, or `null` when the file is not in the project
 * (transport failure — the caller decides on its fallback).
 *
 * @param {string | null} fixture
 * @returns {unknown | null}
 */
export function loadFixture(fixture) {
  if (!fixture) return null;
  return fixtureModules[`/src/data/api/${fixture}`] ?? null;
}

/**
 * Resolve a local-only entry: disabled / missing file → `fallback`,
 * otherwise the schema-validated fixture (a violation THROWS — it is a
 * contract failure, not a transport failure).
 *
 * @param {keyof typeof ENDPOINTS} name
 * @returns {any} parsed fixture or the entry's fallback
 */
export function resolveLocal(name) {
  const entry = ENDPOINTS[name];
  if (!entry.enabled) return entry.fallback;

  const raw = loadFixture(entry.fixture);
  if (!raw) return entry.fallback;

  return parseFixture(entry.fixture, entry.schema, raw);
}
