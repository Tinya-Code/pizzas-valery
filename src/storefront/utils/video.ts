/**
 * video.ts — shared video helpers (pure functions, no build-time globals).
 *
 * Consolidates logic that previously lived duplicated in four places:
 *   - `enlaces/block-video.astro`     (configured player embeds, build-time)
 *   - `home/home-media.astro`         (configured player embeds, build-time)
 *   - `pages/galeria.astro`           (gallery lightbox links, build-time)
 *   - `ui/gallery-modal.astro`        (gallery lightbox player, client bundle)
 *
 * Keep this module FREE of `import.meta.glob` (build-time, must stay at each
 * call site) — `import.meta.env` is fine (Vite statically replaces it in both
 * the SSR and client bundles).
 */

/** Canonical playback flags accepted by the configured-player embeds. */
export interface VideoPlayback {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

/** Local-provider aliases accepted in JSON blocks (`"provider": "self"` → local). */
export const PROVIDER_ALIASES: Record<string, string> = {
  self: 'local',
  repo: 'local',
  mp4: 'local',
  file: 'local',
};

/** Human-readable provider labels (fallback: generic "Video"). */
export const PROVIDER_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  local: 'Video',
};

/** JSON aspect key (`"16:9"`) → CSS aspect ratio (`"16 / 9"`). */
export const ASPECTS: Record<string, string> = {
  '16:9': '16 / 9',
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '4:5': '4 / 5',
};

/** Applies a provider alias map entry, passing unknown providers through. */
export function normalizeProvider(provider?: string): string {
  return PROVIDER_ALIASES[provider ?? ''] ?? provider ?? '';
}

/**
 * Effective CSS aspect ratio + orientation for a provider/aspect pair.
 * TikTok defaults to vertical (9:16); every other provider to 16:9.
 */
export function resolveAspect(
  provider: string,
  aspect?: string,
): { aspectKey: string; cssAspect: string; vertical: boolean } {
  const aspectKey = ASPECTS[aspect ?? '']
    ? (aspect as string)
    : provider === 'tiktok'
      ? '9:16'
      : '16:9';
  return {
    aspectKey,
    cssAspect: ASPECTS[aspectKey],
    vertical: aspectKey === '9:16' || aspectKey === '4:5',
  };
}

/** Extracts a YouTube video ID from a bare ID or any common URL shape. */
export function extractYouTubeId(v = ''): string {
  const m = String(v).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : String(v).trim();
}

/** Extracts a TikTok video ID from a bare ID or any common URL shape. */
export function extractTikTokId(v = ''): string {
  const m = String(v).match(/\/video\/(\d+)/);
  return m ? m[1] : String(v).trim();
}

/** Normalises a Facebook video reference (bare ID or URL) to a full URL. */
export function extractFacebookUrl(v = ''): string {
  const s = String(v).trim();
  return /^https?:\/\//i.test(s) ? s : `https://www.facebook.com/video/${s}`;
}

/**
 * Parametrised player embed URL — the "configured" style used by JSON blocks
 * that declare `video_id` plus playback flags (block-video, home-media).
 * Returns null for local/unknown providers.
 *
 * Domain invariant enforced here: browsers only autoplay muted videos, so
 * `autoplay` forces mute regardless of the `muted` flag.
 */
export function buildConfiguredEmbedUrl(
  provider: string,
  videoId: string | undefined,
  playback: VideoPlayback = {},
): string | null {
  const autoplay = playback.autoplay ? 1 : 0;
  const mute = playback.autoplay || playback.muted ? 1 : 0;
  const loop = playback.loop ? 1 : 0;
  const controls = playback.controls !== false ? '1' : '0';

  switch (provider) {
    case 'youtube': {
      const vid = extractYouTubeId(videoId);
      const params = new URLSearchParams({
        rel: '0',
        autoplay: String(autoplay),
        mute: String(mute),
        modestbranding: '1',
        playsinline: '1',
        controls,
      });
      if (loop) {
        params.set('loop', '1');
        params.set('playlist', vid); // required by YouTube for loop to work
      }
      return `https://www.youtube.com/embed/${vid}?${params}`;
    }
    case 'tiktok': {
      // Official TikTok player: supports autoplay / loop / controls params.
      const vid = extractTikTokId(videoId);
      const params = new URLSearchParams({
        autoplay: String(autoplay),
        loop: String(loop),
        controls,
        progress_bar: '1',
        play_button: '1',
        volume_control: '1',
        fullscreen_button: '1',
        timestamp: '0',
        music_info: '0',
        description: '0',
        rel: '0',
        native_context_menu: '0',
        closed_caption: '0',
      });
      return `https://www.tiktok.com/player/v1/${vid}?${params}`;
    }
    case 'facebook': {
      const href = encodeURIComponent(extractFacebookUrl(videoId));
      return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&autoplay=${autoplay}&mute=${mute}`;
    }
    default:
      return null;
  }
}

/**
 * Gallery-style embed — takes a full social POST url and returns the simplest
 * embeddable player (privacy-enhanced YouTube, TikTok v2, Facebook plugin),
 * with no playback params beyond `autoplay`. Unrecognised URLs pass through
 * unchanged; empty/missing URLs return null. Used by the gallery page and its
 * lightbox modal.
 */
export function buildGalleryEmbedUrl(
  url: string | undefined,
  opts: { autoplay?: boolean } = {},
): string | null {
  const href = url ?? '';
  if (!href) return null;

  const ytMatch = href.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}${opts.autoplay ? '?autoplay=1' : ''}`;
  }

  const ttMatch = href.match(/tiktok\.com\/(?:@[^/]+\/video\/|v\/)(\d+)/);
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;

  if (href.includes('facebook.com') && !href.includes('facebook.com/plugins/video.php')) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=0${opts.autoplay ? '&autoplay=1' : ''}`;
  }

  return href;
}

/**
 * Resolves an asset path from JSON against a Vite-imported asset map
 * (the result of `import.meta.glob(…, { query: '?url', import: 'default' })`).
 *
 *   - remote / protocol-relative / data: URIs pass through untouched
 *   - absolute paths resolve from `public/` (respecting Astro `base`)
 *   - relative paths are looked up in the assets map (`src/assets/…`)
 *
 * Each call site keeps its own `import.meta.glob` (build-time module graph)
 * and passes the map in; extension-aware maps (videos only, or all media)
 * are the call site's decision.
 */
export function resolveFromAssets(
  path: string | undefined,
  assets: Record<string, string>,
): string | null {
  if (!path) return null;
  const p = String(path).trim();
  if (/^(https?:)?\/\//i.test(p) || p.startsWith('data:')) return p;
  if (p.startsWith('/')) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    return `${base}${p}`;
  }
  const clean = p.replace(/^\.?\//, '').replace(/^src\/assets\//, '');
  const key = Object.keys(assets).find((k) => k.endsWith(`/src/assets/${clean}`));
  return key ? assets[key] : null;
}
