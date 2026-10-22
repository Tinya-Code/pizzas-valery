/**
 * Cart data shapes — the lines `CartService` builds client-side.
 *
 * Kept apart from `menu.ts`: the cart is its own domain (F7 folders), and the
 * sidebar script is the consumer that renders these lines.
 */
import type { PriceRangeEntry } from './menu';

/** One cart line as produced by `CartService.addItem()`. */
export interface CartLine {
  /** Line id: `<productId>` or `<productId>-<qty>-<price>` for range options. */
  id: string;
  originalProductId: string;
  name: string;
  /** Unit price already resolved from the entry or the flat product price. */
  price: number;
  quantity: number;
  /** Copied from `product.image.url` (v2); unused by the current UI. */
  image_url?: string;
  /** Present when the line was picked from a price range. */
  selectedEntry?: PriceRangeEntry;
}
