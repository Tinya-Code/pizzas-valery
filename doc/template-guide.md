# Storefront template — usage guide

This repo doubles as a portable storefront template (Astro 7 + Tailwind v4, static build, no
runtime backend). Porting it to a new restaurant/project = **copy the code, declare the data
objects, rebrand, verify**. The code has no hardcoded business content: everything the site
shows comes from the fixture objects in `src/data/api/`.

## Quick path

1. Copy the template files (table below) into the new project; `pnpm install`.
2. Declare the 9 data objects in `src/data/api/` with the new restaurant's content.
3. Rebrand: `site` in `astro.config.mjs`, tokens in `src/storefront/styles/global.css`, assets in `public/`.
4. Verify: `pnpm build && node scripts/smoke.mjs` (update smoke expectations to the new data — see below).

## What to copy

Every path belongs to an update zone (next section): **Core** = template-managed,
**App** = yours forever, **Composition** = shared — conflicts only where you edit.

| Path | Role | Zone |
| --- | --- | --- |
| `src/storefront/` | The whole domain — the portable core: `services/` (data access + fallbacks), `types/` (contracts), `menu/` (blocks, cards, product detail), `commerce/` (cart), `layout/`, `ui/` (modals), `home/`, `enlaces/`, `icons/`, `scripts/`, `styles/`, `utils/` | Core |
| `src/pages/` | The four routes: `index.astro` (landing), `menu.astro`, `galeria.astro`, `enlaces.astro` | Composition |
| `src/data/api/` | Fixture objects — copy as placeholders, then replace with your declared data | App |
| `src/styles/tokens.css` | Brand: fonts (`@font-face`) + Tailwind v4 `@theme` tokens | App |
| `public/` | Static assets (logos, images, favicon) | App |
| `astro.config.mjs`, `package.json`, `tsconfig.json`, `pnpm-lock.yaml`, `.gitattributes` | Tooling — Astro, Tailwind v4 via `@tailwindcss/vite`, sitemap integration, update-zone rules | Core |
| `scripts/smoke.mjs` | End-to-end smoke over CDP (headless Chrome), no test framework needed | Core |
| `scripts/smoke-data.json` | Smoke expectations pinned to your data (CTA count, headings, min items, labels) | App |

Not portable by design: `doc/` (project history), `.env*` (local), `dist/` (build output).

## Update zones

A template is only updatable where the owner did NOT edit — the same reason
`node_modules` exists. Each copied file belongs to exactly one zone:

