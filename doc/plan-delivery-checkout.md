# Plan — Delivery zones, order note, and real-time location

**Source:** session analysis of `src/data/api/settings.json` (2026-10-26). The
`delivery.zones` key exists in the data but is **dead** — no component reads it,
and the delivery fee is a flat number applied to every order.

**Stack context:** Astro 5 static build (no adapter, no backend, no CMS — data is
build-time JSON under `src/data/api/`), Tailwind v4, zod `.strict()` schemas as
the build-time contract, `pnpm build` (4 pages), `pnpm smoke` (needs
`pnpm preview --port 4322`). The project has **no `tsc` and no `astro check`** —
type regressions are only caught by reading or by the editor. The order is placed
via a `wa.me` deep link built client-side; there is **no backend**.

**Current state (verified, not assumed):**
- `settings.delivery.zones` → `z.array(z.string())` in `settings.schema.ts:44`,
  mapped from the remote `delivery_zones` in `menu.service.js:183`, and **read by
  no component**. Truly dead.
- The delivery fee is a flat `settings.delivery.fee` (`5`) that flows into
  `sidebar-cart.astro:46` as `data-delivery-fee`, is cached in
  `cart.service.js` (`#deliveryFee`), and is added to every order total.
- **Fee `0` is currently conflated with "delivery disabled"**: `whatsapp.js:179`
  gates the delivery line on `deliveryEnabled && deliveryFee > 0`, and
  `sidebar-cart.astro:282` hides the delivery row on `fee > 0`. So a `fee` of `0`
  would make a real delivery order read as "Retiro en tienda". This is the bug
  the new `charge_delivery` key (task D2) fixes.
- The WhatsApp order message (`whatsapp.js:165-201`) contains only Name,
  Address (or "Retiro en tienda") and Payment method. **No note field, no
  location.**

---

## Decisions taken (from the user, 2026-10-26)

1. **Zone model:** zones by **name + tariff** — `{ id, name, fee }`. No
   geocalculation, no external APIs.
2. **Zone resolution:** a **manual zone selector** in the checkout. The customer
   picks their zone from a list; the cart recomputes the delivery fee on pick.
3. **Seed data:** ship **3 example zones** in `settings.json` so the selector is
   visible; the user edits them later.
4. **Default fee before a zone is picked:** the **flat `settings.delivery.fee`
   (S/ 5)** stays as the initial/default fee.
5. **Disable delivery independently of the fee:** add a **new dedicated key**
   (`charge_delivery`) so "do not charge delivery" is separate from "fee is 0".
   `fee: 0` must mean **free delivery** (still a delivery order, not pickup).
6. **Scope:** all **three** features get implemented, but this document is the
   implementation plan of record first.

---

## Restrictions

### Scope (prohibited)
- No new dependencies, no adapter, no backend, no API/CMS. Data stays build-time
  JSON; the order still ships as a `wa.me` deep link.
- `src/data/api/menu.json`, `combos.json`, `promotions.json`, `gallery.json`,
  `landing.json` are untouched.
- The card design-key contract, the 44 pre-rendered product dialogs, and the
  remote GAS endpoint mode stay out of scope.
- No change to the `decorations`/`theme.json` work from `plan-theme-ui.md`.

### Style / code
- Technical artifacts (files, code, comments, this document) in English.
- Every new/changed zod schema keeps `.strict()`; every data file keeps the
  `{ "data": ... }` wrapper.
- New data keys are declared in the schema first; `src/storefront/types/menu.ts`
  is updated in the same task (there is no `tsc` to catch the drift).
- Reuse existing patterns only: `ENDPOINTS` fixture entry → `resolveLocal` →
  `loadStorefront` → props. Config reaches components as props.
- Geolocation (feature C) must degrade gracefully: denied permission or
  unavailable API must never block placing the order.

### Quality
- `pnpm build` → 4 pages, zero errors after **every** phase.
- `pnpm smoke` → 28 PASS, only the pre-existing browser-extension console
  warnings (the warning list must match the clean-HEAD baseline; it is
  environmental, 0 hits in `src/`).
- The default-state DOM must stay parity-clean: with the **default fee, no zone
  selected, and no note/location entered**, the rendered checkout and the
  generated WhatsApp message must be identical to today's output.

### Process
- One task = one checkbox = one focused commit. A phase closes only when its
  `Cierre` line holds, with observed output — never a claimed result.
- Mark tasks `- [x]` **with the commit hash in this file** before reporting a
  phase. This file is the live state record.
- Any failed check becomes one "Needs your decision" result naming the blocker;
  no silent retries and no skipping a failing phase.

---

## D — Delivery zones with per-zone pricing

**Objective:** make `delivery.zones` real: a typed zone list, a checkout selector,
and a cart that recomputes the fee for the chosen zone. Separately fix the
`fee: 0` vs "disabled" conflation with a dedicated key.

