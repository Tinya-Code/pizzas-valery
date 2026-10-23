/**
 * Vertical decorative "maki" rail — ported from the old block-1 `<script>`.
 *
 * Every block carrying `data-maki-urls` (and a `[data-maki-container]` cell)
 * gets its container filled with the configured image sources, cycling the
 * list until the container is covered. Each image is stacked below the
 * previous one using its ACTUAL rendered height (measured after load), so
 * mixed image sizes/aspect ratios work — no hardcoded image dimensions.
 */

const RAIL_CONFIG = {
  /** Rail image width in px; each image's height follows its own aspect ratio. */
  imageWidth: 500,
  /** Below this container width the rail shifts further left (mobile). */
  mobileBreakpoint: 468,
  leftDesktop: -160,
  leftMobile: -225,
  /** Safety cap so a pathological container can never loop forever. */
  maxImages: 50,
};

function setup(target: Element): void {
  const container = (
    target.hasAttribute('data-maki-container')
      ? target
      : target.querySelector('[data-maki-container]')
  ) as HTMLElement | null;
  if (!container) return;

  if (container.hasAttribute('data-rail-ready')) return;
  container.setAttribute('data-rail-ready', 'true');

  const block = target.closest('section') ?? target;

  let urls: string[] = [];
  try {
    urls = JSON.parse(
      container.getAttribute('data-rail-urls') ||
        block.getAttribute('data-maki-urls') ||
        '[]',
    );
  } catch {
    urls = [];
  }
  if (urls.length === 0) return;

  let appended = 0;
  let stackedHeight = 0;
  let lastMobile: boolean | null = null;

  /** Recompute every image's `top` from its real rendered height. */
  const place = () => {
    let top = 0;
    container.querySelectorAll('img').forEach((img) => {
      img.style.top = `${top}px`;
      top += img.offsetHeight;
    });
    stackedHeight = top;
  };

  /** Apply the breakpoint-dependent horizontal offset to every image. */
  const align = (isMobile: boolean) => {
    const left = isMobile ? RAIL_CONFIG.leftMobile : RAIL_CONFIG.leftDesktop;
    container.querySelectorAll('img').forEach((img) => {
      img.style.left = `${left}px`;
    });
    lastMobile = isMobile;
  };

  /** Append ONE image; the next is chained from its load event (heights are only known after load). */
  const fill = () => {
    const height = container.offsetHeight;
    const width = container.offsetWidth;
    if (height === 0 || width === 0) return;
    if (stackedHeight >= height || appended >= RAIL_CONFIG.maxImages) return;

    const isMobile = width < RAIL_CONFIG.mobileBreakpoint;
    if (isMobile !== lastMobile) align(isMobile);

    const image = document.createElement('img');
    const left = isMobile ? RAIL_CONFIG.leftMobile : RAIL_CONFIG.leftDesktop;

    image.src = urls[appended % urls.length];
    appended += 1;

    image.alt = ''; // decorative rail
    image.style.position = 'absolute';
    image.style.width = `${RAIL_CONFIG.imageWidth}px`;
    image.style.minWidth = `${RAIL_CONFIG.imageWidth}px`;
    image.style.left = `${left}px`;

    // Cached images may already be complete AND still fire load — settle once.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      place();
      fill();
    };

    image.addEventListener('load', settle, { once: true });
    // A broken source must not stall the stack: drop it and try the next URL.
    image.addEventListener(
      'error',
      () => {
        if (settled) return;
        settled = true;
        image.remove();
        fill();
      },
      { once: true },
    );

    container.appendChild(image);
    if (image.complete) settle();
  };

  window.addEventListener('resize', fill, { passive: true });

  // The grid (the maki container's parent) decides the rail height.
  if (typeof ResizeObserver !== 'undefined') {
    const grid = container.parentElement;
    if (grid) new ResizeObserver(fill).observe(grid);
  }

  fill();
}

/** Initialize every maki rail under `root` (default: the whole document). */
export function initMakiRail(root: ParentNode = document): void {
  root.querySelectorAll('[data-maki-urls], [data-maki-container]').forEach(setup);
}
