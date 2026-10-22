# Page: Enlaces (`/enlaces`)

- **File**: `src/pages/enlaces.astro`
- **Route**: `/enlaces`
- **Role**: Linktree-style page aggregating every contact / social destination plus optional showcase blocks. **Intentionally hidden from the site nav** — reachable from the landing (`/`) CTA cards only.

## Data flow

Server-side resolution only — no client fetching.

1. `loadStorefront()` (`src/storefront/services/index.js`) provides `restaurant`, `settings`, `businessHours`, `decorations`, `blocks` (menu), `gallery`.
2. `getEnlaces(settings, gallery, menuBlocks)` (`src/storefront/services/enlaces.service.js`) loads `src/data/api/enlaces.json`, filters out blocks with `enabled: false`, and hydrates each block with `resolved_href`, `resolved_cta_href`, `resolved_sublabel`, plus `_gallery` / `_products` for gallery and carousel blocks.
3. The page renders `blocks` via a `switch` on `block.type`, mapping each type to a component in `src/storefront/enlaces/`.

Fixtures touched (directly or transitively): `enlaces.json` (block layout), `settings.json`, `gallery.json` (via menu fallback in `menu.service.js`), `menu.json` (for product carousels), `decorations.json`.

## Block types → components

| `block.type` | Component | Service hydration |
| --- | --- | --- |
| `link` | `enlaces/block-link.astro` | `resolved_href`, `resolved_sublabel` |
| `banner` | `enlaces/block-banner.astro` | `resolved_cta_href` |
| `product-carousel` | `enlaces/block-product-carousel.astro` | `_products`: menu products filtered by optional `category_filter`, excluding `is_hidden`, sliced to `max_items ?? 8` |
| `video` | `enlaces/block-video.astro` | — |
| `gallery-grid` | `enlaces/block-gallery-grid.astro` | `_gallery`: flattened gallery items sliced to `max_items ?? 6` |
| `divider` | `enlaces/block-divider.astro` | — |
| anything else | — | Renders `null` (unknown types are silently ignored) |

## Href aliases

The service resolves symbolic `href` values against live settings at build time (shared resolver logic with `landing.service.js`):

- `"whatsapp"` → deep link built from `settings.whatsapp.number` + `message_template` via `WhatsApp.link()`
- `"instagram"` / `"facebook"` / `"tiktok"` → `settings.social_media.*`
- `"google_maps"` → `settings.google_maps`
- `"tel"` → `tel:<settings.phone>`
- `"https://..."`, `"/..."`, `"tel:..."` → passed through as-is

`sublabel` values `"phone"` and `"address"` are replaced with `settings.phone` / `settings.address`.

## Page-level derivations

- **`restaurantName`**: `meta.title` → `restaurant.name` → `settings.name` → `'Sazón Digital'`.
- **`tagline`**: `meta.tagline` → `settings.seo.description` → `''` (hidden when empty).
- **`logoUrl`**: `meta.logo_url` → `settings.logo_url` → `null` (Utensils icon fallback inside the brand avatar).

## Chrome & extras

- **No `SiteHeader`** — by design (hidden route). Custom brand avatar + title header instead.
- `Layout` (SEO title fixed to `"Enlaces"`) + `Footer` with `class="mt-16 block"` (footer background: `decorations.footer_bg` → `settings.footer_bg`).
- Ambient glow decoration behind the content column.

## Caveats

- The page is deliberately absent from `SiteHeader` nav links (only Menú + Galería appear there); keep it that way unless the product decision changes.
- Blocks with `enabled: false` are dropped by the service — the page never sees them.
- Unlike `/`, there is no open/closed badge, no WhatsApp FAB, and no cart logic.
