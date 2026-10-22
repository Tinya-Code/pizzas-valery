/**
 * The canonical week — Monday first, with the Spanish labels the storefront
 * renders. The keys are the ISO weekday keys the v2 `business_hours` payload
 * uses (`mon` … `sun`). Single source for every days listing (footer, closed
 * modal) and for `isOpenAt()`.
 * @type {Array<{ key: string, label: string }>}
 */
export const WEEK_DAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

/**
 * Weekday key for a date: `Date.getDay()` runs Sunday = 0, `WEEK_DAYS`
 * runs Monday first.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function weekDayKey(date = new Date()) {
  return WEEK_DAYS[(date.getDay() + 6) % 7].key;
}

/**
 * Pure "is the restaurant open at this exact moment?" check against a raw
 * `business_hours` payload.
 *
 * Kept free of the service so the browser bundle can reuse it (the sidebar and
 * the checkout need it client-side, where the restaurant data is only loaded
 * on demand).
 *
 * A schedule that never arrived counts as open, exactly like Angular.
 *
 * @param {Record<string, any> | undefined | null} businessHours
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isOpenAt(businessHours, now = new Date()) {
  if (!businessHours) return true;

  const schedule = businessHours[weekDayKey(now)];

  if (!schedule || !schedule.isOpen) return false;

  const currentTime = now.getHours() * 100 + now.getMinutes();
  const [openH, openM] = String(schedule.open).split(':').map(Number);
  const [closeH, closeM] = String(schedule.close).split(':').map(Number);

  const openTime = openH * 100 + openM;
  const closeTime = closeH * 100 + closeM;

  return currentTime >= openTime && currentTime <= closeTime;
}
