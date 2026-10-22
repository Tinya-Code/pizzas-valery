/**
 * ReactiveValue — minimal vanilla replacement for an Angular signal.
 *
 * Holds a single value, notifies subscribers on change and returns `this`
 * from every mutator so calls can be chained.
 *
 * @template T
 */
export class ReactiveValue {
  /** @type {T} */
  #value;

  /** @type {Set<(value: T, previous: T) => void>} */
  #listeners = new Set();

  /**
   * @param {T} initialValue
   */
  constructor(initialValue) {
    this.#value = initialValue;
  }

  /**
   * Current value.
   * @returns {T}
   */
  get() {
    return this.#value;
  }

  /**
   * Replace the value. No-op (and no notification) when nothing changed.
   * @param {T} nextValue
   * @returns {this}
   */
  set(nextValue) {
    if (Object.is(nextValue, this.#value)) return this;

    const previous = this.#value;
    this.#value = nextValue;

    for (const listener of [...this.#listeners]) {
      listener(nextValue, previous);
    }

    return this;
  }

  /**
   * Derive the next value from the current one.
   * @param {(current: T) => T} updater
   * @returns {this}
   */
  update(updater) {
    return this.set(updater(this.#value));
  }

  /**
   * Listen for changes.
   * @param {(value: T, previous: T) => void} listener
   * @param {{ immediate?: boolean }} [options]
   * @returns {() => void} unsubscribe
   */
  subscribe(listener, { immediate = false } = {}) {
    this.#listeners.add(listener);

    if (immediate) {
      listener(this.#value, this.#value);
    }

    return () => {
      this.#listeners.delete(listener);
    };
  }
}
