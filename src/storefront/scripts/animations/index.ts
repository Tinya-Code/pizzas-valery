/**
 * Animations registry — one init call for every client-side behavior the
 * menu blocks use.
 *
 * To add a new animation:
 *   1. create `src/scripts/animations/<name>.ts` exporting `init<Name>(root?)`
 *   2. import it here and call it inside `initAnimations`
 */
import { initMakiRail } from './maki-rail';
import { initParallax } from './parallax';

/** Initialize every registered animation under `root`. */
export function initAnimations(root: ParentNode = document): void {
  initMakiRail(root);
  initParallax(root);
}
