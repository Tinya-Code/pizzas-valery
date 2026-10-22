/**
 * Entry-label helpers shared by the product dialog, the cart service and the
 * WhatsApp order message.
 *
 * The wording is API-owned: `price_range.units_label` carries the
 * singular/plural pair (e.g. `{ "one": "Unidad", "other": "Unidades" }`), and
 * a named-size entry (`entry.label`, e.g. "Familiar") wins over the unit
 * wording entirely. The Spanish pair below is only the last-resort fallback
 * for payloads that predate the field.
 */

/** Singular/plural unit wording shipped by the API. */
export interface UnitsLabel {
  one: string;
  other: string;
}

/** The subset of a price-range entry these helpers read. */
export interface EntryLike {
  qty?: number | string;
  price?: number | string;
  bonus?: string;
  label?: string;
}

const DEFAULT_UNITS: UnitsLabel = { one: "Unidad", other: "Unidades" };

/**
 * Human text for one selected entry: the entry's own `label` when present
 * ("Familiar"), otherwise `qty` plus the API-provided unit pair.
 */
export function entryLabel(
  entry: EntryLike | null | undefined,
  unitsLabel?: UnitsLabel | null,
): string {
  if (!entry) return "";
  if (entry.label) return String(entry.label);
  const units = unitsLabel ?? DEFAULT_UNITS;
  return `${entry.qty} ${Number(entry.qty) === 1 ? units.one : units.other}`;
}
