/**
 * Storefront data contracts — Zod schemas for every fixture in
 * `src/data/api/` (v2 contract, doc/proposal-api-v2.md).
 *
 * Usage: services parse fixture input at the loader boundary with
 * `parseFixture('<fixture>', <schema>, raw)` — a violation throws
 * `SchemaViolationError` and fails the build; transport failures (missing
 * file, network) keep their existing fallbacks and never reach a schema.
 */

export { SchemaViolationError, isSchemaViolationError, parseFixture } from './errors';

export {
  businessHoursSchema,
  restaurantSettingsSchema,
  settingsFileSchema,
} from './settings.schema';

export {
  menuBlockSchema,
  menuCategorySchema,
  menuDataSchema,
  menuFileSchema,
  menuProductSchema,
  priceRangeEntrySchema,
  priceRangeSchema,
} from './menu.schema';

export {
  combosFileSchema,
  comboSchema,
  promotionSchema,
  promotionsFileSchema,
} from './offers.schema';

export { galleryFileSchema, galleryItemSchema } from './gallery.schema';

export { landingBlockSchema, landingFileSchema } from './landing.schema';

export { enlacesBlockSchema, enlacesFileSchema } from './enlaces.schema';

export { decorationItemSchema, decorationsFileSchema } from './decorations.schema';

export { flyerItemSchema, flyersFileSchema } from './flyers.schema';
