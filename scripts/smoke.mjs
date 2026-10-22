import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { isOpenAt } from '../src/storefront/services/business-hours.service.js';

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Users/alejandro/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4322';
const settingsFixture = JSON.parse(readFileSync('src/data/api/settings.json', 'utf8')).data;
// Data-pinned expectations — APP zone: this JSON is yours to edit, smoke.mjs is not.
const expectations = JSON.parse(readFileSync('scripts/smoke-data.json', 'utf8'));

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params);
      }
    };
  }

  async send(method, params = {}) {
    const id = ++this.id;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runSmoke() {
  const chrome = spawn(CHROME_PATH, [
    '--remote-debugging-port=9222',
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
  ]);

  const consoleProblems = [];

  try {
    await new Promise((r) => setTimeout(r, 1200));

    // Create target
    const targetRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const target = await targetRes.json();
    const client = new CDPClient(target.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Console.enable');

    client.on('Console.messageAdded', (params) => {
      if (params.message && (params.message.level === 'error' || params.message.level === 'warning')) {
        consoleProblems.push(`[${params.message.level}] ${params.message.text}`);
      }
    });

    const navigateAndWait = async (url) => {
      const loadPromise = new Promise((resolve) => {
        client.on('Page.loadEventFired', resolve);
      });
      await client.send('Page.navigate', { url });
      await loadPromise;
      await new Promise((r) => setTimeout(r, 500));
    };

    console.log('=== Checking / (Landing) ===');
    await navigateAndWait(`${BASE_URL}/`);

    // 1. Landing Title assertion
    const landingTitle = (await client.send('Runtime.evaluate', { expression: 'document.title' })).result.value;
    console.log('  [PASS] Landing title:', landingTitle);
    assert.equal(landingTitle, settingsFixture.seo.title);

    // 2. SiteHeader Logo resolves to /
    const headerLogoHref = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector(\'header a[aria-label="Inicio"]\')?.getAttribute("href")',
    })).result.value;
    console.log('  [PASS] SiteHeader logo href:', headerLogoHref);
    assert.equal(headerLogoHref, '/');

    // 3. Nav cards block renders 3 CTA hrefs (/menu, /galeria, /enlaces)
    const ctaHrefs = JSON.parse((await client.send('Runtime.evaluate', {
      expression: 'JSON.stringify(Array.from(document.querySelectorAll("#home-navigation a[href]")).map(a => a.getAttribute("href")))',
    })).result.value);
    console.log('  [PASS] Landing CTA hrefs:', ctaHrefs);
    assert.ok(ctaHrefs.includes('/menu'), 'Missing /menu CTA');
    assert.ok(ctaHrefs.includes('/galeria'), 'Missing /galeria CTA');
    assert.ok(ctaHrefs.includes('/enlaces'), 'Missing /enlaces CTA');
    assert.equal(ctaHrefs.length, expectations.landingCtaCards, `Expected exactly ${expectations.landingCtaCards} CTA cards in main section`);

    // 4. Footer present
    const footerPresent = (await client.send('Runtime.evaluate', {
      expression: '!!document.querySelector("footer")',
    })).result.value;
    console.log('  [PASS] Footer present:', footerPresent);
    assert.ok(footerPresent);

    // 5. Hero hours badge: payload embedded + state matches the visitor's clock
    const hoursPayloadPresent = (await client.send('Runtime.evaluate', {
      expression: '!!document.querySelector(\'#business-hours-data[data-business-hours]\')',
    })).result.value;
    console.log('  [PASS] business-hours payload embedded:', hoursPayloadPresent);
    assert.ok(hoursPayloadPresent, 'Missing #business-hours-data embed on /');

    const badgeState = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector("#hero-hours-badge")?.dataset.state ?? null',
    })).result.value;
    const expectedOpen = isOpenAt(settingsFixture.business_hours, new Date());
    console.log('  [PASS] Hero badge state:', badgeState, '(expected:', expectedOpen ? 'open' : 'closed', ')');
    assert.equal(badgeState, expectedOpen ? 'open' : 'closed');

    console.log('=== Checking /menu ===');
    await navigateAndWait(`${BASE_URL}/menu`);

    // 5. Menu title assertion
    const menuTitle = (await client.send('Runtime.evaluate', { expression: 'document.title' })).result.value;
    console.log('  [PASS] Menu title:', menuTitle);
    assert.equal(menuTitle, settingsFixture.seo.title_template.replace('%s', 'Menú'));

    // 6. Menu header logo resolves to /
    const menuLogoHref = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector("header a")?.getAttribute("href")',
    })).result.value;
    console.log('  [PASS] Menu header logo href:', menuLogoHref);
    assert.equal(menuLogoHref, '/');

    // 7. Template cards rendered
    const cardCount = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("[data-template-card]").length',
    })).result.value;
    console.log('  [PASS] Template cards count:', cardCount);
    assert.ok(cardCount > 0);

    // 8. Product detail hosts rendered
    const hostCount = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("[data-product-detail-host]").length',
    })).result.value;
    console.log('  [PASS] Detail hosts count:', hostCount);
    assert.ok(hostCount > 0);

    // 9. Card click opens detail dialog
    const dialogOpened = (await client.send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector("[data-template-card]");
        if (!card) return false;
        card.click();
        const hosts = Array.from(document.querySelectorAll("[data-product-detail-host]"));
        return hosts.some(h => !h.hasAttribute("hidden") && h.style.display !== "none");
      })()`,
    })).result.value;
    console.log('  [PASS] Card click opens dialog:', dialogOpened);
    assert.ok(dialogOpened);

    // 9b. Entry labels use the API-owned units_label wording
    const entryLabelText = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector("[data-product-detail-host]:not([hidden]) [data-entry-label]")?.textContent?.trim() ?? null',
    })).result.value;
    console.log('  [PASS] Sticky-bar entry label:', entryLabelText);
    assert.equal(entryLabelText, expectations.productEntryLabel);

    console.log('=== Checking /galeria ===');
    await navigateAndWait(`${BASE_URL}/galeria`);

    // 10. Gallery title assertion
    const galeriaTitle = (await client.send('Runtime.evaluate', { expression: 'document.title' })).result.value;
    console.log('  [PASS] Gallery title:', galeriaTitle);
    assert.equal(galeriaTitle, settingsFixture.seo.title_template.replace('%s', 'Galería'));

    // 11. Nav shows Galería active and Menú inactive
    const galeriaNavActive = JSON.parse((await client.send('Runtime.evaluate', {
      expression: 'JSON.stringify(Array.from(document.querySelectorAll("header nav a")).map(a => ({ text: a.innerText.trim(), active: a.className.includes("border-primary") })))',
    })).result.value);
    console.log('  [PASS] Gallery nav active state:', galeriaNavActive);
    assert.deepEqual(galeriaNavActive, [
      { text: 'MENÚ', active: false },
      { text: 'GALERÍA', active: true },
    ]);

    // 12. Category heading exists
    const categoryHeadings = JSON.parse((await client.send('Runtime.evaluate', {
      expression: 'JSON.stringify(Array.from(document.querySelectorAll("[data-gallery-category] h2 span:first-child")).map(h => h.innerText.trim()))',
    })).result.value);
    console.log('  [PASS] Category headings:', categoryHeadings);
    assert.ok(categoryHeadings.length > 0, 'Expected at least one category heading');
    assert.ok(
      expectations.galleryHeadingsInclude.every((h) => categoryHeadings.includes(h)),
      `Expected category heading(s): ${expectations.galleryHeadingsInclude.join(', ')}`
    );

    // 13. Grid renders the expected item count (scripts/smoke-data.json) plus video and iframe embeds
    const galleryItemsCount = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("[data-gallery-item]").length',
    })).result.value;
    console.log('  [PASS] Gallery items count:', galleryItemsCount);
    assert.ok(galleryItemsCount >= expectations.galleryMinItems, `Expected at least ${expectations.galleryMinItems} gallery items, found ${galleryItemsCount}`);

    const hasVideo = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("video").length > 0',
    })).result.value;
    console.log('  [PASS] Gallery video element present:', hasVideo);
    assert.ok(hasVideo, 'Expected at least one video element');

    const hasIframe = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("iframe").length > 0',
    })).result.value;
    console.log('  [PASS] Gallery iframe element present:', hasIframe);
    assert.ok(hasIframe, 'Expected at least one iframe embed element');

    // 14. Gallery modal present and opens on item click with media
    const modalOpened = (await client.send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById("gallery-modal");
        const firstItem = document.querySelector("[data-gallery-item]");
        if (!modal || !firstItem) return false;
        firstItem.click();
        const mediaInjected = (modal.querySelector("[data-modal-media]")?.children.length || 0) > 0;
        const isVisible = !modal.hasAttribute("hidden");
        const closeBtn = modal.querySelector("[data-modal-close]");
        closeBtn?.click();
        return isVisible && mediaInjected;
      })()`,
    })).result.value;
    console.log('  [PASS] Gallery modal opens on item click with media:', modalOpened);
    assert.ok(modalOpened, 'Expected gallery modal to open with media content on item click');

    // 15. Footer present on /galeria
    const galeriaFooterPresent = (await client.send('Runtime.evaluate', {
      expression: '!!document.querySelector("footer")',
    })).result.value;
    console.log('  [PASS] Gallery footer present:', galeriaFooterPresent);
    assert.ok(galeriaFooterPresent);

    console.log('=== Checking /enlaces ===');
    await navigateAndWait(`${BASE_URL}/enlaces`);

    // 16. Enlaces title assertion
    const enlacesTitle = (await client.send('Runtime.evaluate', { expression: 'document.title' })).result.value;
    console.log('  [PASS] Enlaces title:', enlacesTitle);
    assert.equal(enlacesTitle, settingsFixture.seo.title_template.replace('%s', 'Enlaces'));

    // 17. SiteHeader on /enlaces contains exactly two nav links (Menú, Galería) and neither is active
    const enlacesNavLinks = JSON.parse((await client.send('Runtime.evaluate', {
      expression: 'JSON.stringify(Array.from(document.querySelectorAll("header nav a")).map(a => ({ text: a.innerText.trim(), active: a.className.includes("border-primary") })))',
    })).result.value);
    console.log('  [PASS] Enlaces nav links:', enlacesNavLinks);
    assert.deepEqual(enlacesNavLinks, [
      { text: 'MENÚ', active: false },
      { text: 'GALERÍA', active: false },
    ]);

    // 18. Social links resolve to settings URLs
    const instagramHref = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector(\'[data-block-link="social-instagram"]\')?.getAttribute("href")',
    })).result.value;
    console.log('  [PASS] Instagram href resolves to settings:', instagramHref === settingsFixture.social_media.instagram);
    assert.equal(instagramHref, settingsFixture.social_media.instagram);

    const facebookHref = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector(\'[data-block-link="social-facebook"]\')?.getAttribute("href")',
    })).result.value;
    console.log('  [PASS] Facebook href resolves to settings:', facebookHref === settingsFixture.social_media.facebook);
    assert.equal(facebookHref, settingsFixture.social_media.facebook);

    const mapsHref = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector(\'[data-block-link="maps-link"]\')?.getAttribute("href")',
    })).result.value;
    console.log('  [PASS] Google Maps href resolves to settings:', mapsHref === settingsFixture.google_maps);
    assert.equal(mapsHref, settingsFixture.google_maps);

    // 19. TikTok button presence matches the fixture value
    const tiktokPresent = (await client.send('Runtime.evaluate', {
      expression: '!!document.querySelector(\'[data-block-link="social-tiktok"]\')',
    })).result.value;
    const tiktokExpected = Boolean(settingsFixture.social_media.tiktok);
    console.log('  [PASS] TikTok button matches fixture:', tiktokPresent === tiktokExpected);
    assert.equal(tiktokPresent, tiktokExpected);

    // 20. Landing CTA reaches /enlaces
    await navigateAndWait(`${BASE_URL}/`);
    const ctaReached = (await client.send('Runtime.evaluate', {
      expression: 'document.querySelector("main a[href=\'/enlaces\']")?.getAttribute("href")',
    })).result.value;
    console.log('  [PASS] Landing CTA to enlaces resolves:', ctaReached === '/enlaces');
    assert.equal(ctaReached, '/enlaces');

    // 21. Footer present on /enlaces
    await navigateAndWait(`${BASE_URL}/enlaces`);
    const enlacesFooterPresent = (await client.send('Runtime.evaluate', {
      expression: '!!document.querySelector("footer")',
    })).result.value;
    console.log('  [PASS] Enlaces footer present:', enlacesFooterPresent);
    assert.ok(enlacesFooterPresent);

    // 22. Check 0 console problems
    console.log('  Console problems count:', consoleProblems.length);
    if (consoleProblems.length > 0) {
      console.warn('  Problems found:', consoleProblems);
    }
    assert.equal(consoleProblems.length, 0, 'Expected 0 console problems');

    console.log('\nAll smoke checks PASSED!');
    await client.close();
  } finally {
    chrome.kill();
  }
}

runSmoke().catch((err) => {
  console.error('Smoke check FAILED:', err);
  process.exit(1);
});
