# Page: Landing (`/`)

- **File**: `src/pages/index.astro`
- **Route**: `/`
- **Role**: Navigation hub and entry point of the storefront. Fully data-driven via the declarative block architecture in `src/data/api/landing.json`.

## Data flow

Server-side resolution only — no client fetching.

1. `loadStorefront()` (`src/storefront/services/index.js`) provides `restaurant`, `settings`, `businessHours`, `decorations`, `blocks` (menu), `promotions`, `flyers`.
2. `getLanding(settings, promotions, menuBlocks)` (`src/storefront/services/landing.service.js`) loads `src/data/api/landing.json` and hydrates each block with resolved data (`_resolved_whatsapp_href`, `_promotions`, `_products`, `_items`, `_cards`, ...).
3. The page renders `blocks` via a `switch` on `block.type`, mapping each type to a component in `src/storefront/home/`.

Fixtures touched (directly or transitively): `landing.json` (block layout), `settings.json`, `menu.json` (recommended products), `promotions.json`, `flyers.json`, `decorations.json`.

## Block types → components

| `block.type` | Component | Notes |
| --- | --- | --- |
| `hero` | `home/home-hero.astro` | Receives `restaurantName`, `tagline`, `isOpen`, `openLabel`, `whatsappUrl` |
| `promotions` | `home/home-promotions.astro` | Sliced to `max_items ?? 4` by the service |
| `recommended` | `home/home-recommended.astro` | Products with `is_recommended && !is_hidden`; optional `category_filter` |
| `media` | `home/home-media.astro` | Heterogeneous grid (banners / flyers / videos), hrefs resolved by the service |
| `banner`, `flyer`, `video` | `home/home-media.astro` | Standalone items routed through `HomeMedia` with `items={[block]}` |
| `nav-cards` | `home/home-nav-cards.astro` | Navigation cards; card hrefs resolved by the service |
| anything else | — | Renders `null` (unknown types are silently ignored) |

## Page-level derivations

- **`restaurantName`**: `meta.title` → `restaurant.name` → `settings.seo.site_name` → `'Sazón Digital'`.
- **`tagline`**: `meta.tagline` → `settings.seo.description` → hardcoded Spanish fallback.
- **`siteTitle`**: `settings.seo.title` (composed with `Layout`'s `title_template`) → `` `${restaurantName} — Sushi y delivery en Lima` ``.
- **Open/closed badge**: `weekDayKey(now)` + `isOpenAt(todayHours, now)` from `business-hours.service.js`; `null` when today's hours are missing.
- **WhatsApp URL**: `settings.whatsapp.number` (fallback `restaurant.phone`) + `message_template` via `WhatsApp.link()`. When the number is absent, `whatsappUrl` is `null` and the floating FAB is not rendered.

## Chrome & extras

- `Layout` + `SiteHeader` + `Footer` (footer background: `decorations.footer_bg` → `settings.footer_bg`).
- `FlyerModal` pre-renders all `flyers` for click-to-open from media/flyer blocks.
- Floating WhatsApp FAB (`#fab-whatsapp`, fixed bottom-right) — rendered only when `whatsappUrl` resolves.

## Caveats

- Fallback blocks: when `landing.json` has no `blocks` array, `getLanding()` falls back to a default set (hero, promotions, recommended, media, nav-cards); a legacy top-level `media` key is patched into the `media` block.
- CTA hrefs support aliases (`whatsapp`, `instagram`, `facebook`, `tiktok`, `google_maps`, `tel`) resolved against live settings at build time.
