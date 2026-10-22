import { z } from 'zod';

/**
 * `src/data/api/flyers.json` — delayed promotional flyer modal config
 * (`flyer-modal.astro` reads `enabled`, `delay_seconds`,
 * `show_once_per_session` and per-item `image` / `alt || title` / `link`).
 */

export const flyerItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    /** Image URL (asset path or Cloudinary). */
    image: z.string(),
    /** Click target; the component guards it with `?.`. */
    link: z.string().nullable().optional(),
    /** Falls back to `title` when absent. */
    alt: z.string().nullable().optional(),
  })
  .strict();

/** Whole `flyers.json` file shape. */
export const flyersFileSchema = z
  .object({
    enabled: z.boolean(),
    delay_seconds: z.number().int(),
    show_once_per_session: z.boolean(),
    items: z.array(flyerItemSchema),
  })
  .strict();
