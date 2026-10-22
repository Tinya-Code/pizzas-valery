import { z } from 'zod';

/**
 * `src/data/api/landing.json` — home page block list (`{ meta, blocks }`).
 *
 * Blocks are a discriminated union on `type`, mirroring the render switch in
 * `src/pages/index.astro` (hero | promotions | recommended | media |
 * nav-cards | banner | flyer | video). The service comment also mentions
 * `divider`, but no case renders it — it is intentionally NOT part of the
 * contract.
 *
 * Hydration fields added by `landing.service.js` (`_products`, `_items`,
 * `_cards`, `_promotions`, `resolved_*`) are runtime-only and never parsed.
 * `banner` / `flyer` / `video` are both standalone blocks (rendered as a
 * single-item `HomeMedia`) and the item variants inside `media.items`.
 */

const ctaWhatsappSchema = z
  .object({
    enabled: z.boolean(),
    label: z.string(),
    href: z.string(),
    message: z.string(),
  })
  .strict();

const ctaMenuSchema = z
  .object({
    enabled: z.boolean(),
    label: z.string(),
    href: z.string(),
  })
  .strict();

const heroBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('hero'),
    enabled: z.boolean().optional(),
    title: z.string().nullable(),
    tagline: z.string().nullable(),
    show_hours_badge: z.boolean(),
    cta_whatsapp: ctaWhatsappSchema.optional(),
    cta_menu: ctaMenuSchema.optional(),
  })
  .strict();

const promotionsBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('promotions'),
    enabled: z.boolean().optional(),
    title: z.string(),
    badge: z.string(),
    max_items: z.number().int(),
    see_all_label: z.string(),
    see_all_href: z.string(),
  })
  .strict();

const recommendedBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('recommended'),
    enabled: z.boolean().optional(),
    title: z.string(),
    badge: z.string(),
    max_items: z.number().int(),
    see_all_label: z.string(),
    see_all_href: z.string(),
    /** Lower-case fragment matched against category names (`?.`-guarded). */
    category_filter: z.string().optional(),
  })
  .strict();

const bannerItemSchema = z
  .object({
    id: z.string(),
    type: z.literal('banner'),
    enabled: z.boolean().optional(),
    /** Optional: `HomeMedia` falls back to the full-width layout. */
    layout: z.string().optional(),
    image_url: z.string(),
    alt: z.string(),
    title: z.string(),
    description: z.string(),
    min_height: z.string(),
    cta_label: z.string().optional(),
    cta_href: z.string().optional(),
    cta_message: z.string().optional(),
    cta_target: z.string().optional(),
  })
  .strict();

const flyerItemSchema = z
  .object({
    id: z.string(),
    type: z.literal('flyer'),
    enabled: z.boolean().optional(),
    layout: z.string().optional(),
    image_url: z.string(),
    alt: z.string(),
    href: z.string().optional(),
    message: z.string().optional(),
    target: z.string().optional(),
  })
  .strict();

const videoItemSchema = z
  .object({
    id: z.string(),
    type: z.literal('video'),
    enabled: z.boolean().optional(),
    layout: z.string().optional(),
    provider: z.string(),
    video_id: z.string(),
    title: z.string(),
    caption: z.string(),
  })
  .strict();

const mediaItemSchema = z.discriminatedUnion('type', [
  bannerItemSchema,
  flyerItemSchema,
  videoItemSchema,
]);

const mediaBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('media'),
    enabled: z.boolean().optional(),
    title: z.string(),
    badge: z.string(),
    items: z.array(mediaItemSchema),
  })
  .strict();

const navCardsBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('nav-cards'),
    enabled: z.boolean().optional(),
    cards: z.array(
      z
        .object({
          id: z.string(),
          icon: z.string(),
          title: z.string(),
          description: z.string(),
          cta_label: z.string(),
          href: z.string(),
        })
        .strict()
    ),
  })
  .strict();

export const landingBlockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  promotionsBlockSchema,
  recommendedBlockSchema,
  mediaBlockSchema,
  navCardsBlockSchema,
  bannerItemSchema,
  flyerItemSchema,
  videoItemSchema,
]);

const landingMetaSchema = z
  .object({
    title: z.string().optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

/**
 * Whole `landing.json` file shape. Every top-level key is optional
 * (the service ships `defaultBlocks()` when `blocks` is absent), but any
 * block that IS present must satisfy the union above.
 */
export const landingFileSchema = z
  .object({
    meta: landingMetaSchema.optional(),
    blocks: z.array(landingBlockSchema).optional(),
    /** Backward-compatible flat media key (patched into the media block). */
    media: z.array(mediaItemSchema).optional(),
  })
  .strict();
