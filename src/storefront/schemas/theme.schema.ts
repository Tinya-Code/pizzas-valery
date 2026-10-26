import { z } from 'zod';

/**
 * `src/data/api/theme.json` — page presentation: the backgrounds the layout
 * renders, and the decorative art layered around the menu blocks.
 *
 * This file absorbs the former `decorations.json`. It is the SINGLE source of
 * truth for "how a page looks": `settings.json` keeps business data only and
 * no longer carries `header_bg` / `footer_bg` / `logo_url`.
 *
 *   data.page.background  — page background image (menu page)
 *   data.page.header_bg   — header background image (`null` → CSS default)
 *   data.page.footer_bg   — footer background image (`null` → CSS default)
 *   data.blocks           — decoration items keyed by menu block
 *                           (`block-1`, `block-2`, `block-3`, `block-6`, …),
 *                           each passed to the matching `MenuBlock` as the
 *                           `decorations` prop
 *
 * Decoration items are a discriminated union on `type`
 * (image | rail | group) within one `slot` (left | right | extra).
 */

const slotSchema = z.enum(['left', 'right', 'extra']);

const railDecorationItemSchema = z
  .object({
    slot: slotSchema,
    type: z.literal('rail'),
    containerClass: z.string().optional(),
    /** Raw HTML snippets rendered inside the rail. */
    items: z.array(z.string()),
    attrs: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const groupDecorationImageSchema = z
  .object({
    src: z.string(),
    alt: z.string().optional(),
    class: z.string().optional(),
    animation: z.string().optional(),
  })
  .strict();

const groupDecorationItemSchema = z
  .object({
    slot: slotSchema,
    type: z.literal('group'),
    containerClass: z.string().optional(),
    images: z.array(groupDecorationImageSchema),
  })
  .strict();

const imageDecorationItemSchema = z
  .object({
    slot: slotSchema,
    type: z.literal('image'),
    src: z.string(),
    alt: z.string().optional(),
    class: z.string().optional(),
    animation: z.string().optional(),
    attrs: z.record(z.string(), z.string()).optional(),
    containerClass: z.string().optional(),
  })
  .strict();

export const decorationItemSchema = z.discriminatedUnion('type', [
  imageDecorationItemSchema,
  railDecorationItemSchema,
  groupDecorationItemSchema,
]);

/** Page-level backgrounds (`null` → CSS default). */
const themePageSchema = z
  .object({
    background: z.string(),
    header_bg: z.string().nullable(),
    footer_bg: z.string().nullable(),
  })
  .strict();

/** Brand assets shared by every layout (header, site header, footer). */
const themeBrandSchema = z
  .object({
    logo_url: z.string().nullable(),
  })
  .strict();

/** Whole `theme.json` file shape: `{ data: <theme> }`. */
export const themeFileSchema = z
  .object({
    data: z
      .object({
        page: themePageSchema,
        brand: themeBrandSchema,
        /** Keyed by menu block (`block-1`, `block-3`, `block-6`, …). */
        blocks: z.record(z.string(), z.array(decorationItemSchema)).optional(),
      })
      .strict(),
  })
  .strict();
