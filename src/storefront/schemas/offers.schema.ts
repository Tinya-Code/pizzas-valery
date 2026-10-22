import { z } from 'zod';
import { seoBlockSchema } from './menu.schema';

/**
 * `src/data/api/combos.json` and `src/data/api/promotions.json` — the two
 * offer resources share one shape (v2 contract, doc/proposal-api-v2.md §2);
 * promotions add `valid_until`.
 */

const offerImageSchema = z
  .object({
    url: z.string(),
    alt: z.string(),
  })
  .strict();

export const comboSchema = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    name: z.string(),
    description: z.string(),
    image: offerImageSchema,
    price: z.number(),
    /** `null` — combos never carry a compare-at price today (nullable for templates). */
    price_before: z.number().nullable(),
    seo: seoBlockSchema.optional(),
  })
  .strict();

export const promotionSchema = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    name: z.string(),
    description: z.string(),
    image: offerImageSchema,
    /** Effective (discounted) selling price. */
    price: z.number(),
    /** Compare-at price shown struck through; `null` when not discounted. */
    price_before: z.number().nullable(),
    /** ISO date; `null` when the API knows no expiry. */
    valid_until: z.string().nullable(),
    seo: seoBlockSchema.optional(),
  })
  .strict();

/** Whole `combos.json` file shape: `{ data: [...] }`. */
export const combosFileSchema = z
  .object({
    data: z.array(comboSchema),
  })
  .strict();

/** Whole `promotions.json` file shape: `{ data: [...] }`. */
export const promotionsFileSchema = z
  .object({
    data: z.array(promotionSchema),
  })
  .strict();
