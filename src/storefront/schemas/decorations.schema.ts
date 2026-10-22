import { z } from 'zod';

/**
 * `src/data/api/decorations.json` — decorative art layered around the menu
 * page (`menu.astro` reads `background` / `header_background` /
 * `footer_background` and passes `blocks['block-1' | 'block-3' | 'block-6']`
 * into each `menu-block`).
 *
 * Decoration items are a discriminated union on `type`
 * (image | rail | group) within one `slot` (left | right | extra).
 *
 * `block1` / `block3` / `block6` (top-level, singular) are legacy v1 keys:
 * declared for compatibility with existing fixtures, consumed by nobody.
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

/** Whole `decorations.json` file shape. */
export const decorationsFileSchema = z
  .object({
    background: z.string(),
    header_background: z.string().nullable(),
    footer_background: z.string().nullable(),
    /** Keyed by menu block (`block-1`, `block-3`, `block-6`, …). */
    blocks: z.record(z.string(), z.array(decorationItemSchema)).optional(),
    /** Legacy v1 keys — no consumer reads them. */
    block1: z.unknown().optional(),
    block3: z.unknown().optional(),
    block6: z.unknown().optional(),
  })
  .strict();
