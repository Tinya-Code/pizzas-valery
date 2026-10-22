import { z } from 'zod';

/**
 * `src/data/api/gallery.json` — flat media items grouped into categories at
 * load time (v2 contract, doc/proposal-api-v2.md §2).
 *
 * Discriminated by `type`:
 * - `image` — Cloudinary image (`url` required).
 * - `video` — direct video file (`url` required, `poster` optional).
 * - `embed` — iframe provider (`aspect_ratio` required; a given embed ships
 *   either `url` or `embed_html`).
 *
 * Category-grouped output (`GalleryCategory`) is hydrated by
 * `menu.service.js` → `getGallery()` and is NOT schema-validated — the schema
 * validates the flat fixture input only.
 */

const galleryBaseSchema = {
  id: z.string(),
  title: z.string(),
  category: z.string(),
  alt: z.string(),
  description: z.string(),
};

const galleryImageItemSchema = z
  .object({
    ...galleryBaseSchema,
    type: z.literal('image'),
    url: z.string(),
  })
  .strict();

const galleryVideoItemSchema = z
  .object({
    ...galleryBaseSchema,
    type: z.literal('video'),
    url: z.string(),
    poster: z.string().optional(),
  })
  .strict();

const galleryEmbedItemSchema = z
  .object({
    ...galleryBaseSchema,
    type: z.literal('embed'),
    /** Direct embed URL (`https://www.youtube.com/embed/…`). */
    url: z.string().optional(),
    /** Raw iframe markup — alternative to `url`. */
    embed_html: z.string().optional(),
    /** CSS aspect ratio (`"16/9"`, `"9/16"`, …). */
    aspect_ratio: z.string(),
  })
  .strict();

export const galleryItemSchema = z.discriminatedUnion('type', [
  galleryImageItemSchema,
  galleryVideoItemSchema,
  galleryEmbedItemSchema,
]);

/** Whole `gallery.json` file shape: `{ data: [...] }`. */
export const galleryFileSchema = z
  .object({
    data: z.array(galleryItemSchema),
  })
  .strict();
