import { z } from 'zod';

/**
 * `src/data/api/enlaces.json` — the `/enlaces` landing-of-links page
 * (`{ meta, blocks }`).
 *
 * Blocks are a discriminated union on `type`, mirroring the render switch in
 * `src/pages/enlaces.astro` (link | banner | product-carousel | video |
 * divider | gallery-grid).
 *
 * Fields guarded by `enlaces.service.js` with `?.` / `??` defaults are
 * optional here; hydration outputs (`resolved_href`, `resolved_cta_href`,
 * `resolved_sublabel`, `_gallery`, `_products`) are runtime-only and never
 * parsed.
 */

const linkBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('link'),
    enabled: z.boolean().optional(),
    /** `block-link.astro` supports `default` | `social` | `primary`. */
    style: z.enum(['default', 'social', 'primary']),
    label: z.string(),
    /** Sentinel (`"phone"` / `"address"`) or literal text; `?.`-guarded. */
    sublabel: z.string().nullable().optional(),
    icon: z.string(),
    color: z.string().optional(),
    href: z.string(),
    /** `?`-guarded; browser default is `_self`. */
    target: z.enum(['_self', '_blank', '_parent', '_top']).optional(),
    cta_href: z.string().optional(),
    cta_message: z.string().optional(),
  })
  .strict();

const bannerBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('banner'),
    enabled: z.boolean().optional(),
    title: z.string(),
    description: z.string(),
    /** `null` → text-only banner. */
    image_url: z.string().nullable(),
    accent: z.string(),
    cta_label: z.string().optional(),
    cta_href: z.string().optional(),
    cta_message: z.string().optional(),
  })
  .strict();

const productCarouselBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('product-carousel'),
    enabled: z.boolean().optional(),
    title: z.string(),
    subtitle: z.string(),
    /** Lower-case fragment matched against category names (`?.`-guarded). */
    category_filter: z.string().optional(),
    max_items: z.number().int().optional(),
    cta_label: z.string().optional(),
    cta_href: z.string().optional(),
  })
  .strict();

const videoBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('video'),
    enabled: z.boolean().optional(),
    title: z.string(),
    provider: z.string(),
    video_id: z.string(),
    autoplay: z.boolean(),
    muted: z.boolean(),
    caption: z.string(),
  })
  .strict();

const dividerBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('divider'),
    enabled: z.boolean().optional(),
    label: z.string(),
  })
  .strict();

const galleryGridBlockSchema = z
  .object({
    id: z.string(),
    type: z.literal('gallery-grid'),
    enabled: z.boolean().optional(),
    title: z.string(),
    max_items: z.number().int().optional(),
    cta_label: z.string().optional(),
    cta_href: z.string().optional(),
  })
  .strict();

export const enlacesBlockSchema = z.discriminatedUnion('type', [
  linkBlockSchema,
  bannerBlockSchema,
  productCarouselBlockSchema,
  videoBlockSchema,
  dividerBlockSchema,
  galleryGridBlockSchema,
]);

const enlacesMetaSchema = z
  .object({
    title: z.string(),
    tagline: z.string(),
    logo_url: z.string().nullable(),
    theme: z.enum(['dark', 'light']),
  })
  .strict();

/** Whole `enlaces.json` file shape: `{ meta, blocks }`. */
export const enlacesFileSchema = z
  .object({
    meta: enlacesMetaSchema,
    blocks: z.array(enlacesBlockSchema).optional(),
  })
  .strict();
