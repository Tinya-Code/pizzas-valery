/**
 * LocalStorage — thin typed wrapper around `window.localStorage`.
 *
 * Every access is guarded so the class can be imported safely in an Astro
 * server-rendered context, where `localStorage` does not exist.
 */
export class LocalStorage {
  #namespace;
  #storage;

  /**
   * @param {{ namespace?: string, storage?: Storage }} [options]
   *        `namespace` prefixes every key, keeping several apps on the same
   *        origin from overwriting each other.
   */
  constructor({ namespace = '', storage } = {}) {
    this.#namespace = namespace;
    this.#storage = storage ?? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null);
  }

  /**
   * @param {string} key
   * @returns {string}
   */
  #key(key) {
    return this.#namespace ? `${this.#namespace}:${key}` : key;
  }

  /**
   * @returns {boolean}
   */
  #available() {
    return Boolean(this.#storage);
  }

  /**
   * Read a value. JSON is parsed when possible, otherwise the raw string is
   * returned.
   * @template T
   * @param {string} key
   * @returns {T | null}
   */
  get(key) {
    if (!this.#available()) return null;

    const value = this.#storage.getItem(this.#key(key));
    if (value === null || value === undefined || value === '') return null;

    try {
      return JSON.parse(value);
    } catch {
      return /** @type {T} */ (value);
    }
  }

  /**
   * Write a value. Objects and arrays are serialised, strings are stored as is.
   * @param {string} key
   * @param {unknown} value
   * @returns {this}
   */
  set(key, value) {
    if (!this.#available()) return this;

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.#storage.setItem(this.#key(key), serialized);
    return this;
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    if (!this.#available()) return false;
    return this.#storage.getItem(this.#key(key)) !== null;
  }

  /**
   * @param {string} key
   * @returns {this}
   */
  remove(key) {
    if (!this.#available()) return this;
    this.#storage.removeItem(this.#key(key));
    return this;
  }

  /**
   * Remove every key owned by this instance (namespace scoped when set).
   * @returns {this}
   */
  clear() {
    if (!this.#available()) return this;

    if (!this.#namespace) {
      this.#storage.clear();
      return this;
    }

    const prefix = `${this.#namespace}:`;
    const doomed = [];
    for (let i = 0; i < this.#storage.length; i += 1) {
      const key = this.#storage.key(i);
      if (key && key.startsWith(prefix)) doomed.push(key);
    }
    for (const key of doomed) this.#storage.removeItem(key);
    return this;
  }
}

/** Shared instance with no namespace — the default store for the app. */
export const local = new LocalStorage();
