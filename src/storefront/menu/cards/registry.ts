/**
 * registry.ts — single source of truth mapping declarative card design keys
 * to their Astro components.
 *
 * A design key IS the component filename without `.astro` (the nomenclature).
 * The keys are owned by the data schemas (`PRODUCT_CARD_DESIGNS` in
 * `schemas/menu.schema.ts`, `COMBO_CARD_DESIGNS` / `PROMOTION_CARD_DESIGNS` in
 * `schemas/offers.schema.ts`) and the `Record` types below are EXHAUSTIVE, so
 * both sides of the contract stay in sync:
 *
 *   - unknown key in JSON      → zod rejects the file at build time
 *   - key added to the enum w/o → TS errors here (missing Record entry)
 *     a registered component
 *
 * To add a new card design:
 *   1. create the component under the matching folder (product/combo/promotion)
 *   2. add its key (the filename) to the schema enum
 *   3. register it in the matching Record below
 *   4. reference it from data (`categories[].card` / `combo.card` / `promotion.card`)
 *
 * Every design OWNS its root element and the client contract
 * (`data-template-card`/`data-has-range`/`data-product` for products,
 * `data-combo-card`/`data-combo`, `data-promotion-card`/`data-product`) — the
 * registry never wraps designs in extra markup.
 */
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import ProductRow from './product/product-row.astro';
import ProductCard from './product/product-card.astro';
import ProductCardPizzaRange from './product/product-card-pizza-range.astro';
import ProductCardPizzaRangeImage from './product/product-card-pizza-range-image.astro';
import ProductCardBebidas from './product/product-card-bebidas.astro';
import ProductSizeCard from './product/product-size-card.astro';
import ComboCard from './combo/combo-card.astro';
import ComboCardPizza from './combo/combo-card-pizza.astro';
import PromotionCard from './promotion/promotion-card.astro';
import PromotionCardPizza from './promotion/promotion-card-pizza.astro';

import type {
  ProductCardDesign,
  ProductCardState,
  ComboCardDesign,
  PromotionCardDesign,
  CategoryCardMap,
} from '../../types/menu';

/** design key → product card component (exhaustive over PRODUCT_CARD_DESIGNS). */
export const PRODUCT_CARD_REGISTRY: Record<ProductCardDesign, AstroComponentFactory> = {
  'product-row': ProductRow,
  'product-card': ProductCard,
  'product-card-pizza-range': ProductCardPizzaRange,
  'product-card-pizza-range-image': ProductCardPizzaRangeImage,
  'product-card-bebidas': ProductCardBebidas,
  'product-size-card': ProductSizeCard,
};

/** design key → combo card component (exhaustive over COMBO_CARD_DESIGNS). */
export const COMBO_CARD_REGISTRY: Record<ComboCardDesign, AstroComponentFactory> = {
  'combo-card': ComboCard,
  'combo-card-pizza': ComboCardPizza,
};

/** design key → promotion card component (exhaustive over PROMOTION_CARD_DESIGNS). */
export const PROMOTION_CARD_REGISTRY: Record<PromotionCardDesign, AstroComponentFactory> = {
  'promotion-card': PromotionCard,
  'promotion-card-pizza': PromotionCardPizza,
};

/**
 * Default design per product-state — used when a category declares no `card`
 * map (or omits the state). Mirrors the historical TemplateCard defaults.
 */
export const DEFAULT_PRODUCT_CARD_DESIGN: Record<ProductCardState, ProductCardDesign> = {
  'flat-with-image': 'product-row',
  'flat-no-image': 'product-row',
  'range-with-image': 'product-card',
  'range-no-image': 'product-card',
};

/** Default design when a combo/promotion declares no `card` key. */
export const DEFAULT_COMBO_CARD_DESIGN: ComboCardDesign = 'combo-card';
export const DEFAULT_PROMOTION_CARD_DESIGN: PromotionCardDesign = 'promotion-card';

/** Product-state of one product: price range × image presence. */
export function productCardState(product: {
  price_range: unknown;
  image?: { url?: string } | null;
}): ProductCardState {
  if (product.price_range) {
    return product.image?.url ? 'range-with-image' : 'range-no-image';
  }
  return product.image?.url ? 'flat-with-image' : 'flat-no-image';
}

/**
 * Resolve the design key for one product-state: the category's declarative
 * map wins per state, unmapped states fall back to the default design.
 */
export function resolveProductCardDesign(
  state: ProductCardState,
  card?: CategoryCardMap,
): ProductCardDesign {
  return card?.[state] ?? DEFAULT_PRODUCT_CARD_DESIGN[state];
}
