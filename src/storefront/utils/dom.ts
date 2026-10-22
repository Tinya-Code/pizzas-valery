/**
 * dom — the shared readers for JSON `data-*` attributes.
 *
 * Cards, the product dialog, the layout scaler and the page all hand payloads
 * to client scripts through serialized attributes; every copy of this reader
 * collapsed into the functions below (F4/F5).
 *
 * Client only: nothing here runs during server rendering.
 */
import type { BusinessHours, MenuProduct } from '../types/menu';

/**
 * Parse a JSON attribute.
 *
 * @returns the parsed value, or `null` when the attribute is missing or invalid
 */
export function readJson(element: Element | null, attribute: string): any;

/**
 * Parse a JSON attribute with a fallback for a missing/invalid payload.
 *
 * @returns the parsed value, or `fallback` when the attribute is missing or invalid
 */
export function readJson<T>(element: Element | null, attribute: string, fallback: T): T;

export function readJson<T>(element: Element | null, attribute: string, fallback?: T): any {
  const raw = element?.getAttribute(attribute);
  if (!raw) return fallback ?? null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback ?? null;
  }
}

/** `readJson(element, 'data-product')` — the payload every card exposes. */
export function readProduct(element: Element | null): MenuProduct | null {
  return readJson<MenuProduct | null>(element, 'data-product', null);
}

/**
 * `#business-hours-data` — the opening-hours payload the page embeds for the
 * cart and checkout scripts; they must not fetch settings in the browser (F5).
 *
 * `null` when the schedule never arrived, which `isOpenAt()` treats as
 * "restaurant open" — the same semantics the client-side fetch had.
 */
export function readBusinessHours(): BusinessHours | null {
  return readJson<BusinessHours | null>(
    document.getElementById('business-hours-data'),
    'data-business-hours',
    null,
  );
}
