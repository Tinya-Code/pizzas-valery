import { z } from 'zod';

/**
 * `src/data/api/menu.json` — menu blocks / categories / products with the
 * embedded price range (v2 contract, doc/proposal-api-v2.md §2).
 *
 * Strictness notes:
 * - Products and price ranges are strict: local fixtures are fully controlled
 *   and the TEMP v1→v2 adapter (`toV2Product`) emits exactly these keys.
 * - Blocks and categories are NOT strict: in `PUBLIC_DATA_MODE=api` the v1
 *   payload's categories/blocks pass through unmapped, so extra legacy keys
 *   are tolerated (they are stripped, never rendered).
 */

const menuImageSchema = z
  .object({
    url: z.string(),
    alt: z.string(),
    cloudinary_id: z.string().optional(),
  })
  .strict();

/** Optional per-item SEO overrides (`slug`/`seo` are fixture-absent today). */
export const seoBlockSchema = z
  .object({
    title: z.string().nullable(),
    description: z.string().nullable(),
  })
  .strict();

/** One quantity option of an embedded price range. */
export const priceRangeEntrySchema = z
  .object({
    qty: z.number(),
    price: z.number(),
    /** Optional bonus label; v1 raw value may be a string or a number. */
    bonus: z.union([z.string(), z.number()]).optional(),
    /** Display label for named sizes ("Familiar"). */
    label: z.string().optional(),
  })
  .strict();

/** A product's size/quantity ladder, embedded in the product itself. */
export const priceRangeSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    entries: z.array(priceRangeEntrySchema),
    /** API-owned singular/plural unit wording (v1 may omit it). */
    units_label: z
      .object({
        one: z.string(),
        other: z.string(),
      })
      .optional(),
    /** Computed by the API — the UI derives nothing. */
    min_price: z.number(),
    /** Computed by the API — the UI derives nothing. */
    max_price: z.number(),
  })
  .strict();

/** One product row (`menu` → `categories[].products[]`). */
export const menuProductSchema = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    name: z.string(),
    description: z.string(),
    image: menuImageSchema,
    /** Flat price, or `price_range.min_price` when a range exists. */
    price: z.number(),
    /** Full embedded content; `null` for flat products (always present). */
    price_range: priceRangeSchema.nullable(),
    /** Short suffix next to the price (e.g. `"x2"`); `null` when unused. */
    qty_label: z.string().nullable(),
    is_recommended: z.boolean(),
    is_hidden: z.boolean(),
    category_id: z.string(),
    seo: seoBlockSchema.optional(),
  })
  .strict();

/** One category rendered as a section. */
export const menuCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  block_id: z.string().optional(),
  slug: z.string().optional(),
  seo: seoBlockSchema.optional(),
  /** Always an array — the loader normalises it after parsing. */
  products: z.array(menuProductSchema),
});

/** One menu block (`menu` → `data.blocks[]`). */
export const menuBlockSchema = z.object({
  id: z.string().optional(),
  categories: z.array(menuCategorySchema),
});

/** `menu.json` → `data` (shared by local file parse and API v2 output). */
export const menuDataSchema = z.object({
  blocks: z.array(menuBlockSchema),
});

/** Whole `menu.json` file shape: `{ data: { blocks: [...] } }`. */
export const menuFileSchema = z
  .object({
    data: menuDataSchema,
  })
  .strict();
