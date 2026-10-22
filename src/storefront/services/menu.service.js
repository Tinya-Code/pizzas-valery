import { api } from './api.js';
import { parseFixture } from '../schemas';
import { ENDPOINTS, loadFixture, resolveLocal } from '../data/endpoints.js';

// ─── Data mode ────────────────────────────────────────────────────────────────
// `local` (default): reads v2 JSON fixtures from `src/data/api/`.
// `api`            : fetches from the live GAS endpoint.
//
// Set PUBLIC_DATA_MODE=api in .env (or host env) to enable the remote API.
// No env var → local mode, so the app works out of the box without config.
/** @type {boolean} */
const IS_LOCAL = import.meta.env.PUBLIC_DATA_MODE !== 'api';

// ─── v1 → v2 adapters (TEMP) ─────────────────────────────────────────────────
// Delete these when GAS emits the v2 payload (doc/proposal-api-v2.md §5).

/** Site name fallback — replaced at runtime by `settings.name`. */
const SITE_NAME_FALLBACK = 'Restaurante';

/** Spanish weekday name → ISO key used by v2 `business_hours`. */
const DAY_KEY_MAP = {
  lunes: 'mon',
  martes: 'tue',
  miercoles: 'wed',
  jueves: 'thu',
  viernes: 'fri',
  sabado: 'sat',
  domingo: 'sun',
};

/** Minimal structural SEO defaults — all project strings live in settings.json. */
const SEO_DEFAULTS = {
  site_name: '',
  title: '',
  title_template: '%s',
  description: '',
  keywords: [],
  og_image: null,
  twitter_card: 'summary_large_image',
  locale: 'es',
  canonical_url: null,
  json_ld: { '@type': 'Restaurant' },
};

/**
 * Look up a price range by id (tolerant string comparison).
 * @param {Array<{ id: any }>} priceRanges
 * @param {string | number | null | undefined} priceRangeId
 * @returns {any | null}
 */
function findPriceRange(priceRanges, priceRangeId) {
  if (priceRangeId == null || priceRangeId === '') return null;
  const id = String(priceRangeId).trim();
  return priceRanges.find((r) => String(r.id).trim() === id) ?? null;
}

/**
 * One v1 menu product → the self-contained v2 shape.
 * @param {any} raw
 * @param {any[]} priceRanges
 * @returns {import('../types/menu.js').MenuProduct}
 */
function toV2Product(raw, priceRanges) {
  const matched = findPriceRange(priceRanges, raw?.price_range_id);
  const entries = (matched?.entries ?? []).map((e) => ({
    qty: Number(e.qty),
    price: Number(e.price),
    ...(e.bonus ? { bonus: e.bonus } : {}),
    ...(e.label ? { label: String(e.label) } : {}),
  }));

  const priceRange =
    entries.length > 0
      ? {
          id: matched.id,
          name: matched.name,
          entries,
          ...(matched.units_label
            ? {
                units_label: {
                  one: String(matched.units_label.one),
                  other: String(matched.units_label.other),
                },
              }
            : {}),
          min_price: Math.min(...entries.map((e) => e.price)),
          max_price: Math.max(...entries.map((e) => e.price)),
        }
      : null;

  const siteName = raw._siteName ?? SITE_NAME_FALLBACK;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    image: {
      url: raw.image_url ?? '',
      alt: `${raw.name} — ${siteName}`,
      ...(raw.cloudinary_id ? { cloudinary_id: raw.cloudinary_id } : {}),
    },
    price: priceRange ? priceRange.min_price : Number(raw.price) || 0,
    price_range: priceRange,
    qty_label: raw.qty_label ? String(raw.qty_label) : null,
    is_recommended: Boolean(raw.is_recommended),
    is_hidden: Boolean(raw.is_hidden),
    category_id: raw.category_id ?? '',
  };
}

/** @param {any} raw @returns {import('../types/menu.js').Combo} */
function toV2Combo(raw, siteName = SITE_NAME_FALLBACK) {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    image: { url: raw.url ?? '', alt: `${raw.name} — ${siteName}` },
    price: Number(raw.price),
    price_before: null,
  };
}

/** @param {any} raw @returns {import('../types/menu.js').Promotion} */
function toV2Promotion(raw, siteName = SITE_NAME_FALLBACK) {
  const hasDiscount =
    raw?.discountedPrice !== null &&
    raw?.discountedPrice !== undefined &&
    raw?.discountedPrice !== '';

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    image: { url: raw.url ?? '', alt: `${raw.name} — ${siteName}` },
    price: hasDiscount ? Number(raw.discountedPrice) : Number(raw.price),
    price_before: hasDiscount ? Number(raw.price) : null,
    valid_until: null,
  };
}

/**
 * Normalize v1 flat settings → v2 nested shape.
 * @param {any} payload
 * @returns {import('../types/menu.js').RestaurantInfo}
 */