- [x] **D1 — Extend the schema and seed zones.** Change
  `settings.delivery.zones` from `z.array(z.string())` to a strict array of
  `zoneSchema = z.object({ id: z.string(), name: z.string(), fee: z.number() }).strict()`
  in `src/storefront/schemas/settings.schema.ts`, mirror the shape in
  `src/storefront/types/menu.ts` (`DeliveryZone` + `DeliveryConfig.zones`), and
  seed 3 example zones in `src/data/api/settings.json`
  (e.g. `lima-centro` S/5, `surco` S/7, `villa` S/9). Update the remote
  normalizer at `menu.service.js:183` so a remote array of strings still maps to
  zones (map string → `{ id: slug(name), name, fee: flat fee }`) instead of
  producing the wrong type. (settings.schema.ts, types/menu.ts, settings.json,
  menu.service.js) — commit `833a853`
- [x] **D2 — Add `charge_delivery` (independent of fee).** Add
  `settings.delivery.charge_delivery: boolean` (strict) defaulting `true`, and
  thread it through the schema/type/data. Rationale (decision 5): today `fee: 0`
  is read as "no delivery". `charge_delivery: false` = genuinely no delivery fee
  (order still a delivery); `fee: 0` + `charge_delivery: true` = free delivery
  (still shown as a delivery order, not pickup). (settings.schema.ts,
  types/menu.ts, settings.json) — commit `690ec79` (also emitted by the remote
  adapter in menu.service.js, which must satisfy the strict schema)
- [x] **D3 — Zone selector in the checkout.** Render a zone `<select>` (or
  pill list) in `checkout-form.astro` from `settings.delivery.zones`, shown only
  when `deliveryEnabled`. Seed it with the default flat fee when no zone is
  picked. Emit `data-zones` (JSON) on the form so the client script can read it.
  (checkout-form.astro) — commit `b7aae02` (assumption: also hidden when
  `charge_delivery: false`, since no tariff would apply)
- [x] **D4 — Cart recomputes the fee on zone pick.** On zone change, update
  `cartService`'s delivery fee to the chosen zone's `fee` (reusing
  `cartService.configure({ deliveryFee })`), re-render the cart totals, and
  persist the choice. Respect `charge_delivery: false` (fee forced to `0` and
  the delivery line suppressed even at `0`). (checkout-form.astro,
  cart.service.js, sidebar-cart.astro) — commit `acea73b` (`#deliveryFee` is
  now a `ReactiveValue`; the drawer owns the boot-time fee because the checkout
  script runs first)
- [x] **D5 — Carry the zone into the order message.** Extend
  `OrderMessage.withTotals`/`withCustomer` to accept the chosen `zone.name` and
  render a `Zona:` line under "Datos de entrega" when a delivery order has a
  zone. Keep default-state output identical when no zone is chosen.
  (whatsapp.js, checkout-form.astro) — commit `e3832c8`

**Cierre:** `pnpm build` → 4 pages; selector renders the 3 seeded zones; picking
a zone updates the cart delivery fee and total; `fee: 0` with
`charge_delivery: true` still renders as a delivery order (not pickup);
`charge_delivery: false` suppresses the fee line; default state (no zone picked)
is byte-identical to today.

---

## N — Order note field

**Objective:** let the customer add free-text instructions to the order that
reach the restaurant in the WhatsApp message.

- [ ] **N1 — Optional note input in the checkout.** Add an optional
  "Indicaciones" textarea/input to `checkout-form.astro` (rendered for both
  delivery and pickup), e.g. placeholder "Ej: sin cebolla, timbre roto, dejar en
  portería". Not required; empty = no line emitted. (checkout-form.astro)
- [ ] **N2 — Persist and pass the note.** Read the note on submit (reuse the
  `local-storage` helper like name/address), and pass it to the builder via a new
  `OrderMessage.withNote(note)`. (checkout-form.astro)
- [ ] **N3 — Render the note in the message.** In `whatsapp.js`, add a
  `Nota:` / `Indicaciones:` line under "Datos de entrega" only when the note is
  non-empty. Default state (empty note) emits no extra line. (whatsapp.js)

**Cierre:** `pnpm build` → 4 pages; a typed note appears as an `Indicaciones:`
line in the generated WhatsApp message; an empty note adds no line; default
state byte-identical.

---

## L — Real-time location button

**Objective:** let the customer attach their current location (a Google Maps
link) to the delivery order, degrading gracefully when permission is denied.

- [ ] **L1 — Location button in the checkout.** Add a "Enviar mi ubicación"
  button next to the address field (delivery orders only) in
  `checkout-form.astro`, with a clear inline status (idle / getting /
  attached / error / denied). (checkout-form.astro)
- [ ] **L2 — Geolocation capture.** On click, use
  `navigator.geolocation.getCurrentPosition` to build a
  `https://www.google.com/maps?q=lat,lng` link. On denied/unavailable, show a
  non-blocking message and **never** prevent placing the order.
  (checkout-form.astro)
