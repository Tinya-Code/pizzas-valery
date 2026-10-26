# Plan — Merge presentation config into `theme.json`

**Source:** session analysis of `src/data/api/settings.json` responsibility mix (2026-10-26), including three verified defects found in the current code (see F1/F3 objectives).

**Stack context:** Astro 5 static build (no adapter, no backend, no CMS — data is build-time JSON under `src/data/api/`), Tailwind v4, zod `.strict()` schemas as the build-time contract, `pnpm build` (4 pages), `pnpm smoke` (needs `pnpm preview --port 4322`). The project has **no `tsc` and no `astro check` installed** — type regressions are only caught by reading or by the editor.

**Decision taken:** `decorations.json` is absorbed into the new `theme.json` (single source of truth for "how the page looks"), and `logo_url` / `header_bg` / `footer_bg` leave `settings.json`. Site-level `seo` **stays in `settings.json`** — see "Explicit debt".

---

## Restrictions

### Scope (prohibited)
- No new dependencies, no adapter, no backend, no API/CMS. Data stays build-time JSON.
- `src/data/api/menu.json`, `combos.json`, `promotions.json` are untouched — their declarative `card` keys stay exactly as they are.
- The card design-key contract is out of scope: no change to `src/storefront/menu/cards/registry.ts`, to the `data-product` / `data-combo` / `data-promotion` payloads, nor to the `data-product-detail-host` dialog contract.
- `settings.json` keeps every business/operations field: `name`, `phone`, `address`, `geo`, `whatsapp`, `timezone`, `currency`, `language`, `delivery`, `payment_methods`, `max_order_quantity`, `social_media`, `google_maps`, `business_hours`, `tags`, `seo`.
- No change to the 44 pre-rendered product dialogs, to `src/storefront/menu/product-detail.astro`, or to the remote GAS endpoint mode in `src/storefront/data/endpoints.js`.

### Style / code
- Technical artifacts (files, code, comments, this document) in English.
- Every new/changed zod schema keeps `.strict()`; every data file keeps the `{ "data": ... }` wrapper (`decorations.json` is currently flat — `theme.json` standardizes on the wrapper).
- New data keys are declared in the schema first; `src/storefront/types/menu.ts` is updated in the same task (there is no `tsc` to catch the drift).
- Reuse the existing patterns only: `ENDPOINTS` fixture entry → `resolveLocal` → `loadStorefront` → props. No new service layer, no context/providers.
- Config reaches components as props — never re-introduce `Astro.slots` for layout configuration.

### Quality
- `pnpm build` → 4 pages, zero errors after **every** phase.
- Parity on `dist/menu/index.html` against the pre-F1 baseline: DOM structure and all metrics identical — `data-has-range` 5/38, `data-template-card` 43, `data-combo-card` 2, `data-promotion-card` 1, root-class counts 1/8/16/5/13, `data-rail-urls` 2, `data-maki-urls` 2, "Alitas Fondo" 1, "Cócteles Vertical" 1.
  Excluded from parity (intentional by this plan): (a) documentation comments, (b) `<style>` rule order, (c) the brand/share strings and gallery/landing `alt` texts that F3 changes on purpose.
- `pnpm smoke` → 28 PASS, with only the pre-existing browser-extension console-warning failure (the warning list must match the baseline log).

### Process
- **Pre-flight, before F1:** `pnpm build && mkdir -p /tmp/theme-baseline && cp dist/menu/index.html /tmp/theme-baseline/menu.html`, then `pnpm preview --port 4322` and `pnpm smoke > /tmp/smoke-base.log`. Re-run both if more than one session elapses.
- One task = one checkbox = one focused commit. A phase closes only when its `Cierre` line holds, with observed output — never a claimed result.
- Mark tasks `- [x]` **with the commit hash in this file** before reporting a phase or launching the next one. This file is the live state record.
- Any failed check becomes one "Needs your decision" result naming the blocker; no silent retries and no skipping a failing phase.

---

## F1 — Foundation: `theme.json` replaces `decorations.json`

**Objective:** one source of truth for page presentation, killing the `header_bg`/`header_background` duplication **and** the typo that leaves 3 of 4 pages without a footer background.

