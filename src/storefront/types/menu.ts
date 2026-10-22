/**
 * Storefront data shapes — the API v2 contract (doc/proposal-api-v2.md §2).
 *
 * Runtime validation lives in `src/storefront/schemas/` (Zod): every fixture
 * is parsed at its loader boundary and a violation fails the build. Keep this
 * file in sync with those schemas — this file owns the DOCUMENTATION, the
 * schemas own the ENFORCEMENT.
 *
 * Every type is near-1:1 with the payload `menu.service.js` /
 * `restaurant.service.js` emit: v2 responses are self-contained (embedded
 * price ranges, real numbers, unified combo/promotion shape) and carry a
 * `seo` block. Pages load these values once and hand them to components as
 * props — components never fetch.
 */

/** One quantity option of an embedded price range. */
export interface PriceRangeEntry {
  /** Unit count. */
  qty: number;
  /** Unit price. */
  price: number;
  /** Optional bonus label rendered under the quantity (v1 raw value may be numeric). */
  bonus?: string | number;
  /** Display label for named sizes ("Familiar"); overrides the qty wording. */
  label?: string;
}

/** A product's size/quantity ladder, embedded in the product itself. */
export interface ResolvedPriceRange {
  id: string;
  name?: string;
  entries: PriceRangeEntry[];
  /** API-owned singular/plural unit wording ("Unidad"/"Unidades"). */
  units_label?: { one: string; other: string };
  /** Computed by the API — the UI derives nothing. */
  min_price: number;
  /** Computed by the API — the UI derives nothing. */
  max_price: number;
}

/** Per-item image (products carry an optional `cloudinary_id`). */
export interface MenuImage {
  url: string;
  alt: string;
  cloudinary_id?: string;
}

/** Optional per-item SEO overrides. */
export interface SeoBlock {
  title: string | null;
  description: string | null;
}

/** One product row (`menu` → `categories[].products[]`). */
export interface MenuProduct {
  id: string;
  slug?: string;
  name: string;
  description: string;
  image: MenuImage;
  /** Flat price, or `price_range.min_price` when a range exists. */
  price: number;
  /** Full embedded content; `null` for flat products (always present). */
  price_range: ResolvedPriceRange | null;
  /** Short suffix next to the price (e.g. `"x2"`); `null` when unused. */
  qty_label: string | null;
  is_recommended: boolean;
  is_hidden: boolean;
  category_id: string;
  seo?: SeoBlock;
}

/** One category rendered as a section (`menu` → `blocks[].categories[]`). */
export interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
  slug?: string;
  seo?: SeoBlock;
  block_id?: string;
  /** Always an array: `MenuService.getMenu()` normalises it. */
  products: MenuProduct[];
}

/** One menu block (`menu` → `data.blocks[]`), already normalised. */
export interface MenuBlock {
  id: string;
  categories: MenuCategory[];
}

/** Image shared by combos and promotions. */
export interface OfferImage {
  url: string;
  alt: string;
}

/** One combo (`combos` resource). */
export interface Combo {
  id: string;
  slug?: string;
  name: string;
  description: string;
  image: OfferImage;
  price: number;
  /** Combos never carry a compare-at price. */
  price_before: null;
  seo?: SeoBlock;
}

/** One promotion (`promotions` resource). */
export interface Promotion {
  id: string;
  slug?: string;
  name: string;
  description: string;
  image: OfferImage;
  /** Effective (discounted) selling price. */
  price: number;
  /** Compare-at price shown struck through; `null` when not discounted. */
  price_before: number | null;
  /** ISO date, optional — only when the API knows an expiry. */
  valid_until: string | null;
  seo?: SeoBlock;
}

/** Anything the cart accepts as a line (`add-to-cart` payload). */
export type OrderableProduct = MenuProduct | Combo | Promotion;

export type DecorationSlot = 'left' | 'right' | 'extra';
export type DecorationType = 'image' | 'rail' | 'group' | 'custom';

export interface BaseDecorationItem {
  slot: DecorationSlot;
  containerClass?: string;
}

export interface ImageDecorationItem extends BaseDecorationItem {
  type: 'image';
  src: string;
  alt?: string;
  class?: string;
  animation?: 'parallax' | string;
  attrs?: Record<string, string>;
}

export interface RailDecorationItem extends BaseDecorationItem {
  type: 'rail';
  items: string[];
  attrs?: Record<string, string>;
}

export interface GroupDecorationImage {
  src: string;
  alt?: string;
  class?: string;
  animation?: 'parallax' | string;
}

