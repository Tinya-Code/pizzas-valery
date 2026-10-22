/**
 * Storefront — Landing Page Service (`/`).
 *
 * Loads the layout & block configuration from `src/data/api/landing.json`
 * and hydrates dynamic props (promotions, recommended products, media,
 * links resolved via live settings) so `src/pages/index.astro` is fully
 * data-driven, modular, and configurable from JSON.
 *
 * Supported block types in landing.json:
 *   - "hero"         — Hero header with open badge and dual CTAs
 *   - "promotions"   — Special deals / combos strip
 *   - "recommended"  — Horizontal scroll of recommended dishes
 *   - "media"        — Heterogeneous grid of banners / flyers / videos
 *   - "banner"       — Standalone promotional banner
 *   - "flyer"        — Standalone clickable graphic flyer
 *   - "video"        — Standalone video embed (YouTube, TikTok, Facebook)
 *   - "nav-cards"    — Navigation cards (Menú, Galería, Contacto)
 *   - "divider"      — Elegant spacing line
 */
import { buildHrefResolver } from './resolve-href.js';
import { resolveLocal } from '../data/endpoints.js';

/**
 * @typedef {Object} LandingMeta
 * @property {string} [title]
 * @property {string} [tagline]
 * @property {string} [description]
 */

/**
 * @typedef {Object} LandingConfig
 * @property {LandingMeta} [meta]
 * @property {any[]} [blocks]
 * @property {any[]} [media] - Backward-compatible media key
 */

/**
 * Default fallback blocks if landing.json does not define blocks.
 */
function defaultBlocks() {
  return [
    { id: 'hero', type: 'hero', enabled: true },
    { id: 'promotions', type: 'promotions', enabled: true },
    { id: 'recommended', type: 'recommended', enabled: true },
    { id: 'media', type: 'media', enabled: true },
    { id: 'nav-cards', type: 'nav-cards', enabled: true },
  ];
}

/**
 * Load and hydrate the landing page block list.
 *
 * @param {any} settings          - `settings.data` from `loadStorefront()`.
 * @param {any[]} [promotions]     - Promotions array from `loadStorefront()`.
 * @param {any[]} [menuBlocks]     - Menu blocks for recommended products extraction.
 * @returns {Promise<{ meta: LandingMeta; blocks: any[] }>}
 */
export async function getLanding(settings, promotions = [], menuBlocks = []) {
  // Contract-validated fixture (missing file → the entry's `{meta,blocks}` fallback).
  const config = resolveLocal('landing');
  const resolve = buildHrefResolver(settings);

  // If `blocks` is not present, construct default blocks using legacy `media` key if present
  let rawBlocks = Array.isArray(config.blocks) ? config.blocks : defaultBlocks();

  // If there's an older config with just `media: [...]` and no blocks.items for media, patch it:
  if (Array.isArray(config.media) && config.media.length > 0) {
    const mediaBlock = rawBlocks.find((b) => b.type === 'media');
    if (mediaBlock && !mediaBlock.items) {
      mediaBlock.items = config.media;
    }
  }

  const allRecommended = (menuBlocks ?? [])
    .flatMap((b) => b.categories ?? [])
    .flatMap((c) => c.products ?? [])
    .filter((p) => p.is_recommended && !p.is_hidden);

  const blocks = rawBlocks
    .filter((b) => b.enabled !== false)
    .map((block) => {
      // 1. Hero block hydration
      if (block.type === 'hero') {
        const waMsg = block.cta_whatsapp?.message ?? settings?.whatsapp?.message_template ?? 'Hola, quiero hacer un pedido 🍱';
        const waHref = resolve(block.cta_whatsapp?.href ?? 'whatsapp', waMsg);
        return {
          ...block,
          _resolved_whatsapp_href: waHref,
          _resolved_menu_href: block.cta_menu?.href ?? '/menu',
        };
      }

      // 2. Promotions block hydration
      if (block.type === 'promotions') {
        const max = block.max_items ?? 4;
        const sliced = (promotions ?? []).slice(0, max);
        return {
          ...block,
          _promotions: sliced,
        };
      }

      // 3. Recommended products hydration
      if (block.type === 'recommended') {
        const max = block.max_items ?? 10;
        let prods = allRecommended;
        if (block.category_filter) {
          const filter = block.category_filter.toLowerCase();
          prods = prods.filter((p) => (p.category_name ?? '').toLowerCase().includes(filter));
        }
        return {
          ...block,
          _products: prods.slice(0, max),
        };
      }

      // 4. Media block (heterogeneous grid) hydration
      if (block.type === 'media') {
        const rawItems = Array.isArray(block.items) ? block.items : (config.media ?? []);
        const hydratedItems = rawItems
          .filter((item) => item.enabled !== false)
          .map((item) => ({
            ...item,
            resolved_href: item.href ? resolve(item.href, item.message) : null,
            resolved_cta_href: item.cta_href ? resolve(item.cta_href, item.cta_message) : null,
          }));
        return {
          ...block,
          _items: hydratedItems,
        };
      }

      // 5. Standalone Banner block
      if (block.type === 'banner') {
        return {
          ...block,
          resolved_cta_href: block.cta_href ? resolve(block.cta_href, block.cta_message) : null,
        };
      }

      // 6. Standalone Flyer block
      if (block.type === 'flyer') {
        return {
          ...block,
          resolved_href: block.href ? resolve(block.href, block.message) : null,
        };
      }

      // 7. Nav cards hydration
      if (block.type === 'nav-cards') {
        const cards = (block.cards ?? []).map((card) => ({
          ...card,
          resolved_href: resolve(card.href),
        }));
        return {
          ...block,
          _cards: cards.length > 0 ? cards : null,
        };
      }

      return block;
    });

  return {
    meta: config.meta ?? {},
    blocks,
  };
}
