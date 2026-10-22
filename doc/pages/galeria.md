# Page: Galería (`/galeria`)

- **File**: `src/pages/galeria.astro`
- **Route**: `/galeria`
- **Role**: Pinterest-style media gallery. CSS multi-column masonry with a per-category layout switch: categories holding video/embeds render in wide columns so media dominates; image-only categories keep a dense 4-column grid. Opens any item in a lightbox modal.

## Layout decisions (what and why)

| Decision | Why |
| --- | --- |
| CSS multi-columns (`columns-*`) instead of grid rows | Masonry needs variable card heights; grid rows force uniform heights. |
| Column-major flow + `break-inside-avoid` per card | Each card stays whole in one column while columns absorb the height mix. |
| `mb-6` on cards for vertical rhythm | `row-gap` does not apply to multi-column containers. |
| Images at natural height (`w-full h-auto`, no `aspect-square`) | Natural source ratios are what makes masonry visually vary; forcing a square frame is what made the old layout look uniform. |
| Wide columns for media categories (`columns-1 sm:columns-2`) | The Pinterest move: video/embed cards get ~2× the width of image cards. Selected per category via `hasRichMedia`. |
| Dense columns for image categories (`columns-2 md:columns-3 lg:columns-4`) | Images benefit from density; a 4-col masonry reads as a gallery wall. |
| Media size caps (see below) | Wide columns alone let cards blow up: a 9:16 embed at full column width rendered 1074px tall on desktop. |

## Media size caps

Caps target the **card width** so the frame keeps its true aspect ratio (capping height instead would letterbox iframes). Applied in the `mediaCard` class in `galeria.astro`:

| Media kind | Cap | Result |
| --- | --- | --- |
| Portrait 9:16 embed | `max-w-[250px] md:max-w-[300px] mx-auto` | ~444px tall mobile / ~533px desktop (was 636 / 1074) |
| Landscape video / embed | `max-w-[460px] mx-auto` | ~460px wide desktop (was 604) |
| Images | none | natural height |

The 9:16 card stays clearly the tallest card on the page — bounded, not dominating.

## Data flow

Server-side resolution only — no client fetching.

1. `loadStorefront()` (`src/storefront/services/index.js`) provides `blocks`, `restaurant`, `settings`, `businessHours`, `decorations`.
2. `getGalleryCategories(blocks)` (`src/storefront/services/menu.service.js`) loads `src/data/api/gallery.json`; when the fixture is empty it falls back to deriving image categories from menu blocks.
3. Per item, `resolveEmbedUrl()` (local to the page) normalizes YouTube / TikTok / Facebook URLs to embeddable forms (`youtube-nocookie.com`, `tiktok.com/embed/v2`, `facebook.com/plugins/video.php`).
4. `GalleryModal` (`src/storefront/ui/gallery-modal.astro`) is pre-rendered once; card clicks delegate to it.

Fixture: `src/data/api/gallery.json` (top-level key `data`). Current shape: 25 items — 21 `image`, 1 `video`, 3 `embed`; categories `Rolls` (13), `Piqueos` (1), `Alitas` (7), `Videos y Experiencia` (4).

## Media type detection

`type` is authoritative when present; the page keeps URL heuristics as a fallback for type-less items:

- `isVideo`: `type === 'video'` or URL ends in `.mp4` / `.webm`.
- `isEmbed`: `type === 'embed'`, `embed_html` present, or URL contains youtube / youtu.be / tiktok / facebook.
- `isAspect916`: `aspect_ratio === '9/16'` or URL contains `shorts` / `tiktok`.
- `hasRichMedia` (category-level): any item matching the above → the whole category gets wide columns.

## Client contracts (do not rename)

| Attribute | On | Consumer |
| --- | --- | --- |
| `data-gallery-item="<id>"` | card `<article>` | `GalleryModal` — click trigger |
| `data-gallery-data="<JSON>"` | card `<article>` | `GalleryModal` — primary payload source (DOM scraping of `h3`/`p`/`img` is fallback only) |
| `data-gallery-category="<name>"` | category `<section>` | `GalleryModal` — modal category label |

## Known constraints

- **Multi-column cannot give one card double width.** Only `column-span: all` exists, and it breaks the flow (each spanning item becomes its own row). The per-category wide/narrow switch is the workaround; true per-item spans would need a measured JS grid, which is against this repo's zero-heavy-JS philosophy.
- **Rolls looks uniform because the data is.** The template ships uniform 4:3 placeholder images, so every item shares one ratio — that section is uniform by content, not by CSS.
- **"Este video no está disponible" on YouTube embeds is upstream** (YouTube-side embed rejection), not a layout or URL-conversion bug.

## Quick path — adjust the gallery

1. **Column counts**: edit the ternary on the grid `<div>` in `galeria.astro` (wide vs dense classes).
2. **Media caps**: edit `mediaCard` classes in the same file; keep caps on **width**, never height, to preserve ratios.
3. **Data**: edit `src/data/api/gallery.json` (`data` array); no code change needed for new items.

## Verification checklist

- [ ] `pnpm build` — 4 pages built.
- [ ] `node scripts/smoke.mjs` — gallery checks: ≥21 `[data-gallery-item]` cards, at least one category heading including `Rolls`, a `<video>` element, an `<iframe>` embed, modal `#gallery-modal` opens with media injected on card click.
- [ ] Visual pass at 1440px and 390px: media category wide, 9:16 card bounded (~533px desktop / ~444px mobile), images at natural height.
