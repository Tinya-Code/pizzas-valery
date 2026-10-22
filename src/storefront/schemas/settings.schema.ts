import { z } from 'zod';

/**
 * `src/data/api/settings.json` — site settings (v2 contract,
 * doc/proposal-api-v2.md §2).
 *
 * Field optionality follows two rules:
 * - required: always present in the local fixture AND always emitted by the
 *   TEMP v1→v2 adapter (`menu.service.js` → `toV2Settings`);
 * - optional: the adapter legitimately omits it, or consumers guard with
 *   `?.` / `??` (documented per field).
 *
 * `business_hours` days are individually optional (matches
 * `types/menu.ts` → `BusinessHours = Partial<Record<…>>`: a missing day
 * means "no data" and accessors already guard).
 */

const geoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const whatsappSchema = z.object({
  number: z.string(),
  message_template: z.string().nullable(),
});

const deliverySchema = z.object({
  enabled: z.boolean(),
  fee: z.number(),
  zones: z.array(z.string()),
});

const socialMediaSchema = z.object({
  tiktok: z.string().nullable(),
  facebook: z.string().nullable(),
  instagram: z.string().nullable(),
  /** Legacy alias — the footer falls back to it; the fixture omits it. */
  google_maps: z.string().nullable().optional(),
});

const dayScheduleSchema = z.object({
  isOpen: z.boolean(),
  /** `"11:00"` — 24 h `HH:mm`. */
  open: z.string(),
  /** `"22:30"` — 24 h `HH:mm`. */
  close: z.string(),
});

/** Weekly schedule keyed by ISO weekday (`mon` … `sun`). */
export const businessHoursSchema = z.object({
  mon: dayScheduleSchema.optional(),
  tue: dayScheduleSchema.optional(),
  wed: dayScheduleSchema.optional(),
  thu: dayScheduleSchema.optional(),
  fri: dayScheduleSchema.optional(),
  sat: dayScheduleSchema.optional(),
  sun: dayScheduleSchema.optional(),
});

const siteSeoSchema = z.object({
  site_name: z.string(),
  title: z.string(),
  title_template: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  og_image: z.string().nullable(),
  twitter_card: z.string(),
  locale: z.string(),
  canonical_url: z.string().nullable(),
  json_ld: z.record(z.string(), z.unknown()),
});

export const restaurantSettingsSchema = z
  .object({
    /** v1 row id — absent in local fixtures, adapter may emit it. */
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string(),
    slug: z.string().optional(),
    language: z.string(),
    phone: z.string(),
    address: z.string(),
    geo: geoSchema,
    whatsapp: whatsappSchema,
    timezone: z.string(),
    currency: z.string(),
    delivery: deliverySchema,
    payment_methods: z.array(z.string()),
    max_order_quantity: z.number(),
    social_media: socialMediaSchema,
    /** Absent in v1 payloads; consumers fall back to `social_media.google_maps`. */
    google_maps: z.string().nullable().optional(),
    business_hours: businessHoursSchema,
    logo_url: z.string().nullable(),
    /** Background image URL (`null` → CSS default); the fixture always ships it. */
    header_bg: z.string().nullable(),
    /** Background image URL (`null` → CSS default); the fixture always ships it. */
    footer_bg: z.string().nullable(),
    tags: z.array(z.string()),
    seo: siteSeoSchema,
  })
  .strict();

/** Whole `settings.json` file shape: `{ data: <settings> }`. */
export const settingsFileSchema = z
  .object({
    data: restaurantSettingsSchema,
  })
  .strict();
