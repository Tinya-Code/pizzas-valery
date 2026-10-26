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
 *   data.brand.logo_url   — logo rendered by every layout
 *   data.share            — share-sheet copy (`ShareButton`)
 *   data.header.layout   — brand header layout (logo position, name visibility)
 *   data.header.actions   — buttons on the right of the brand header
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

/** Share-sheet copy rendered by `ShareButton` (no brand string lives in code). */
const themeShareSchema = z
  .object({
    /** `navigator.share` title (clipboard fallback shows the URL only). */
    title: z.string(),
    /** `navigator.share` body text. */
    text: z.string(),
    /** Visible button label. */
    label: z.string(),
    /** `title` / `aria` tooltip of the button element. */
    button_title: z.string(),
  })
  .strict();

/** Icon names a header action can render (`header-actions.astro` maps them). */
const headerActionIconSchema = z.enum(['images', 'map-pin', 'utensils', 'whatsapp']);

/** `link` — a navigation anchor whose href lives in the data. */
const headerLinkActionSchema = z
  .object({
    type: z.literal('link'),
    href: z.string(),
    label: z.string(),
    title: z.string().optional(),
    icon: headerActionIconSchema,
  })
  .strict();

/** `share` — renders `ShareButton` with the copy from the `share` block. */
const headerShareActionSchema = z.object({ type: z.literal('share') }).strict();

/**
 * `whatsapp` — anchor to `wa.me` built from `settings.whatsapp` at render
 * time; the business number never lives in `theme.json`.
 */
const headerWhatsappActionSchema = z
  .object({
    type: z.literal('whatsapp'),
    label: z.string(),
    title: z.string().optional(),
  })
  .strict();

/** One button in the brand header — discriminated on `type`. */
export const headerActionSchema = z.discriminatedUnion('type', [
  headerLinkActionSchema,
  headerShareActionSchema,
  headerWhatsappActionSchema,
]);

/**
 * Header block: the action list rendered on the right of the brand header
 * and the brand header's layout (`logo_position`, `show_name`).
 *
 * SCOPE NOTE — the `Menú` / `Galería` anchors inside `site-header.astro`'s
 * `<nav>` are ROUTING (they are how a visitor reaches the other pages and
 * carry the active-page styling), not configurable actions. They deliberately
 * stay OUT of `header.actions`: turning routes into data would make every
 * page's navigation a theme edit.
 */
const headerLayoutSchema = z
  .object({
    logo_position: z.enum(['left', 'center']),
    show_name: z.boolean(),
  })
  .strict();

const headerSchema = z
  .object({
    layout: headerLayoutSchema,
    actions: z.array(headerActionSchema),
  })
  .strict();

/** Whole `theme.json` file shape: `{ data: <theme> }`. */
export const themeFileSchema = z
  .object({
    data: z
      .object({
        page: themePageSchema,
        brand: themeBrandSchema,
        share: themeShareSchema,
        header: headerSchema,
        /** Keyed by menu block (`block-1`, `block-3`, `block-6`, …). */
        blocks: z.record(z.string(), z.array(decorationItemSchema)).optional(),
      })
      .strict(),
  })
  .strict();