function toV2Settings(payload) {
  const nonEmpty = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

  const business_hours = {};
  for (const [key, value] of Object.entries(payload.business_hours ?? {})) {
    const isoKey = DAY_KEY_MAP[String(key).toLowerCase()];
    if (!isoKey) continue;
    business_hours[isoKey] = {
      isOpen: value?.isOpen === true,
      open: String(value?.open ?? ''),
      close: String(value?.close ?? ''),
    };
  }

  return {
    data: {
      id: payload.id,
      name: payload.restaurant_name,
      slug: payload.restaurant_slug,
      phone: String(payload.restaurant_phone ?? ''),
      address: payload.restaurant_address ?? '',
      geo: {
        lat: Number(payload.location_lat),
        lng: Number(payload.location_lng),
      },
      whatsapp: {
        number: String(payload.whatsapp_number ?? ''),
        message_template: payload.whatsapp_message ?? null,
      },
      timezone: 'America/Lima',
      currency: 'PEN',
      language: 'es',
      delivery: {
        enabled: payload.delivery_enabled === 'Activo',
        fee: Number(payload.delivery_fee),
        zones: Array.isArray(payload.delivery_zones) ? payload.delivery_zones : [],
      },
      payment_methods: Array.isArray(payload.payment_methods) ? payload.payment_methods : [],
      max_order_quantity: Number(payload.max_order_quantity),
      social_media: {
        tiktok: nonEmpty(payload.tiktok),
        facebook: nonEmpty(payload.facebook),
        instagram: nonEmpty(payload.instagram),
      },
      google_maps: null,
      business_hours,
      logo_url: nonEmpty(payload.logo_url),
      header_bg: null,
      footer_bg: null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      seo: { ...SEO_DEFAULTS },
    },
  };
}

// ─── Resource resolver ────────────────────────────────────────────────────────

/**
 * Local fixture or remote endpoint for this entry?
 * (Single source of truth, mirrored by `resolveResource`.)
 * @param {(typeof ENDPOINTS)[keyof typeof ENDPOINTS]} entry
 */
function isLocalEntry(entry) {
  return entry.mode === 'local' || (entry.mode === 'auto' && IS_LOCAL);
}

/**
 * Resolve one resource per the endpoint manifest: local fixture when the
 * entry's mode says so, otherwise the remote GAS endpoint. Transport failure
 * (missing fixture file / network error) → the entry's fallback; schema
 * violations are thrown by the caller's `parseFixture`, never here.
 *
 * @param {keyof typeof ENDPOINTS} name
 * @returns {Promise<any>}
 */
async function resolveResource(name) {
  const entry = ENDPOINTS[name];
  if (!entry.enabled) return entry.fallback;

  if (isLocalEntry(entry)) return loadFixture(entry.fixture) ?? entry.fallback;
  if (!entry.resource) return entry.fallback;

  try {
    return await api.with('json', entry.resource).get();
  } catch (error) {
    console.warn(`[MenuService] "${name}" request failed, using fallback.`, error);
    return entry.fallback;
  }
}

// ─── Price ranges (v1 adapter only) ─────────────────────────────────────────

/** @type {Promise<{ data: any[] }> | null} */
let priceRangesPromise = null;

/**
 * Price ranges — only the v1 adapter uses this (join inside `getMenu`).
 * @returns {Promise<{ data: any[] }>}
 */