- [ ] **L3 — Carry the location into the message.** Pass the location URL to the
  builder via `OrderMessage.withLocation(url)` and render a
  `Ubicación: <maps link>` line when present. Default state (no location) emits
  no line. Also keep the existing address text line. (whatsapp.js,
  checkout-form.astro)

**Cierre:** `pnpm build` → 4 pages; clicking the button attaches a Maps link that
appears as `Ubicación:` in the message; denied permission shows a graceful
message and the order still sends; default state byte-identical.

---

## V — Verification and regression net

**Objective:** prove all three features with the same evidence bar as the theme
plan.

- [ ] **V1 — Default-state parity.** Build and confirm that with the default
  fee, no zone selected, and no note/location, the checkout DOM and the generated
  WhatsApp message are identical to today's (the 3 new UI affordances render but
  emit no message lines until used).
- [ ] **V2 — Per-zone fee.** Pick each seeded zone and confirm the cart delivery
  fee and total update to that zone's `fee`; confirm the chosen `Zona:` line
  appears in the message.
- [ ] **V3 — `charge_delivery` / `fee: 0` matrix.** Confirm: `charge_delivery:
  true` + `fee: 0` → free delivery, still rendered as a delivery order (not
  pickup); `charge_delivery: false` → fee line suppressed entirely.
- [ ] **V4 — Note + location.** Confirm a typed note renders `Indicaciones:`,
  a captured location renders `Ubicación:`, and both are omitted when empty.
- [ ] **V5 — Zod contract check.** Inject an invalid zone (e.g. `fee` as a
  string) and an invalid `charge_delivery` (e.g. a string), confirm `pnpm build`
  fails naming the path, then restore. (settings.json)
- [ ] **V6 — Smoke.** `pnpm preview --port 4322` + `pnpm smoke` → 28 PASS with
  only the pre-existing extension warnings (scripts/smoke.mjs).
- [ ] **V7 — Update this plan file.** Every completed task `- [x]` with its
  commit hash, and record the final parity/smoke output in the `## Log` below.

**Cierre:** build 4 pages; default-state parity green; per-zone fee and the
`charge_delivery`/`fee:0` matrix behave as specified; note and location render
only when used; zod contract check fails then restores; smoke 28 PASS; plan file
fully checked off.

---

## Explicit debt (not planned)

- **Geographic zones (radius/polygon + distance-based fee).** Requires
  geocalculation and GPS on every order; the user chose name+tariff with a manual
  selector. Reopen only if distance-based pricing is actually needed.
- **Delivery-zone-aware business rules** (e.g. "no delivery outside X hours for
  zone Y", minimum order per zone). Not requested; `business_hours` stays global.
- **Persisting the zone/note/location server-side.** There is no backend; all
  three features ride the `wa.me` deep link only.
- **`fee: 0` = free delivery vs. "contact for delivery price".** If the restaurant
  wants "delivery, price by arrangement", that is a copy/label concern, not a
  code path; not planned.

---

## Log

- 2026-10-26 — Plan written. Decisions taken from the user: name+tariff zones,
  manual selector, 3 seeded example zones, flat S/5 default fee, a dedicated
  `charge_delivery` key so `fee: 0` means free delivery (not pickup), and all
  three features in scope with this MD as the implementation plan of record. No
  tasks executed yet; D not started.
- 2026-10-26 — **Phase D complete (D1-D5).** Commits: D1 `833a853`, D2
  `690ec79`, D3 `b7aae02`, D4 `acea73b`, D5 `e3832c8`. Observed evidence:
  `pnpm build` → 4 pages, zero errors after every task; dist renders the
  selector with `Delivery estándar — S/ 5.00` + `lima-centro/surco/villa`
  options; browser probe (headless CDP, 18/18 PASS) — default fee row
  `S/ 5.00`, total = subtotal + 5, picking `surco` → fee `S/ 7.00` and total
  `S/ 36.90`, message gains `Zona: Santiago de Surco`, clearing restores
  `S/ 5.00`, persisted zone `villa` restored after reload (`S/ 9.00`, select
  preselected), default message has no `Zona:`/`Indicaciones:`/`Ubicación:`
  lines and shows `Dirección:` (never `Retiro en tienda`). Matrix probe (6/6
  twice): `fee: 0` + `charge_delivery: true` → row visible `S/ 0.00`,
  total = subtotal, delivery order (address, not pickup); `charge_delivery:
  false` → row hidden, fee forced `S/ 0.00`, no `*Delivery:*` line, order still
  delivery. Assumption recorded: the zone selector also hides when
  `charge_delivery: false` (a tariff picker would be meaningless). Remote
  adapter (`toV2Settings`) emits `charge_delivery: true` — v1 GAS has no such
  flag; its flat fee was always charged.