- [x] Create `src/data/api/theme.json` with `{ "data": { "page": { "background", "header_bg", "footer_bg" }, "blocks": {} } }`, migrating `background` → `page.background`, `header_background` → `page.header_bg`, `footer_background` → `page.footer_bg` and `blocks` verbatim from `src/data/api/decorations.json` (src/data/api/decorations.json: add the `{data}` wrapper, rename the two background keys) — ✅ verified: `blocks` byte-identical, values `/bg.png` / `null` / `null` preserved. Committed in `09808e9`.
- [x] Create `src/storefront/schemas/theme.schema.ts` exporting `themePageSchema` and `themeFileSchema` (both `.strict()`), mirroring the `blocks` record from `decorationItemSchema`, and export it from `src/storefront/schemas/index.ts:42` (src/storefront/schemas/theme.schema.ts, src/storefront/schemas/index.ts:42) — ✅ legacy `block1/block3/block6` keys dropped (they belonged to the deleted file). Committed in `09808e9`.
- [x] Swap the fixture entry at `src/storefront/data/endpoints.js:88-99`: key `decorations` → `theme`, `fixture: 'theme.json'`, `schema: themeFileSchema`, and a fallback shaped `{ data: { page: { background: …, header_bg: null, footer_bg: null }, blocks: {} } }` (src/storefront/data/endpoints.js:88) — ✅ import swapped too. Committed in `09808e9`.
- [x] Rename `getDecorations()` → `getTheme()` and update its JSDoc plus the `loadMenu` return union/destructuring at `src/storefront/services/menu.service.js:330-335` and `:374-388` (src/storefront/services/menu.service.js:334) — ✅ **deviation recorded**: the fixture is `{data:…}`-wrapped, so `getTheme()` unwraps `.data` (same pattern as `getGallery()` at `:409`); without it the first build failed with `Cannot read properties of undefined (reading 'background')`. Committed in `09808e9`.
- [x] Update the `decorations` key to `theme` in the `loadStorefront` docs and error fallback at `src/storefront/services/index.js:28` and `:45` (src/storefront/services/index.js:45) — ✅ `...menuPayload` spread carries the new key through unchanged. Committed in `09808e9`.
- [x] Replace `interface Decorations` with `interface Theme { page: …; blocks?: … }` and fix its doc comment at `src/storefront/types/menu.ts:200-213` (src/storefront/types/menu.ts:203) — ✅ legacy `block1/block3/block6` members dropped with the schema. Committed in `09808e9`.
- [x] Rewire the four pages to `theme.page.*` and `theme.blocks`: `src/pages/menu.astro:127-129` (drop the `?? settings?.header_bg` / `?? settings?.footer_bg` fallbacks) and `:139-202`, `src/pages/index.astro:155`, `src/pages/galeria.astro:175`, `src/pages/enlaces.astro:121` — the last three currently read the non-existent `decorations?.footer_bg` key (src/pages/index.astro:155, src/pages/galeria.astro:175, src/pages/enlaces.astro:121) — ✅ typo path dead; all 4 pages now read `theme.page.footer_bg`. Committed in `09808e9`.
- [x] Retire the old file: delete `src/data/api/decorations.json` and `src/storefront/schemas/decorations.schema.ts`, then update the stale references in `src/storefront/menu/blocks/menu-block.astro:14,18` and `src/storefront/menu/blocks/decoration-renderer.astro:6` (src/storefront/menu/blocks/menu-block.astro:14) — ✅ only remaining `decorations.json` mention is the intentional "former `decorations.json`" note in `theme.schema.ts:7`. Committed in `09808e9`.

**Cierre (observed 2026-10-26):** `pnpm build` → 4 pages; `grep -rn "decorations" src/` returns only historical prose (no imports, no keys); `grep -rn "footer_bg" src/pages/` returns only `theme.page.footer_bg`; menu HTML **byte-identical** to `/tmp/theme-baseline/menu.html` (all 9 metrics match: 38/5 range, 43 template, 2 combo, 1 promotion, 3 rail-urls, 4 maki-urls, 1 Alitas, 1 Cócteles).

---

## F2 — `settings.json` loses its presentation keys

**Objective:** `logo_url`, `header_bg`, `footer_bg` move out of settings; the layout components receive a `theme` prop once, so F4/F5 do not re-thread it.

