# Menu card design system

Slot-based, template-ready card architecture: `TemplateCard` routes each product to a
named design slot by state (price range × image), and every design is a swappable
component owning its own root and client contract. Porting this menu to another
project means editing `src/pages/menu.astro` — the wiring file — not the components.

## Quick path — customize a block's design

1. Create a design component in `src/storefront/menu/cards/product/` that owns the
   client contract (`data-template-card`, `data-has-range`, `data-product` on its root).
2. Open `src/pages/menu.astro` and find the block (block-1 … block-7).
3. Replace the router inside that block's `<fragment slot="card">`, passing the state
   slot you want to override:

   ```astro
   <fragment slot="card">
     {(product, canOrder) => (
       <TemplateCard product={product} canOrder={canOrder}>
         <fragment slot="range-with-image">
           {(product, canOrder) => <MyPizzaCard product={product} canOrder={canOrder} />}
         </fragment>
       </TemplateCard>
     )}
   </fragment>
   ```

4. Verify: `pnpm build && node scripts/smoke.mjs` — expects 41 cards, 43 dialog hosts,
   card click opens the dialog, sticky label `12 Unidades`.

block-6 in `menu.astro` is the live demo of this pattern.

## Architecture

| Piece | Role |
|-------|------|
| `cards/template-card.astro` | State router: resolves state → slot → default design |
| `cards/product/product-row.astro` | Default design for flat-price products (with/without image) |
| `cards/product/product-card.astro` | Default design for price-range products (with/without image) |
| `cards/combo/template-combo-card.astro` | Combo router (image-only states) |
| `cards/combo/combo-card.astro` | Default combo design |
| `cards/promotion/template-promotion-card.astro` | Promotion router (image-only states) |
| `cards/promotion/promotion-card.astro` | Default promotion design |
| `blocks/menu-block.astro` | Section skeleton; per-item `card` slot → `TemplateCard` fallback |
| `blocks/block-combos.astro` / `block-promotions.astro` | Slider blocks; same slot pattern |
| `pages/menu.astro` | **The port point**: declares the `card` wiring for all 10 blocks |

## Product design slots

`TemplateCard` dispatches on two axes — price range × image presence:

| Slot | Default fallback |
|------|------------------|
| `flat-with-image` | `ProductRow` (thumbnail branch) |
| `flat-no-image` | `ProductRow` (no-thumb branch) |
| `range-with-image` | `ProductCard` |
| `range-no-image` | `ProductCard` (empty media circle) |

Combo and promotion routers dispatch on image only (`flat-with-image` /
`flat-no-image`); combos and promotions are always flat-priced.

## Rules

- **Every design owns its root** and the client contract attributes — the page's click
  delegation reads them. A custom design must carry them:
  - Products: `data-template-card`, `data-has-range` (`"true"`/`"false"`), `data-product`
  - Combos: `data-combo-card`, `data-combo` (a combo never opens the dialog)
  - Promotions: `data-promotion-card`, `data-product`
- **Slots are function children** (Astro 7 removed `let:` scoped slots): the block
  pre-renders each item via `Astro.slots.render('card', [item, canOrder])` and the
  router does the same for state slots.
- **Declarations are opt-in per block**: a block without a `card` slot falls back to
  the router defaults, which are byte-identical to the legacy markup.
- **Adding a design** = one file in the domain folder. Swapping it in globally = one
  line (import + fallback in the router); per block = the slot declaration above.

## Checklist — after touching cards or blocks

- [ ] `pnpm build` passes (4 pages).
- [ ] `node scripts/smoke.mjs` all green (41 cards, 43 dialogs, click → dialog, 9b).
- [ ] Custom designs carry the client contract attributes on their root.
- [ ] `data-*` payloads unchanged if the page script reads them.

## References

- Client contract consumers: click delegation in `src/pages/menu.astro` (`<script>`),
  `readProduct` in `src/storefront/utils/dom`.
- API v2 product/price_range shape: `doc/proposal-api-v2.md`.
