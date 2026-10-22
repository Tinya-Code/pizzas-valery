/**
 * Shared href alias resolver for the declarative block pages (landing, enlaces).
 *
 * Resolves symbolic href aliases against live settings at build time:
 *   "whatsapp"    → WhatsApp deep-link built from settings.whatsapp
 *   "instagram"   → settings.social_media.instagram
 *   "facebook"    → settings.social_media.facebook
 *   "tiktok"      → settings.social_media.tiktok
 *   "google_maps" → settings.google_maps
 *   "tel"         → tel:<settings.phone>
 *   "/...", "https://...", "tel:..." → passed through as-is
 *
 * @param {any} settings - The settings.data object from the storefront.
 * @returns {(alias: string, ctaMessage?: string) => string | null}
 */
import { WhatsApp } from '../utils/whatsapp.js';

export function buildHrefResolver(settings) {
  const whatsappNumber = settings?.whatsapp?.number ?? settings?.phone ?? '';
  const defaultMessage = settings?.whatsapp?.message_template ?? '';

  return function resolve(alias, ctaMessage) {
    if (!alias) return null;

    // Already an absolute URL or internal path — pass through.
    if (alias.startsWith('http') || alias.startsWith('/') || alias.startsWith('tel:')) {
      return alias;
    }

    switch (alias) {
      case 'whatsapp':
        return whatsappNumber
          ? WhatsApp.link(whatsappNumber, ctaMessage ?? defaultMessage)
          : null;
      case 'instagram':
        return settings?.social_media?.instagram ?? null;
      case 'facebook':
        return settings?.social_media?.facebook ?? null;
      case 'tiktok':
        return settings?.social_media?.tiktok ?? null;
      case 'google_maps':
        return settings?.google_maps ?? null;
      case 'tel':
        return settings?.phone ? `tel:${settings.phone}` : null;
      default:
        return alias;
    }
  };
}