function getPriceRanges() {
  if (!priceRangesPromise) {
    priceRangesPromise = resolveResource('priceRanges').then((response) => {
      if (!Array.isArray(response?.data)) {
        console.warn('[MenuService] price-ranges payload missing "data" array.', response);
      }
      return response;
    });
  }
  return priceRangesPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Menu blocks with normalised v2 products.
 * @returns {Promise<{ blocks: any[] }>}
 */
export async function getMenu() {
  const entry = ENDPOINTS.menu;
  const response = await resolveResource('menu');

  if (isLocalEntry(entry)) {
    // Contract check on the raw fixture — before normalisation, so a missing
    // `products` array fails the build instead of being silently filled.
    const file = parseFixture(entry.fixture, entry.schema, response);
    const blocks = file.data.blocks;

    return {
      blocks: blocks.map((block) => ({
        ...block,
        categories: (block.categories ?? []).map((cat) => ({
          ...cat,
          products: cat.products ?? [],
        })),
      })),
    };
  }

  const blocks = Array.isArray(response?.data?.blocks) ? response.data.blocks : [];

  // TEMP: v1→v2 adapter
  const rangesResponse = await getPriceRanges();
  const priceRanges = Array.isArray(rangesResponse?.data) ? rangesResponse.data : [];

  // Contract check on the adapter output — wrapped into the file shape so the
  // ONE `menu.json` schema validates both origins (network fallback parses as []).
  return parseFixture('menu.json (v2 output)', entry.schema, {
    data: {
      blocks: blocks.map((block) => ({
        ...block,
        categories: (block.categories ?? []).map((cat) => ({
          ...cat,
          products: (cat.products ?? []).map((p) => toV2Product(p, priceRanges)),
        })),
      })),
    },
  });
}

/**
 * Restaurant profile + settings as the v2 payload (`{ data: <settings> }`).
 * @returns {Promise<import('../types/menu.js').RestaurantInfo | null>}
 */
export async function getRestaurantInfo() {
  const entry = ENDPOINTS.settings;
  const response = await resolveResource('settings');
  if (!response) return null;

  // Local fixture is already v2 — parse it as-is.
  if (isLocalEntry(entry)) return parseFixture(entry.fixture, entry.schema, response);

  // Remote v1 payload: adapt only if it has the v1 sentinel key.
  const payload = response?.data;
  if (payload?.restaurant_name) {
    return parseFixture('settings.json (v2 output)', entry.schema, toV2Settings(payload));
  }

  // Remote payload already v2-shaped — hold it to the same contract.
  return parseFixture('settings.json (v2 output)', entry.schema, response);
}

/**
 * Ready-to-render decorations — always the local fixture (manifest mode
 * `'local'`; no remote endpoint exists yet).
 * @returns {Promise<import('../types/menu.js').Decorations>}
 */
export async function getDecorations() {
  return resolveLocal('decorations');
}

/**
 * Combos with normalised v2 properties.
 * @returns {Promise<{ data: any[] }>}
 */
export async function getCombos() {
  const entry = ENDPOINTS.combos;
  const response = await resolveResource('combos');

  if (isLocalEntry(entry)) return parseFixture(entry.fixture, entry.schema, response);

  // TEMP: v1→v2 adapter (network fallback already returned `{ data: [] }`).
  const items = Array.isArray(response?.data) ? response.data : [];
  return parseFixture('combos.json (v2 output)', entry.schema, {
    data: items.map(toV2Combo),
  });
}

/**
 * Promotions with normalised v2 properties.
 * @returns {Promise<{ data: any[] }>}
 */
export async function getPromotions() {
  const entry = ENDPOINTS.promotions;
  const response = await resolveResource('promotions');

  if (isLocalEntry(entry)) return parseFixture(entry.fixture, entry.schema, response);

  // TEMP: v1→v2 adapter (network fallback already returned `{ data: [] }`).
  const items = Array.isArray(response?.data) ? response.data : [];
  return parseFixture('promotions.json (v2 output)', entry.schema, {
    data: items.map(toV2Promotion),
  });
}

/**
 * Everything the menu page needs in one parallel call.
 * @returns {Promise<{ blocks: any[], combos: any[], promotions: any[], decorations: import('../types/menu.js').Decorations }>}
 */
export async function loadMenu() {
  const [menu, combos, promotions, decorations] = await Promise.all([
    getMenu(),
    getCombos(),
    getPromotions(),
    getDecorations(),
  ]);

  return {
    blocks: menu.blocks,
    combos: combos?.data ?? [],
    promotions: promotions?.data ?? [],
    decorations,
  };
}

/**
 * Load promotional flyers (manifest entry `'flyers'` — fixture only).
 * @returns {Promise<import('../types/menu.js').FlyersConfig>}
 */
export async function getFlyers() {
  return resolveLocal('flyers');
}

/**
 * Load gallery items (manifest entry `'gallery'` — fixture only).
 * Supports image, video, and iframe embeds (YouTube, TikTok, Facebook).
 *
 * @returns {Promise<Array<import('../types/menu.js').GalleryCategory>>}
 */
export async function getGallery() {
  // Missing fixture → empty list (silent transport fallback); a corrupt one
  // throws and fails the build.
  const items = resolveLocal('gallery').data;

  const categoryMap = new Map();
  for (const item of items) {
    const catName = item.category || 'General';
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, {
        id: catName.toLowerCase().replace(/\s+/g, '-'),
        name: catName,
        items: [],
      });
    }
    categoryMap.get(catName).items.push(item);
  }

  return Array.from(categoryMap.values());
}

/**
 * Gallery dataset: returns categories from `gallery.json` or derived from menu blocks.
 *
 * @param {Array<import('../types/menu.js').MenuBlock>} [blocks]
 * @returns {Promise<Array<import('../types/menu.js').GalleryCategory>>}
 */
export async function getGalleryCategories(blocks = []) {
  const fixtureGallery = await getGallery();
  if (fixtureGallery.length > 0) {
    return fixtureGallery;
  }

  const result = [];
  if (!Array.isArray(blocks)) return result;

  for (const block of blocks) {
    for (const category of block.categories ?? []) {
      const products = (category.products ?? []).filter(
        (p) => Boolean(p.image?.url) && !p.is_hidden
      );
      if (products.length > 0) {
        result.push({
          id: category.id,
          name: category.name,
          description: category.description ?? '',
          items: products.map((p) => ({
            id: p.id,
            title: p.name,
            category: category.name,
            type: 'image',
            url: p.image.url,
            alt: p.image.alt || p.name,
            description: p.description || '',
          })),
        });
      }
    }
  }
  return result;
}
