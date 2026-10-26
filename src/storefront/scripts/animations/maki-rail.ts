/**
 * Vertical decorative "maki" rail — ported from the old block-1 `<script>`.
 *
 * Every block carrying `data-maki-urls` (and a `[data-maki-container]` cell)
 * gets its container filled with the configured image sources, cycling the
 * list until the container is covered. Each image is stacked below the
 * previous one using its ACTUAL rendered height (measured after load), so
 * mixed image sizes/aspect ratios work — no hardcoded image dimensions.
 *
 * Only images that fit COMPLETELY inside the container are shown: as soon as
 * an image would be cut off, it is dropped (and no further images are added).
 * The remaining stack is vertically centered in the container.
 *
 * Rails are filled strictly ONE AFTER ANOTHER (DOM order), sharing a single
 * global image order: an image that didn't fit in one rail is the FIRST one
 * shown in the next rail, so the sequence (pizza → lasagna → pan → …) never
 * restarts from the beginning on each div.
 */

const RAIL_CONFIG = {
  /** Rail image width in px; each image's height follows its own aspect ratio. */
  imageWidth: 400,
  /** Below this container width the rail shifts further left (mobile). */
  mobileBreakpoint: 468,
  leftDesktop: -160,
  leftMobile: -225,
  gap: 25,
  /** Safety cap so a pathological container can never loop forever. */
  maxImages: 50,
};

/** Element currently allowed to append images (only one rail fills at a time). */
let turnOwner: Element | null = null;
/** Rails waiting for their turn, in DOM order. */
const turnQueue: Array<() => void> = [];
/** Position in the GLOBAL image order (shared by every rail on the page). */
let globalIndex = 0;

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

  let attempts = 0;
  let stackedHeight = 0;
  let lastMobile: boolean | null = null;
  /** Set when an image no longer fits — stops any further filling. */
  let closed = false;
  /** Next image of THIS rail, as an index into the global order. */
  let cursor = 0;
  let started = false;
  let holdsTurn = false;
  let queued = false;
  /** True while the last appended image is still loading (one in flight at most). */
  let inFlight = false;

  /** Hand the fill turn to the next waiting rail (DOM order). */
  const pump = () => {
    const next = turnQueue.shift();
    if (next) next();
  };

  const release = () => {
    if (!holdsTurn) return;
    holdsTurn = false;
    if (turnOwner === container) {
      turnOwner = null;
      // The global order advances exactly up to what this rail actually showed.
      globalIndex = Math.max(globalIndex, cursor);
    }
    pump();
  };

  const runTurn = () => {
    queued = false;
    if (!container.isConnected) {
      pump();
      return;
    }
    if (turnOwner && turnOwner !== container) {
      // Somebody else took the turn meanwhile — wait at the back again.
      queued = true;
      turnQueue.push(runTurn);
      return;
    }
    turnOwner = container;
    holdsTurn = true;
    fill();
  };

  /** Take the fill turn when free; otherwise queue (once) behind the current rail. */
  const ensureTurn = (): boolean => {
    if (holdsTurn) return true;
    if (turnOwner && turnOwner.isConnected && turnOwner !== container) {
      if (!queued) {
        queued = true;
        turnQueue.push(runTurn);
      }
      return false;
    }
    turnOwner = container;
    holdsTurn = true;
    return true;
  };

  /**
   * Recompute every image's `top`:
   * 1. drop each image (and the ones after it) that would be cut off by the
   *    container height — it must not be shown;
   * 2. vertically center the stack of images that do fit.
   */
  const place = () => {
    const limit = container.offsetHeight;
    const { gap } = RAIL_CONFIG;
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLElement[];
    closed = false;

    // Pass 1 — how many leading images fit completely (gap included)?
    let top = 0;
    let keep = imgs.length;
    for (let i = 0; i < imgs.length; i += 1) {
      const height = imgs[i].offsetHeight;
      const spacing = i > 0 ? gap : 0;
      if (limit > 0 && top + spacing + height > limit) {
        keep = i;
        closed = true;
        break;
      }
      top += spacing + height;
    }
    if (closed) imgs.slice(keep).forEach((img) => img.remove());

    // Pass 2 — place the survivors, centered vertically.
    stackedHeight = top;
    let y = limit > 0 ? Math.max(0, (limit - stackedHeight) / 2) : 0;
    for (let i = 0; i < keep; i += 1) {
      if (i > 0) y += gap;
      imgs[i].style.top = `${y}px`;
      y += imgs[i].offsetHeight;
    }
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
    // One image in flight at a time: wait for its load before appending more.
    if (inFlight) return;
    const height = container.offsetHeight;
    const width = container.offsetWidth;
    if (height === 0 || width === 0 || closed || stackedHeight >= height) {
      release();
      return;
    }
    if (attempts >= RAIL_CONFIG.maxImages) {
      release();
      return;
    }
    // Images are appended by ONE rail at a time, so the global order stays intact.
    if (!ensureTurn()) return;
    if (!started) {
      cursor = globalIndex;
      started = true;
    }

    const isMobile = width < RAIL_CONFIG.mobileBreakpoint;
    if (isMobile !== lastMobile) align(isMobile);

    const image = document.createElement('img');
    const left = isMobile ? RAIL_CONFIG.leftMobile : RAIL_CONFIG.leftDesktop;

    image.src = urls[cursor % urls.length];
    attempts += 1;

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
      inFlight = false;
      place(); // may DROP this image if it doesn't fit completely
      // Only a VISIBLE image consumes its place in the global order — an
      // image that didn't fit keeps its turn, so the next rail starts with it.
      if (image.isConnected) cursor += 1;
      fill();
    };

    image.addEventListener('load', settle, { once: true });
    // A broken source must not stall the stack: drop it and try the next URL.
    image.addEventListener(
      'error',
      () => {
        if (settled) return;
        settled = true;
        inFlight = false;
        image.remove();
        cursor += 1; // skip the broken URL in the global order
        fill();
      },
      { once: true },
    );

    inFlight = true;
    container.appendChild(image);
    if (image.complete) settle();
  };

  /** Re-measure the container: re-filter what fits and re-center, then top up. */
  const reflow = () => {
    place();
    fill();
  };

  window.addEventListener('resize', reflow, { passive: true });

  // The grid (the maki container's parent) decides the rail height.
  if (typeof ResizeObserver !== 'undefined') {
    const grid = container.parentElement;
    if (grid) new ResizeObserver(reflow).observe(grid);
  }

  fill();
}

/** Initialize every maki rail under `root` (default: the whole document). */
export function initMakiRail(root: ParentNode = document): void {
  root.querySelectorAll('[data-maki-urls], [data-maki-container]').forEach(setup);
}