| Zone | Paths | Rule |
| --- | --- | --- |
| **Core** | `src/storefront/`, `src/pages/`, `scripts/smoke.mjs`, tooling | Don't edit — extend through the seams instead: design slots in `menu.astro`, fixtures, tokens. Template updates apply cleanly here. |
| **App** | `src/data/api/*.json`, `src/styles/tokens.css`, `public/`, `scripts/smoke-data.json` | Yours forever. `.gitattributes` marks these `merge=ours`, so an update merge never overwrites your data, brand, or assets. |
| **Composition** | The parts of `src/pages/*.astro` / `menu.astro` you customize | Conflicts appear only where you edited; resolve by hand (keep yours or take the template's). |

Applying an update (the scaffolder will wire the `upstream` remote and the copied
version for you):

```bash
git fetch upstream && git merge upstream/vX.Y.Z
```

- Untouched core files merge clean.
- App files are protected by `merge=ours` — your data and brand win.
- Conflicts are confined to composition files you actually edited.

Releases stay small and frequent with a CHANGELOG; breaking changes ship with a
migration note in this guide — small merges are what keep updates practical.

Rule of thumb: **edit the fixture/token, not the component.** If a change truly
needs a core edit, that file leaves the update channel from then on — a decision,
not a failure.

## Objects to declare

All 9 live in `src/data/api/`. Every loader in `loadStorefront()` (`src/storefront/services/index.js`)
has a per-resource fallback, but a missing object means a missing section — declare them all.

| Object | Shape | Feeds |
| --- | --- | --- |
| `settings.json` | `{ data: {...} }` — the business object (see below) | Header, footer, WhatsApp ordering, hours, SEO, geo, i18n |
| `menu.json` | `{ data: { blocks: [ { id, categories: [ { id, name, description, block_id, products: [...] } ] } ] } }` | The menu page and product dialogs |
| `combos.json` | `{ data: [ { id, name, description, image, price, price_before } ] }` | Combo cards (`price_before` renders the struck-through price) |
| `promotions.json` | `{ data: [ { id, name, description, image, price, price_before, valid_until } ] }` | Promotion cards + dialog hosts |
| `gallery.json` | `{ data: [ { id, title, category, type, url, alt, description, aspect_ratio?, embed_html? } ] }` | `/galeria` masonry; `type` = `image` \| `video` \| `embed` |
| `landing.json` | `{ meta, blocks: [ { type, ... } ] }` | Declarative landing blocks — block types render via `src/storefront/home/` |
| `enlaces.json` | `{ meta, blocks: [ { type, enabled, ... } ] }` | Linktree page; blocks with `enabled: false` are filtered out; types: `link`, `banner`, `product-carousel`, `video`, `gallery-grid` |
| `decorations.json` | `{ background, header_background, footer_background, blocks, block1, block3, block6 }` | Visual decoration overlays |
| `flyers.json` | `{ enabled, delay_seconds, show_once_per_session, items }` | Flyer modal popup |

### Product shape (menu / combos / promotions)

```jsonc
{
  "id": "…",                  // stable id — dialog hosts and cart keys derive from it
  "name": "…",
  "description": "…",
  "image": { "url": "…", "alt": "…" },
  "price": 18,                 // flat price (number)
  "price_range": {             // range pricing — TemplateCard routes on its presence
    "id": "…", "name": "Makis",
    "entries": [ { "qty": 12, "price": 18 } ],
    "min_price": 18, "max_price": 63
  },
  "qty_label": "…",            // units wording; use entryLabel() helpers in utils
  "is_recommended": false,     // drives "recomendado" placement on the landing
  "is_hidden": false,          // hidden products never render
  "category_id": "…"           // back-reference to its category
}
```

`price` vs `price_range`: the card router (`TemplateCard`) renders flat vs range designs by
whether a range exists — see `doc/menu-cards.md`. Labels/wording for ranges follow the v2
contract in `doc/proposal-api-v2.md`.

### Settings object (the one you declare first)

Required for a working site:

| Key | Purpose |
| --- | --- |
| `name`, `phone`, `address` | Identity + contact |
| `whatsapp.number`, `whatsapp.message_template` | Ordering deep-links (message is pre-filled) |
| `timezone`, `currency`, `language` | Hours, prices, copy locale |
| `delivery { enabled, fee, zones }` | Delivery fee logic |
| `payment_methods` | Checkout display |
| `business_hours` | Per-weekday `{ isOpen, open, close }` keyed by ISO weekdays (`mon`…`sun`) — drives the open/closed badge |
| `seo { site_name, title, title_template, description, keywords, og_image, twitter_card, locale, json_ld }` | `<head>` + structured data |
| `social_media`, `google_maps`, `geo { lat, lng }` | Footer links, maps, location |
| `max_order_quantity` | Cart cap |

## Configure

- **`astro.config.mjs` → `site`**: set the production origin (feeds the sitemap integration).
- **Data mode** (`PUBLIC_DATA_MODE` env): unset/anything → LOCAL (reads the fixtures — default,
  zero network). `=api` → live Google Apps Script endpoint with a v1→v2 adapter (temporary;
  see `doc/proposal-api-v2.md` for the target contract).
- **Brand tokens**: fonts and colors live in `src/styles/tokens.css` (app zone —
  `@font-face` + Tailwind v4 `@theme`, imported by `src/storefront/styles/global.css`).
  Change brand there — never hardcode colors in components.
- **Design slots**: per-block card designs are wired in `src/pages/menu.astro` — the port point
  documented in `doc/menu-cards.md`.

## Endpoint manifest

`src/storefront/data/endpoints.js` declares every data source in one `ENDPOINTS`
object — the single place to edit when a source changes (fixture, remote
endpoint, contract, fallback). Loaders no longer hardcode where data comes from.

Per entry:

| Field      | Meaning |
| ---------- | ------- |
| `enabled`  | `false` skips the source entirely → `fallback`. |
| `mode`     | `'auto'` = local fixture, remote endpoint when `PUBLIC_DATA_MODE=api`; `'local'` = always the fixture; `'remote'` = always the endpoint. |
| `fixture`  | JSON file under `src/data/api/` (`null` → no local origin). |
| `resource` | Name on the GAS API (`null` → local-only source). |
| `schema`   | Zod contract every resolved payload must pass (`null` → not held to the v2 contract, e.g. the raw v1 price-ranges join input). |
| `fallback` | Value returned on TRANSPORT failure only (missing file / network error) — a schema violation still fails the build. |

Recipes:

- **Switch a source to the remote API**: set `mode` to `'remote'` (or leave
  `'auto'` and set `PUBLIC_DATA_MODE=api`).
- **Disable a source**: `enabled: false` — consumers get `fallback` with no I/O.
- **Add a source**: drop the JSON in `src/data/api/`, add its schema to
  `src/storefront/schemas/`, declare the entry, then call
  `resolveLocal('<key>')` from your loader.
- Helpers: `loadFixture(name)` (raw JSON or `null`), `resolveLocal(name)`
  (fixture + contract check + fallback); remote-capable entries go through
  `resolveResource(name)` in `menu.service.js`, which reads the same entry.

## Data contract (schemas)

Every fixture is validated at its loader boundary by Zod schemas in
`src/storefront/schemas/` (one file per fixture + `errors.ts` + barrel). The
schemas ARE the executable v2 contract (`doc/proposal-api-v2.md`):

- **A fixture that violates its schema fails the build** with the exact path,
  e.g. `[schemas] settings.json failed contract validation: → data.phone:
  Expected string, received number`. Transport failures (missing file,
  network in `PUBLIC_DATA_MODE=api`) keep their silent fallbacks — contract
  violations never do.
- **Strict objects**: unknown keys are rejected (catches typos like
  `enabeld`). Exceptions: `menu` blocks/categories are non-strict because the
  v1 API payload passes through them unmapped.
- **Discriminated unions**: `landing.json` / `enlaces.json` blocks and
  `gallery.json` items are typed by their `type` field; a wrong value lists
  every valid type in the error.
- **Optional fields** mirror consumer tolerance: anything the loaders
  default (`?.` / `??`) or the v1 adapter may omit is optional; everything
  the fixtures always ship is required.
- When adding a fixture or a new block type, extend the matching schema
  first — the build then enforces it for every future edit.
- Note: `astro build` type-erases TypeScript — the schemas are the runtime
  gate; `src/storefront/types/menu.ts` stays the documentation and must be
  kept in sync by hand.

## Verification

1. `pnpm build` — expects 4 pages (this also proves every fixture passes its schema).
2. `node scripts/smoke.mjs` — drives headless Chrome over CDP against the preview server
   (`pnpm preview`, default `localhost:4322`). Checks: menu card/dialog counts, cart flows,
   gallery items/modal, landing CTA, footer links.
3. **Gotcha — data-pinned expectations**: a few smoke checks snapshot *this* repo's data
   (gallery min items, category headings, landing CTA count, product entry label). They live
   in `scripts/smoke-data.json` (app zone) — after declaring your own data, update that file.
   Titles, business hours, and social links derive from `settings.json` automatically. Menu
   checks are count-free (`> 0`), so they port as-is.
4. Manual browser pass at 1440px and 390px.

## Page references

- `doc/pages/index.md` — landing block architecture
- `doc/pages/enlaces.md` — linktree block types
- `doc/pages/galeria.md` — gallery masonry + media contracts
- `doc/menu-cards.md` — card design system and how to swap a design
- `doc/proposal-api-v2.md` — the data contract (v2) the fixtures target
