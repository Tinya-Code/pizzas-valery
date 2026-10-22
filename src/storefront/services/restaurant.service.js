import { getRestaurantInfo } from './menu.service.js';
import { isSchemaViolationError } from '../schemas';

/**
 * Fetch and shape the restaurant profile and settings for build time.
 * @returns {Promise<{
 *   info: any,
 *   settings: import('../types/menu.js').RestaurantSettings | null,
 *   restaurant: import('../types/menu.js').RestaurantProfile | null,
 *   rawHours: import('../types/menu.js').BusinessHours | undefined,
 *   businessHours: import('../types/menu.js').BusinessHours
 * }>}
 */
export async function getRestaurantData() {
  const info = await getRestaurantInfo().catch((error) => {
    // Contract violations must fail the build — only transport failures fall back.
    if (isSchemaViolationError(error)) throw error;
    console.warn('[RestaurantService] could not load restaurant info.', error);
    return null;
  });

  const settings = info?.data ?? null;

  const restaurant = settings
    ? {
        name: settings.name,
        slug: settings.slug,
        phone: settings.phone,
        address: settings.address,
        location: settings.geo ?? null,
      }
    : null;

  const businessHours = settings?.business_hours ?? {};

  return {
    info,
    settings,
    restaurant,
    rawHours: settings?.business_hours,
    businessHours,
    googleMapsUrl: settings?.google_maps ?? null,
  };
}
