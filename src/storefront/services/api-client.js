/**
 * ApiClient — a pure HTTP builder: query-string builder + response cache +
 * request execution. It carries no endpoint configuration; the shared,
 * menu-API-pointed instance lives in `./api.js`.
 *
 * The builder is immutable: `with()` returns a NEW ApiClient, so calls can
 * be chained without mutating the shared client:
 *
 * ```js
 * const data = await api.with('json', 'menu').get();
 * const url  = api.with('json', 'price-range').with('lang', 'es').build();
 * ```
 *
 * GET responses are memoised per built URL (the equivalent of the old
 * `shareReplay(1)`), which makes several components share one request.
 */
export class ApiClient {
  /** @type {string} */
  #baseUrl;

  /** @type {URLSearchParams} */
  #params;

  /** @type {Record<string, string>} */
  #headers;

  /** Shared across clones so the cache survives a chained call. */
  #store;

  /**
   * @param {string} baseUrl
   * @param {{
   *   params?: URLSearchParams | Record<string, string>,
   *   headers?: Record<string, string>,
   *   cache?: boolean,
   *   store?: { enabled: boolean, entries: Map<string, Promise<any>> }
   * }} [options]
   */
  constructor(baseUrl, { params = {}, headers = {}, cache = true, store } = {}) {
    this.#baseUrl = String(baseUrl ?? '').replace(/\?+$/, '');
    this.#params = params instanceof URLSearchParams ? new URLSearchParams(params) : new URLSearchParams(params);
    this.#headers = { ...headers };
    this.#store = store ?? { enabled: cache, entries: new Map() };
  }

  /**
   * Clone this client carrying its params, headers and cache.
   * @param {URLSearchParams} params
   * @param {Record<string, string>} headers
   * @returns {ApiClient}
   */
  #clone(params, headers) {
    return new ApiClient(this.#baseUrl, { params, headers, store: this.#store });
  }

  /**
   * Append (or replace) a query parameter.
   * Passing `null`/`undefined` removes it.
   * @param {string} key
   * @param {string | number | null | undefined} value
   * @returns {ApiClient}
   */
  with(key, value) {
    const params = new URLSearchParams(this.#params);

    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }

    return this.#clone(params, this.#headers);
  }

  /**
   * Resolve the final URL.
   * @returns {string}
   */
  build() {
    const query = this.#params.toString();
    if (!query) return this.#baseUrl;

    return `${this.#baseUrl}${this.#baseUrl.includes('?') ? '&' : '?'}${query}`;
  }

  /**
   * Perform the request.
   * @param {RequestInit} [init]
   * @returns {Promise<any>}
   */
  async #request(init = {}) {
    const url = this.build();

    const response = await fetch(url, {
      ...init,
      headers: { ...this.#headers, ...(init.headers ?? {}) },
    });

    if (!response.ok) {
      throw new Error(`[ApiClient] ${response.status} ${response.statusText} → ${url}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * GET the built URL. Repeated calls for the same URL share one request.
   * @returns {Promise<any>}
   */
  get() {
    const url = this.build();

    if (!this.#store.enabled) {
      return this.#request();
    }

    const cached = this.#store.entries.get(url);
    if (cached) return cached;

    const pending = this.#request().catch((error) => {
      // Never cache a failure: the next caller should be able to retry.
      this.#store.entries.delete(url);
      throw error;
    });

    this.#store.entries.set(url, pending);
    return pending;
  }

  /**
   * POST a JSON body to the built URL.
   * @param {unknown} body
   * @returns {Promise<any>}
   */
  post(body) {
    return this.#request({
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...this.#headers },
    });
  }
}
