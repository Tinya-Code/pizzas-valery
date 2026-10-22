/**
 * WhatsApp — link builder for the wa.me deep links used by the storefront.
 *
 * Pure functions only: nothing here touches the DOM until `open()` is called,
 * so the class is safe to import in server-rendered code.
 */
import { entryLabel } from './entry-label.js';

export class WhatsApp {
  /**
   * Storefront country code: `wa.me` expects the international number with
   * no `+`, so this is the one place the prefix lives.
   * @type {string}
   */
  static COUNTRY_CODE = '51';

  /**
   * Strip everything that is not a digit from a phone number.
   * @param {string | number} phone
   * @returns {string}
   */
  static digits(phone) {
    return String(phone ?? '').replace(/\D+/g, '');
  }

  /**
   * Build a wa.me URL.
   *
   * @param {string} phone        Number as stored in the settings.
   * @param {string} message      Plain text; it is URL encoded automatically.
   * @param {{ countryCode?: string }} [options]
   *        Defaults to `COUNTRY_CODE` (`51`); the prefix is applied only when
   *        the number does not already start with it (keeps already-qualified
   *        numbers untouched).
   * @returns {string}
   */
  static link(phone, message, { countryCode = WhatsApp.COUNTRY_CODE } = {}) {
    let digits = WhatsApp.digits(phone);

    if (countryCode && !digits.startsWith(countryCode)) {
      digits = `${countryCode}${digits}`;
    }

    if (!digits) return '';

    const base = `https://wa.me/${digits}`;
    if (!message) return base;

    return `${base}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Open a conversation in a new tab. No-op during server rendering.
   * @param {string} phone
   * @param {string} message
   * @param {{ countryCode?: string, target?: string }} [options]
   * @returns {string} the generated URL
   */
  static open(phone, message, { countryCode = WhatsApp.COUNTRY_CODE, target = '_blank' } = {}) {
    const url = WhatsApp.link(phone, message, { countryCode });

    if (url && typeof window !== 'undefined') {
      window.open(url, target, 'noopener,noreferrer');
    }

    return url;
  }
}

/**
 * OrderMessage — fluent builder for the order text sent through WhatsApp.
 *
 * Every method returns `this`, so the message is assembled by concatenating
 * calls in the exact order the sections should appear:
 *
 * ```js
 * const message = new OrderMessage({ template: settings.message_template })
 *   .withItems(cart.items.get())
 *   .withTotals({ subtotal, deliveryFee, total, deliveryEnabled })
 *   .withCustomer({ name, address, paymentMethod })
 *   .build();
 *
 * WhatsApp.open(phone, message); // country code applied by the builder
 * ```
 */
export class OrderMessage {
  /**
   * Payment method → label shown in the message and the checkout UI.
   * Covers the four canonical ids plus the raw ids the API actually sends
   * (`efectivo`, `tarjeta`), so neither surface ever ships a lowercase word.
   */
  static PAYMENT_LABELS = {
    cash: 'Efectivo',
    efectivo: 'Efectivo',
    card: 'Tarjeta',
    tarjeta: 'Tarjeta',
    yape: 'Yape',
    plin: 'Plin',
  };

  #template;
  #items = [];
  #totals = null;
  #customer = null;
  #deliveryEnabled = true;

  /**
   * @param {{ template?: string, deliveryEnabled?: boolean }} [options]
   */
  constructor({ template = 'Hola, me gustaría ordenar:', deliveryEnabled = true } = {}) {
    this.#template = template;
    this.#deliveryEnabled = deliveryEnabled;
  }

  /**
   * Replace the opening line.
   * @param {string} template
   * @returns {this}
   */
  withTemplate(template) {
    this.#template = template;
    return this;
  }

  /**
   * @param {Array<{ quantity: number, name: string, price: number }>} items
   * @returns {this}
   */
  withItems(items) {
    this.#items = Array.isArray(items) ? items : [];
    return this;
  }

  /**
   * @param {{ subtotal: number, deliveryFee?: number, total: number, deliveryEnabled?: boolean }} totals
   * @returns {this}
   */
  withTotals({ subtotal, deliveryFee = 0, total, deliveryEnabled = this.#deliveryEnabled }) {
    this.#totals = { subtotal, deliveryFee, total };
    this.#deliveryEnabled = deliveryEnabled;
    return this;
  }

  /**
   * When `address` is empty the order is flagged as store pickup.
   * @param {{ name: string, address?: string | null, paymentMethod?: string }} customer
   * @returns {this}
   */
  withCustomer({ name, address = '', paymentMethod = '' }) {
    this.#customer = { name, address, paymentMethod };
    return this;
  }

  /**
   * @param {string} method
   * @returns {string}
   */
  static paymentLabel(method) {
    return OrderMessage.PAYMENT_LABELS[method] || method || '';
  }

  /**
   * @returns {string}
   */
  build() {
    let message = `${this.#template}\n\n`;

    for (const item of this.#items) {
      const lineTotal = Number(item.price) * Number(item.quantity);
      message += `• ${item.quantity}x ${item.name} - S/ ${lineTotal.toFixed(2)}\n`;
    }

    const { subtotal, deliveryFee, total } = this.#totals ?? {
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
    };

    if (this.#deliveryEnabled && deliveryFee > 0) {
      message += `\n*Subtotal: S/ ${Number(subtotal).toFixed(2)}*\n`;
      message += `*Delivery: S/ ${Number(deliveryFee).toFixed(2)}*\n`;
    }

    message += `\n*Total: S/ ${Number(total).toFixed(2)}*\n\n`;
    message += `*Datos de entrega:*\n`;

    if (this.#customer) {
      message += `Nombre: ${this.#customer.name}\n`;

      if (this.#deliveryEnabled && this.#customer.address) {
        message += `Dirección: ${this.#customer.address}\n`;
      } else {
        message += `Tipo: Retiro en tienda\n`;
      }

      if (this.#customer.paymentMethod) {
        message += `Método de Pago: ${OrderMessage.paymentLabel(this.#customer.paymentMethod)}\n`;
      }
    }

    return message;
  }

  /**
   * @param {string} phone
   * @param {{ countryCode?: string }} [options]
   * @returns {string}
   */
  link(phone, options) {
    return WhatsApp.link(phone, this.build(), options);
  }

  /**
   * @param {string} phone
   * @param {{ countryCode?: string, target?: string }} [options]
   * @returns {string}
   */
  open(phone, options) {
    return WhatsApp.open(phone, this.build(), options);
  }

  /**
   * Single-product message used by the product detail dialog.
   *
   * @param {{ name: string, quantity?: number, entry?: { qty: string|number, price: string|number, bonus?: string, label?: string } | null, unitsLabel?: { one: string, other: string } | null }} product
   * @returns {string}
   */
  static forProduct({ name, quantity = 1, entry = null, unitsLabel = null }) {
    let message = `Hola, quisiera pedir ${quantity}x ${name}`;

    if (entry) {
      message += ` (${entryLabel(entry, unitsLabel)} - S/ ${entry.price})`;
      if (entry.bonus) message += ` + ${entry.bonus}`;
    }

    return `${message} del menú.`;
  }
}
