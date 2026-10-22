# Proposal — API v2: self-contained responses + SEO blocks

**Status:** DRAFT — awaiting approval
**Date:** 2026-10-19
**Evidence:** live capture of all 6 endpoints (HTTP 200) → `api-samples/*.json`; join-site audit of `src/`; dist cross-check.

**Decision in one line:** the API (which you own) stops shipping fragmented records — every response becomes self-contained (price range embedded, real numbers, unified combo/promotion shape) and gains a `seo` block; the frontend then deletes all its join/normalization code.

---

## Quick path

1. Approve (or adjust) the v2 shapes below — they are the contract.
2. I create the fixtures: `src/data/api/` with **v1 golden** (current live captures) + **v2 examples** (this doc's JSON), plus the `PUBLIC_DATA_MODE` toggle and capture script.
3. You update the GAS code to emit v2 (fields only added/reshaped — no behavior risk on your side).
4. Frontend consumes v2, deletes the joins; build + CDP smoke + marker parity verify it.

Because the site is a **static build**, the safest cutover is one PR: API v2 + frontend v2 deploy together — no long-lived clients of the old contract.

---

## 1. Current map (what the API ships today)

| Endpoint | Ships | Consumed by | Problem |
|---|---|---|---|
| `?json=menu` | blocks → categories → products; product has `price: ""` + `price_range_id` | page + cards | the other half lives elsewhere |
| `?json=price-range` | ranges with **string** entries (`"18"`) | `findPriceRange()` at 3 sites, `Number()` at 5 | join re-done by every consumer |
| `?json=combos` | `url`, numeric price, `cloudinary_id` | combo-card | divergent field names |
| `?json=promotions` | same as combo + `discountedPrice` (only camelCase field) | promotion-card (fabricates a fake product to open the dialog) | shape not render-ready |
| `?json=settings` | 23 flat keys; `delivery_enabled: "Activo"`, empty-string arrays | heavy mapper in `restaurant.service.js` | types lie about raw payload |
| `?json=template-images` | `{menu, gallery, promotions, combos}` — **no decoration keys** | `shapeDecorations()` (always falls back locally) | 17.6 KB dead weight; `gallery` unconsumed |

---

## 2. Proposed v2 responses

### 2.1 `?json=menu` — product carries its own range

**Product — before → after:**

| Field (v1) | Field (v2) | Rule |
|---|---|---|
| `price: "" \| number` | `price: number` | always a number: flat price, or `range.min_price` when a range exists |
| `price_range_id: ""` | `price_range: {…} \| null` | **full embedded content** — entries already `number`s |
| `qty_label: ""` | `qty_label: string` | keep (omit when empty) |
| `image_url`, `cloudinary_id` | `image: { url, alt, cloudinary_id }` | one image object; `alt` = `"{name} — {site_name}"` default |
| `category_id` | `category_id` | keep (traceability) |
| — | `slug: string` | URL/SEO-ready (`acevichado`) |
| — | `seo: { title?, description? }` | optional per-product overrides |
| `is_hidden`, `is_recommended` | keep | `is_hidden` stays only if the admin panel uses it |

**Real example (v2, derived from live data):**

```json
{
  "id": "c9b374f7-57f0-4a42-900b-7a238b6e7e60",
  "slug": "acevichado",
  "name": "Acevichado",
  "description": "Relleno de langostino y palta. Cubierto de pescado blanco y salsa acevichada.",
  "image": {
    "url": "https://cdn.example.com/product-1.png",
    "alt": "Acevichado — Sazón Digital",
    "cloudinary_id": "product_c9b374f7-57f0-4a42-900b-7a238b6e7e60"
  },
  "price": 18,
  "price_range": {
    "id": "1df8cce0-f826-43c9-9ead-0b87f6c02a91",
    "name": "Makis",
    "entries": [
      { "qty": 12, "price": 18 },
      { "qty": 24, "price": 33 },
      { "qty": 36, "price": 49 },
      { "qty": 48, "price": 63 }
    ],
    "units_label": { "one": "Unidad", "other": "Unidades" },
    "min_price": 18,
    "max_price": 63
  },
  "qty_label": "",
  "is_recommended": true,
  "is_hidden": false,
  "category_id": "b93ca21c-70c0-4aa9-b56f-44d4a11ba15b",
  "seo": { "title": null, "description": null }
}
```

A flat product is identical with `"price_range": null` and its real `price`. `min_price`/`max_price` are computed by the API — the UI badge and dialog no longer derive anything.

**Unit wording is API-owned.** `units_label` carries the singular/plural pair the UI renders after the qty (`entryLabel()` in `src/storefront/utils/entry-label.js` is the single consumer; it falls back to `Unidad`/`Unidades` only for payloads that predate the field). **Named sizes** (e.g. pizzas) are entries with a `label` that overrides the qty wording entirely:

```json
"entries": [
  { "qty": 1, "price": 22, "label": "Mediana" },
  { "qty": 1, "price": 30, "label": "Familiar" }
]
```

**Category — before → after:** add `slug` + optional `seo {title, description}` (categories are the future anchor of in-page anchors and possible `/menu/<slug>` routes). Keep `block_id`.

**Blocks:** unchanged (`id`, `categories`).

### 2.2 `?json=price-range` — consumed nowhere after v2

Once ranges live inside products, this endpoint is no longer part of the frontend contract. Keep it only if your admin panel uses it; the site will not call it (the fixture stays for golden-diff only).

### 2.3 `?json=combos` + `?json=promotions` — one shape

| Field (v1) | Field (v2) | Rule |
|---|---|---|
| `url` | `image: { url, alt }` | unified with product |
| `price` | `price: number` | keep |
| `discountedPrice` | `price_before: number \| null` | snake_case, explicit compare-at price |
| — | `slug` | SEO/URL |
| — | `seo { title?, description? }` | optional |
| — | `valid_until?: string` (promos) | ISO date, optional — only if you'll use it |

**Real example (v2):**

```json
{
  "id": "cffb90df-…",
  "slug": "sabado-de-promo",
  "name": "Sábado de promo",
  "description": "4 piezas de tus makis favoritos a precio especial.",
  "image": { "url": "https://cdn.example.com/promo-1.png", "alt": "Sábado de promo — Sazón Digital" },
  "price": 26,
  "price_before": 33,
  "valid_until": null,
  "seo": { "title": null, "description": null }
}
```

Combos emit the same object with `price_before: null`. The frontend stops fabricating a fake product in `promotion-card` — it renders a `Promotion` directly.

### 2.4 `?json=settings` — booleans, real arrays, and the `seo` block

**Field fixes:**

| Field (v1) | Field (v2) | Rule |
|---|---|---|
| `delivery_enabled: "Activo"` | `boolean` | kill the string→bool mapper |
| `delivery_zones: ""`, `tags: ""` | real arrays (or omitted) | type must match payload |
| `restaurant_phone: 987654321` | `string` | phones are strings |
| `location_lat/lng` | `geo: { lat, lng }` | nested, like the rest |
| `whatsapp_number/message` | `whatsapp: { number, message_template }` | nested |
| — | `timezone: "America/Lima"` | **new** — hours logic must not depend on the build machine's TZ |
| — | `currency: "PEN"` | real value instead of the fabricated `'PEN'` default |
| `business_hours` (Spanish keys, mixed order) | keep, but keys → ISO weekdays (`mon`…`sun`) | stable, i18n-free |
| `logo_url: ""` | `logo_url: string \| null` | never empty string |

**New `seo` block (site-level):**

```json
"seo": {
  "site_name": "Sazón Digital",
  "title": "Sazón Digital — Tu carta digital en línea",
  "title_template": "%s | Sazón Digital",
  "description": "Sushi artesanal en Lima. Delivery a domicilio, combos y promociones.",
  "keywords": ["sushi lima", "delivery sushi", "carta digital"],
  "og_image": "https://cdn.example.com/og-cover.png",
  "twitter_card": "summary_large_image",
  "locale": "es_PE",
  "canonical_url": "https://your-domain.example",
  "json_ld": {
    "@type": "Restaurant",
    "servesCuisine": "Peruvian, Japanese",
    "priceRange": "$$"
  }
}
```

**How the frontend consumes SEO (current head is title-only — `src/layout/Layout.astro`):**

- `Layout.astro` renders `seo.title` / `title_template`, `description`, `keywords`, `og:*`, `twitter:*`, canonical — all from `#restaurant-info-data` (build-time props).
- JSON-LD: one `<script type="application/ld+json">` merging `Organization` (site) + `seo.json_ld` on the page.
- Per-item `slug`/`seo` fields are wired into the data model now; they pay off when real `/menu/<slug>` routes exist (or for per-category anchors) — the API ships them from day one so your schema won't need a second migration.

---

## 3. What the frontend deletes after v2

| Dies | Lives today at |
|---|---|
| `findPriceRange()` + 3 call sites | `template-card:33`, `product-detail:45`, `index.astro:411` |
| 4× price derivation, 5× `Number(entry…)` | cards, dialog, client fill, `cart.service` |
| Dead `isLoadingRange` state | `product-detail.astro:48` |
| `price: ""` guards + `string\|number` type | `types/menu.ts` everywhere |
| Promotion→MenuProduct fabrication | `promotion-card.astro:29-40` |
| 23-key settings mapper + `DAY_MAP` string↔bool/array coercions | `restaurant.service.js:231-290` |
| `discountedPrice` casing outlier, `template_id`/`currency` fabrications | services |
| Client fetch of `price-range` (any remaining runtime lookups) | memoised GETs |

Types become near-1:1 with the payload — the `types/menu.ts` doc stops lying.

---

## 4. Fixtures (`src/data/api/`) — Part A of the plan, unchanged

```
src/data/api/
  menu.json  price-range.json  settings.json  combos.json  promotions.json  template-images.json
```

- **v1 golden**: current live captures (regression baseline, refresh via `scripts/capture-api-data.mjs`).
- **v2 examples**: exactly the shapes above (written when you approve — they become the contract your GAS code must emit).
- Toggle `PUBLIC_DATA_MODE=local` uses the existing seam `new MenuService({ local, useApi: false })` — default stays live API, zero behavior change.

---

## 5. Migration strategy

| Step | Owner | Verify |
|---|---|---|
| 1. Fixtures + toggle (v1 golden) | frontend | both modes build; markers identical |
| 2. GAS emits v2 (add fields, keep old ones if you want a soft landing) | you | `node scripts/capture-api-data.mjs` diff vs v2 examples |
| 3. Frontend consumes v2, deletes joins (§3) | frontend | build green, marker counts identical (`data-product ×46`, `data-has-range ×41`), full CDP smoke (dialog price, stepper, cart totals, promo strikethrough) |
| 4. Cleanup: drop old v1 fields from GAS, decide `template-images` fate | you | capture diff clean |

**Compatibility note:** the site is static — HTML ships with embedded data, so there are no stale clients. The only runtime API touchpoints are whatever `cart.service` still lazy-loads (hydrated from data attrs since F5); step 3's smoke covers cart totals to prove it.

## 6. Open decisions (defaults in **bold**)

1. `price_range` as `null` for flat products, or field omitted? — **`null` always present** (stable shape).
2. Keep calling `template-images` at all? — **no** (decorations are local config; stop the 17.6 KB fetch in a follow-up).
3. ISO weekday keys in `business_hours` (`mon`) — **yes**, `DAY_MAP` then dies entirely.
4. Keep `price-range` endpoint for admin? — **your call**; frontend won't use it.
5. Fixture refresh policy — **manual script only** (captures are evidence).

## Checklist (acceptance)

- [ ] Every v2 response is self-contained: no consumer joins two endpoints to render one item
- [ ] All prices/qtys are numbers at the API boundary; no `""` holes
- [ ] `seo` block renders title/description/OG/JSON-LD from the page head
- [ ] Combo and promotion share one shape; no fake-product fabrication
- [ ] v1 golden + v2 example fixtures committed; `PUBLIC_DATA_MODE=local` builds offline
- [ ] Frontend deletions in §3 grep 0; build green; CDP smoke 10/10; markers identical

## Next step

Approve §2 shapes (and the 5 defaults in §6) → I implement steps 1 and 3 (frontend), and you get the v2 examples as executable reference for the GAS side in step 2.