- [x] Add `brand: { "logo_url" }` to `src/data/api/theme.json` and a `brandSchema` to `src/storefront/schemas/theme.schema.ts` (src/data/api/theme.json) — ✅ `themeBrandSchema` in file; committed in `09808e9`.
- [x] Remove `logo_url`, `header_bg`, `footer_bg` from `src/data/api/settings.json:83-86` **and** from `restaurantSettingsSchema` in `src/storefront/schemas/settings.schema.ts:107-111` in the same commit (the schema is `.strict()`, so the file and the schema must move together) (src/storefront/schemas/settings.schema.ts:107) — ✅ committed in `09808e9`.
- [x] Remove the same three fields from `interface RestaurantSettings` at `src/storefront/types/menu.ts:321-325` (src/storefront/types/menu.ts:321) — ✅ committed in `09808e9`.
- [x] Drop the hardcoded `logo_url` / `header_bg` / `footer_bg` assignments from the v1→v2 normalizer at `src/storefront/services/menu.service.js:194-196` (src/storefront/services/menu.service.js:194) — ✅ committed in `09808e9`.
- [x] Thread a `theme` prop into `src/storefront/layout/menu-page.astro:42-54` (`Header` + `Footer`) and into `src/storefront/layout/footer.astro:41-57` / `src/storefront/layout/site-header.astro:13-26`, replacing `settings?.logo_url` with `theme.brand.logo_url` (src/storefront/layout/menu-page.astro:42) — ✅ the `footerBg`/`headerBg` props were retired in the same edit; committed in `09808e9`.
- [x] Rewire the logo reads on the three pages that pass `settings` directly: `src/pages/index.astro:81,151-155`, `src/pages/galeria.astro:35,171-175`, `src/pages/enlaces.astro:39,46,117-121` (the last uses `meta.logo_url || settings?.logo_url` as a fallback chain) (src/pages/enlaces.astro:39) — ✅ all three `<SiteHeader>`/`<Footer>` calls now thread `theme`; the dead `footerBg` prop was dropped; enlaces fallback is `meta.logo_url || theme?.brand?.logo_url`; committed in `09808e9`.
- [x] Update `src/storefront/layout/header.astro:46-47` so `logoUrl` comes from `theme.brand.logo_url` and `headerBg` from `theme.page.header_bg` only — the `explicitHeaderBg ?? settings?.header_bg` fallback chain disappears (src/storefront/layout/header.astro:46) — ✅ committed in `09808e9`.

**Cierre (observed 2026-10-26):** `pnpm build` → 4 pages; `grep -rn "settings?.logo_url\|settings.logo_url\|settings?.header_bg\|settings?.footer_bg" src/` → **0 hits**; menu HTML **byte-identical** to `/tmp/theme-baseline/menu.html` (`diff -q` → no differences); `logo.png` present in all 4 `dist/` pages (it was missing from 3 before task 6).

---

## F3 — Brand text and share message become data

**Objective:** remove every wrong-brand string (currently shipped in the production bundle) and make the share text configurable.

- [x] Add `share: { "title", "text", "label", "button_title" }` to `src/data/api/theme.json`, with `shareSchema` in `src/storefront/schemas/theme.schema.ts` and the matching type in `src/storefront/types/menu.ts` (src/data/api/theme.json) — ✅ **deviation**: `ENDPOINTS.theme.fallback` (`src/storefront/data/endpoints.js:94-107`) was updated in the same commit, because `share` is REQUIRED in the `.strict()` `themeFileSchema` and the documented contract says the fallback must satisfy the entry's schema. Committed in `262310a`.
- [x] Make `src/storefront/ui/share-button.astro:13-27` accept `title`, `text`, `label` and `buttonTitle` props, deleting the hardcoded `'Sazón Digital'` / `'¡Mira este delicioso menú! 🍜🏮'` at `:23,26,37-38` (src/storefront/ui/share-button.astro:37) — ✅ the copy reaches the bundled client script through `data-share-title` / `data-share-text` (a frontmatter value is invisible to `<script>`); defaults are the generic, brand-free `Compartir` / `Compartir este menú`, and `title`/`text` are only set when non-empty. Committed in `9215a71`.
- [x] Pass `theme.share` into `<ShareButton />` from `src/storefront/layout/header.astro:153` (src/storefront/layout/header.astro:153) — ✅ verified in `dist/menu/index.html`: `data-share-title="Pizzas Valery"`, `data-share-text="¡Mira este delicioso menú! 🍕"`. Committed in `f439a8c`.
- [x] Replace every wrong-brand fallback with a value derived from data (`settings.name` / `seo.site_name`): `src/storefront/layout/header.astro:41` (`"Mr Sushi"`), `src/storefront/layout/site-header.astro:25`, `src/storefront/layout/Layout.astro:31`, `src/storefront/ui/review-modal.astro:24`, `src/pages/index.astro:50-52`, `src/pages/enlaces.astro:37` (src/storefront/layout/header.astro:41) — ✅ **deviations**: (a) `Layout.astro:37` `'SAZÓN DIGITAL'` fixed too (same objective, not listed — output-neutral because `seo` always ships); (b) `review-modal` now renders its `<h3>` only when a name exists (its `''` default would otherwise print `¿Disfrutás ?`); (c) `index.astro:52` `siteTitle` left as-is: it carries no brand literal, only the stale `Sushi y delivery en Lima` tail (see Log). Committed in `1937843`.
- [x] Correct the stale brand in data: the 6 `"… — Sazón Digital"` `alt` values in `src/data/api/gallery.json:9,18,39,48,57,66` and `"Sábado de Promo — Sazón Digital"` at `src/data/api/landing.json:59` (src/data/api/gallery.json:9) — ✅ 6 + 1 replacements → `… — Pizzas Valery`. Committed in `f0bc1a6`.
- [x] Run the brand audit: `grep -rn "Sazón Digital\|Mr Sushi\|Sushi artesanal\|🍜\|🏮" src/` → 0 hits, and confirm `grep -c "Sazón Digital" dist/menu/index.html` → 0 (src/storefront/ui/share-button.astro) — ✅ observed 2026-10-26: both audits → **0 hits** (no commit: audit-only task).

