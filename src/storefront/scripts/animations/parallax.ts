/**
 * Scroll-driven viewport parallax for decorative images flagged with `data-anim="parallax"`.
 *
 * Behavior:
 * - The image stays in place until 80% of its height is visible in the viewport.
 * - Once past this 80% threshold, it glides downwards driven proportionally by the
 *   viewport scroll until it reaches the bottom of its container/section.
 * - The travel distance is clamped exactly to `containerHeight - imageHeight`
 *   to avoid container overflow.
 */

/**
 * Update one image's vertical offset from the current scroll position.
 */
function updateParallax(image: HTMLImageElement): void {
  const imageHeight = image.offsetHeight;
  if (imageHeight === 0) return;

  // Find containing bounds: column parent if it has height, or nearest section
  const parent = image.parentElement;
  const section = image.closest<HTMLElement>('section');
  const container = (parent && parent.offsetHeight > imageHeight) ? parent : (section ?? parent);
  if (!container) return;

  const containerHeight = container.offsetHeight;
  const maxTravel = Math.max(0, containerHeight - imageHeight);
  if (maxTravel === 0) return;

  const containerRect = container.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // Threshold: Start moving when 80% of the image is inside the viewport.
  // containerRect.top is the top boundary of the container where the image starts.
  // When containerRect.top reaches (viewportHeight - 0.8 * imageHeight), 80% is visible.
  const startY = viewportHeight - (imageHeight * 0.8);

  // End: container bottom reaches viewport bottom (flush before exiting)
  const endY = viewportHeight - containerHeight;

  const totalDistance = startY - endY;
  if (totalDistance <= 0) return;

  // Calculate distance travelled past the 80% visibility threshold
  const currentDistance = startY - containerRect.top;
  const progress = Math.max(0, Math.min(1, currentDistance / totalDistance));

  const offset = Math.round(progress * maxTravel);
  image.style.transform = `translate3d(0, ${offset}px, 0)`;
}

/** Bind the scroll/resize behavior to a single image (idempotent). */
function setup(image: HTMLImageElement): void {
  if (image.hasAttribute('data-parallax-ready')) return;
  image.setAttribute('data-parallax-ready', 'true');

  let isTicking = false;

  const onScroll = () => {
    if (isTicking) return;
    isTicking = true;
    window.requestAnimationFrame(() => {
      updateParallax(image);
      isTicking = false;
    });
  };

  const onResize = () => {
    updateParallax(image);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });

  // Initial calculation
  updateParallax(image);
}

/** Initialize every parallax image under `root` (default: the whole document). */
export function initParallax(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>('[data-anim="parallax"]').forEach(setup);
}
