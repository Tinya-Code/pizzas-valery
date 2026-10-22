/**
 * Vertical decorative "maki" rail — ported from the old block-1 `<script>`.
 *
 * Every block carrying `data-maki-urls` (and a `[data-maki-container]` cell)
 * gets its container measured, then one image every `imageHeight` px is
 * appended, cycling the configured sources.
 */

const BASE_MAKI_IMAGES = [
  { alt: 'Maki 2', left: -160, leftMobile: -225 },
  { alt: 'Maki 1', left: -160, leftMobile: -225 },
  { alt: 'Maki 3', left: -160, leftMobile: -225 },
];

const MAKI_CONFIG = {
  imageWidth: 500,
  imageHeight: 720,
  mobileBreakpoint: 468,
};

function setup(target: Element): void {
  const container = target.hasAttribute('data-maki-container')
    ? target as HTMLElement
    : target.querySelector<HTMLElement>('[data-maki-container]');
  if (!container) return;

  if (container.hasAttribute('data-rail-ready')) return;
  container.setAttribute('data-rail-ready', 'true');

  const block = target.closest('section') ?? target;

  let urls: string[] = [];
  try {
    urls = JSON.parse(
      container.getAttribute('data-rail-urls') ||
      block.getAttribute('data-maki-urls') ||
      '[]'
    );
  } catch {
    urls = [];
  }

  let renderedCount = 0;
  let renderedMobile: boolean | null = null;

  /** Rebuild the rail whenever the container size (or the sources) change. */
  const renderMakis = () => {
    const height = container.offsetHeight;
    const width = container.offsetWidth;

    if (height === 0 || width === 0 || urls.length === 0) return;

    const isMobile = width < MAKI_CONFIG.mobileBreakpoint;
    // +1 to ensure overlap/fill
    const maxImages = Math.floor(height / MAKI_CONFIG.imageHeight) + 1;

    if (maxImages === renderedCount && isMobile === renderedMobile) return;

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < maxImages; index++) {
      const base = BASE_MAKI_IMAGES[index % BASE_MAKI_IMAGES.length];
      const image = document.createElement('img');
      image.src = urls[index % urls.length];
      image.alt = base.alt;
      image.className = 'absolute min-w-[500px]';
      image.style.top = `${index * MAKI_CONFIG.imageHeight}px`;
      image.style.left = `${(isMobile ? base.leftMobile : base.left) ?? 0}px`;
      fragment.appendChild(image);
    }

    container.replaceChildren(fragment);
    renderedCount = maxImages;
    renderedMobile = isMobile;
  };

  window.addEventListener('resize', renderMakis, { passive: true });

  // The grid (the maki container's parent) decides the rail height.
  if (typeof ResizeObserver !== 'undefined') {
    const grid = container.parentElement;
    if (grid) new ResizeObserver(renderMakis).observe(grid);
  }

  renderMakis();
}

/** Initialize every maki rail under `root` (default: the whole document). */
export function initMakiRail(root: ParentNode = document): void {
  root.querySelectorAll('[data-maki-urls], [data-maki-container]').forEach(setup);
}