**Cierre (observed 2026-10-26):** `pnpm build` → 4 pages; brand audit **0 hits in `src/`** and **0 in `dist/menu/index.html`**; the only region of `dist/menu/index.html` that differs from the baseline is the ShareButton block (common prefix 8 606 B + common suffix 521 209 B = one contiguous region: the `data-share-*` attributes, the comment and the share script) — metrics unchanged: 38/5 `data-has-range`, 43 template, 2 combo, 1 promotion, 3 rail-urls, 4 maki-urls, 1 Alitas, 1 Cócteles.

---

## F4 — Header actions become a configurable list

**Objective:** the hardcoded Galería link and the share button become data-driven actions (`link` | `share` | `whatsapp`), so adding or removing a button is a data edit.

- [ ] Add `header: { "actions": [ … ] }` to `src/data/api/theme.json` with a discriminated `headerActionSchema` (`type: 'link' | 'share' | 'whatsapp'`) in `src/storefront/schemas/theme.schema.ts` and the union type in `src/storefront/types/menu.ts` (src/data/api/theme.json)
- [ ] Create `src/storefront/layout/header-actions.astro` rendering the action list, reusing the existing icons (`src/storefront/icons/images.astro`, `src/storefront/icons/share-2.astro`) and the `ShareButton` component (src/storefront/layout/header-actions.astro)
- [ ] Replace the hardcoded Galería anchor at `src/storefront/layout/header.astro:140-152` and `<ShareButton />` at `:153` with `<HeaderActions actions={theme.header.actions} … />` (src/storefront/layout/header.astro:140)
- [ ] Document in `src/storefront/schemas/theme.schema.ts` that `site-header.astro:41-62` navigation links are routing, not configurable actions, and leave them out of `header.actions` (src/storefront/schemas/theme.schema.ts)
- [ ] Contract check: inject `"type": "accion-inexistente"` into an action in `src/data/api/theme.json`, confirm `pnpm build` fails with the zod enum error, then restore the file (src/data/api/theme.json)

**Cierre:** `pnpm build` → 4 pages after the restore; the contract check produced a real `Invalid option: …` build failure; menu HTML parity shows the same link markup for the default action set.

---

## F5 — Header layout becomes configurable

**Objective:** logo position and brand-name visibility are data, not code.

- [ ] Add `header.layout: { "logo_position": "left" | "center", "show_name": boolean }` to `src/data/api/theme.json`, with `headerLayoutSchema` in `src/storefront/schemas/theme.schema.ts` and the type in `src/storefront/types/menu.ts` (src/data/api/theme.json)
- [ ] Apply `logo_position` in `src/storefront/layout/header.astro:57-58` (the `flex-col md:flex-row items-center` container gets order/justify driven by the config) (src/storefront/layout/header.astro:57)
- [ ] Gate the brand `<h1>` at `src/storefront/layout/header.astro:88-93` on `header.layout.show_name`, keeping `aria-*` and heading hierarchy valid when hidden (src/storefront/layout/header.astro:88)
- [ ] Visual probe: flip `logo_position` to `"center"` and `show_name` to `false` in `src/data/api/theme.json`, build, confirm both render correctly in `dist/menu/index.html`, then restore the defaults (src/data/api/theme.json)

**Cierre:** `pnpm build` → 4 pages; the probe showed both states rendering; after restore, menu HTML parity green.

---

## F6 — Verification and regression net

**Objective:** prove the whole plan with the same evidence bar used for the card refactor.

