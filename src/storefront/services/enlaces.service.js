/**
 * Storefront — Links Page Service (`/enlaces`).
 *
 * Loads the block-schema fixture from `src/data/api/enlaces.json` and
 * resolves dynamic href aliases against live settings data so the page
 * can be built purely from server-side props.
 *
 * Supported href aliases (resolved at build time):
 *   "whatsapp"    → WhatsApp deep-link built from settings.whatsapp
 *   "instagram"   → settings.social_media.instagram
 *   "facebook"    → settings.social_media.facebook
 *   "tiktok"      → settings.social_media.tiktok
 *   "google_maps" → settings.google_maps
 *   "tel"         → tel:<settings.phone>
 *   "/..."        → internal absolute path — kept as-is
 *   "https://..." → external absolute URL — kept as-is
 */
import { buildHrefResolver } from './resolve-href.js';
import { resolveLocal } from '../data/endpoints.js';

/**
 * @typedef {Object} EnlacesMeta
 * @property {string} title
 * @property {string} tagline
 * @property {string|null} logo_url
 * @property {'dark'|'light'} theme
 */

/**
 * @typedef {Object} EnlacesConfig
 * @property {EnlacesMeta} meta
 * @property {any[]} blocks
 */

/**
 * Resolve the `sublabel` field: if it equals "phone" replace with the
 * actual phone number; if it equals "address" replace with the address.
 *
 * @param {string|null|undefined} sublabel
 * @param {any} settings
 * @returns {string}
 */
function resolveSublabel(sublabel, settings) {
  if (!sublabel) return '';
  if (sublabel === 'phone') return settings?.phone ?? '';
  if (sublabel === 'address') return settings?.address ?? '';
  return sublabel;
}

/**
 * Load and hydrate the enlaces block list.
 *
 * Resolves href aliases, filters disabled blocks, and attaches `resolved_href`
 * / `resolved_sublabel` to each block so templates can render without logic.
 *
 * @param {any} settings  - `settings.data` from `loadStorefront()`.
 * @param {any[]} [galleryItems]  - Flat gallery items for gallery-grid blocks.
 * @param {any[]} [menuBlocks]    - Menu blocks for product-carousel blocks.
 * @returns {Promise<{ meta: EnlacesMeta; blocks: any[] }>}
 */
export async function getEnlaces(settings, galleryItems = [], menuBlocks = []) {
  // Contract-validated fixture (missing file → the entry's meta/blocks fallback).
  const config = resolveLocal('enlaces');
  const resolve = buildHrefResolver(settings);

  const blocks = (config.blocks ?? [])
    .filter((b) => b.enabled !== false)
    .map((block) => {
      const resolved_href = resolve(block.href, block.cta_message) ?? null;
      const resolved_cta_href = block.cta_href ? resolve(block.cta_href, block.cta_message) : null;
      const resolved_sublabel = resolveSublabel(block.sublabel, settings);

      // Attach resolved gallery items for gallery-grid blocks.
      let gallerySlice = [];
      if (block.type === 'gallery-grid') {
        const all = galleryItems.flatMap((cat) => (cat.items ?? cat));
        gallerySlice = all.slice(0, block.max_items ?? 6);
      }

      // Attach resolved products for product-carousel blocks.
      let carouselProducts = [];
      if (block.type === 'product-carousel') {
        const filter = block.category_filter?.toLowerCase() ?? null;
        const allProducts = menuBlocks.flatMap((mb) =>
          (mb.categories ?? []).flatMap((cat) => {
            const match = !filter || cat.name.toLowerCase().includes(filter);
            return match ? (cat.products ?? []).filter((p) => !p.is_hidden) : [];
          })
        );
        carouselProducts = allProducts.slice(0, block.max_items ?? 8);
      }

      return {
        ...block,
        resolved_href,
        resolved_cta_href,
        resolved_sublabel,
        _gallery: gallerySlice,
        _products: carouselProducts,
      };
    });

  return { meta: config.meta, blocks };
}
