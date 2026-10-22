/**
 * format — pure ports of the Angular pipes (`precio`, `timeFormat`).
 *
 * All formatters are locale-locked to `es-PE`, exactly like the original pipes,
 * and return an empty string for nullish or unparseable input.
 */

/**
 * Currency formatter for Peruvian Soles (PEN).
 *
 * ```js
 * precio(12.5) // "S/ 12.50"
 * ```
 *
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function precio(value) {
  if (value === null || value === undefined || value === '') return '';

  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return '';

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * 24 h clock time → `h:mm AM/PM`.
 *
 * ```js
 * timeFormat('19:30') // "7:30 PM"
 * timeFormat('0:15')  // "12:15 AM"
 * ```
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function timeFormat(value) {
  if (!value) return '';

  const [hoursStr, minutesStr] = String(value).split(':');
  let hours = Number.parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';

  if (Number.isNaN(hours)) return value;

  const period = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  hours = hours || 12;

  return `${hours}:${minutes} ${period}`;
}