- [ ] Regenerate the baseline comparison and the full metric report: `pnpm build` + the parity script over `dist/menu/index.html` (metrics: 5/38/43/2/1, roots 1/8/16/5/13, rails 2, maki 2, alitas 1, cócteles 1), listing any diff outside the excluded categories (dist/menu/index.html)
- [ ] Start `pnpm preview --port 4322`, run `pnpm smoke`, and diff the console-warning list against `/tmp/smoke-base.log` — expect 28 PASS and only the pre-existing extension warnings (scripts/smoke.mjs)
- [ ] Re-run the zod contract check end to end: an unknown `page.header_bg` value and an unknown `actions[].type` must both fail the build, with the file restored afterwards (src/data/api/theme.json)
- [ ] Dead-reference audit: `grep -rn "decorations\.json\|decorationsFileSchema\|getDecorations\|settings?.logo_url" src/` → 0 hits (src/)
- [ ] Update this plan file: every completed task `- [x]` with its commit hash, and record the final parity/smoke output in the `## Log` below (doc/plan-theme-ui.md)

**Cierre:** build 4 pages, parity green with only the intentional diffs, smoke 28 PASS with the baseline warning list, all audits 0 hits, plan file fully checked off.

---

## Explicit debt (not planned)

- **Per-page SEO overrides for `/menu`.** Not planned: site-level `seo` stays in `settings.json`, and `<Layout title="Menú">` already composes with `seo.title_template` (`src/storefront/layout/Layout.astro:26-30`). Moving SEO into `theme.json` would re-create the responsibility mix this plan removes. Reopen only if a page needs metadata that the title + template cannot express.
- **Tailwind arbitrary values embedded in decoration data** (`containerClass` / `class` in `theme.blocks`, e.g. `md:-right-48`, `min-w-[300px]`). Data is driving styling through class strings; the fix is design tokens / named layout presets, which is a separate refactor.
- **Admin visual editor over an iframe** (previous session's proposal). Requires a write path — an Astro endpoint with an adapter, or git + rebuild — plus auth if it must run in production. Backend is not in the stack.
- **44 pre-rendered product dialogs** (~349 KB, 65% of the menu HTML). Pre-existing architecture, deliberately preserved; converting to a single client-filled dialog trades no-JS content for payload size.
- **Remote GAS endpoint mode** (`endpoints.js` `mode: 'auto'`) and its v1→v2 normalizer beyond the three removed keys — untouched.

---

## Log

- 2026-10-26 — Plan written. No tasks executed yet; F1 not started.
- 2026-10-26 — **F1 + F2 complete, commit `09808e9` on branch `theme-ui`** (branched from `main` @ `f88b985`). Deviations from plan process, recorded honestly: (a) F1 and most of F2 were already applied in the working tree by a previous session without commits, with F1/F2 changes interleaved in 8 shared files — splitting them into per-phase commits would have required fabricating an unverified intermediate state, so both phases shipped as **one commit** instead of one-per-task; (b) F2 task 6 was completed this session (the 3 pages still passed the dead `footerBg` prop to `Footer` and no `theme` to `SiteHeader` — logo was missing from index/galeria/enlaces in `dist/`); (c) pre-flight baseline `/tmp/theme-baseline/menu.html` was preserved from 10:37 and is valid (card tweaks at 09:46–09:53 predate it); `/tmp/smoke-base.log` does NOT exist — smoke baseline must be regenerated in F6. Evidence: build 4 pages, F1/F2 audits 0 hits, menu HTML byte-identical to baseline, logo restored on all 4 pages. **User's card-visual tweaks (6 card files) are intentionally left uncommitted in the working tree — they predate the baseline, are not part of this plan, and were not staged into `09808e9`.**
- 2026-10-26 — **F3 complete, commits `262310a` → `f0bc1a6` (5 commits, one per task as the Process section requires).** Observed: build 4 pages after every commit; brand audits 0 hits in `src/` and in `dist/menu/index.html`; the sole `dist/` diff region vs the baseline is the ShareButton block (prefix+suffix accounting proves one contiguous change); metrics unchanged. Deviations recorded in the tasks: schema-required `share` forced an `endpoints.js` fallback update in task 1; `Layout.astro:37` `'SAZÓN DIGITAL'` and the empty-name `<h3>` guard added in task 4; share text emoji 🍜🏮 → 🍕 because the audit forbids those emoji anywhere under `src/` (and `theme.json` lives there). **Left in `index.astro:52` on purpose:** `${restaurantName} — Sushi y delivery en Lima` — wrong copy for a pizza site but not a brand string, not in the audit domain, and unreachable while `settings.seo.title` ships; flagged as candidate debt, not silently changed. User's 6 card files remain uncommitted and untouched.