export interface GroupDecorationItem extends BaseDecorationItem {
  type: 'group';
  images: GroupDecorationImage[];
}

export type DecorationItem = ImageDecorationItem | RailDecorationItem | GroupDecorationItem;

/**
 * Ready-to-render decorations — loaded from `src/data/api/decorations.json`
 * (local mode) or a remote endpoint. Replace the JSON to customise per project.
 */
export interface Decorations {
  background: string;
  header_background?: string | null;
  footer_background?: string | null;
  blocks?: Record<string, DecorationItem[]>;
  block1?: { barco: string; makis: string[] };
  block3?: { alitasFondo: string; alitas2Fondo: string };
  block6?: { coctelesVertical: string };
}

/** One promotional flyer displayed in the delayed flyer modal. */
export interface FlyerItem {
  id: string;
  title: string;
  image: string;
  link?: string | null;
  alt?: string | null;
}

/** Configuration for delayed promotional flyers modal. */
export interface FlyersConfig {
  enabled: boolean;
  delay_seconds: number;
  show_once_per_session?: boolean;
  items: FlyerItem[];
}

/** Opening hours for one weekday (`business_hours.<day>`). */
export interface DaySchedule {
  isOpen: boolean;
  /** `"11:00"` — 24 h `HH:mm`. */
  open: string;
  /** `"22:30"` — 24 h `HH:mm`. */
  close: string;
}

/** ISO weekday keys used by `business_hours` (`mon` … `sun`). */
export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * Weekly schedule keyed by ISO weekday (`mon` … `sun`). A missing day means
 * "no data"; the accessors always guard with `?.` / `??`.
 */
export type BusinessHours = Partial<Record<WeekdayKey, DaySchedule>>;

/** `settings.whatsapp` — how the storefront opens WhatsApp. */
export interface WhatsappConfig {
  number: string;
  message_template: string | null;
}

/** `settings.geo` — restaurant coordinates. */
export interface Geo {
  lat: number;
  lng: number;
}

/** `settings.delivery` — delivery availability and pricing. */
export interface DeliveryConfig {
  enabled: boolean;
  fee: number;
  zones: string[];
}

/** `settings.social_media` — profile URLs (`null` when unset). */
export interface SocialMedia {
  tiktok: string | null;
  facebook: string | null;
  instagram: string | null;
  google_maps?: string | null;
}

/** Site-level SEO block shipped by `?json=settings`. */
export interface SiteSeo {
  site_name: string;
  title: string;
  title_template: string;
  description: string;
  keywords: string[];
  og_image: string | null;
  twitter_card: string;
  locale: string;
  canonical_url: string | null;
  json_ld: Record<string, unknown>;
}

/**
 * `settings` — the v2 settings payload (`?json=settings` → `data`), flat and
 * typed honestly: booleans are booleans, phones are strings, arrays are arrays.
 */
export interface RestaurantSettings {
  id?: string;
  name: string;
  slug?: string;
  phone: string;
  address: string;
  geo: Geo;
  whatsapp: WhatsappConfig;
  timezone: string;
  currency: string;
  /** UI locale (`"es"`); the v1 adapter defaults it. */
  language: string;
  delivery: DeliveryConfig;
  payment_methods: string[];
  max_order_quantity: number;
  social_media: SocialMedia;
  google_maps?: string | null;
  business_hours: BusinessHours;
  logo_url: string | null;
  /** Optional background image URL for the site header (`null` → CSS default). */
  header_bg: string | null;
  /** Optional background image URL for the site footer (`null` → CSS default). */
  footer_bg: string | null;
  tags: unknown[];
  seo: SiteSeo;
}

/** The profile the header and footer render — derived from the settings. */
export interface RestaurantProfile {
  name: string;
  slug?: string;
  phone: string;
  address?: string | null;
  location?: { lat?: number | null; lng?: number | null } | null;
}

/**
 * The full settings payload after `MenuService.getRestaurantInfo()` maps it
 * to the v2 shape. `null` when the request never resolved.
 */
export interface RestaurantInfo {
  data: RestaurantSettings;
}

/** Types of media supported by the gallery. */
export type GalleryItemType = 'image' | 'video' | 'embed';

/** One item in the gallery (image, direct video, or embedded iframe/player). */
export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  type?: GalleryItemType;
  url?: string;
  embed_html?: string;
  poster?: string;
  alt?: string;
  description?: string;
  aspect_ratio?: '16/9' | '9/16' | '1/1' | '4/3' | string;
}

/** Category group of gallery items. */
export interface GalleryCategory {
  id: string;
  name: string;
  description?: string;
  items: GalleryItem[];
}
