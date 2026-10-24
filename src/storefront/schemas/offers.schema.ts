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

/**
 * Canonical combo-card design keys (same nomenclature rule as
 * `PRODUCT_CARD_DESIGNS` in menu.schema.ts): a key IS the component
 * filename under `src/storefront/menu/cards/combo/` without `.astro`.
 * Unknown key in JSON → zod rejects at build; key added here without a
 * registered component → exhaustive `Record` in `cards/registry.ts` fails.
 */
export const COMBO_CARD_DESIGNS = ['combo-card', 'combo-card-pizza'] as const;

/** Canonical promotion-card design keys (`cards/promotion/`, same rule). */
export const PROMOTION_CARD_DESIGNS = [
  'promotion-card',
  'promotion-card-pizza',
] as const;

export const comboCardDesignSchema = z.enum(COMBO_CARD_DESIGNS);
export const promotionCardDesignSchema = z.enum(PROMOTION_CARD_DESIGNS);

export const comboSchema = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    name: z.string(),
    description: z.string(),
    /**
     * Structured listing of what the combo includes (e.g. "Pan al Ajo",
     * "Pepsi Jumbo"). Optional — rendered as a list when present.
     */
    includes: z.array(z.string()).optional(),
    /**
     * Declarative card design (see COMBO_CARD_DESIGNS). Absent → the
     * default design in `TemplateComboCard`.
     */
    card: comboCardDesignSchema.optional(),
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
    /**
     * Structured listing of what the promotion includes (e.g. "Pan al Ajo",
     * "Pepsi Jumbo"). Optional — rendered as a list when present.
     */
    includes: z.array(z.string()).optional(),
    /**
     * Declarative card design (see PROMOTION_CARD_DESIGNS). Absent → the
     * default design in `TemplatePromotionCard`.
     */
    card: promotionCardDesignSchema.optional(),
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
