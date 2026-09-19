import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/b8e821af-fc57-432a-9b4b-d6fc917731b0';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's45_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runS45Proof() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  S45 VERBATIM STRING CORRECTION: "કાઢી નાખો" PROOF SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: []
  };

  function assert(name, condition, details = {}) {
    results.tests.push({ name, passed: !!condition, details });
    const mark = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${name}`, details);
    if (!condition) {
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // Initial setup: set sessionRole to 'admin' so the Trash2 icon is rendered, and bypass onboarding
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      // Set session role in store so danger button displays Trash2 icon instead of Lock
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
    });

    const themes = ['outdoor', 'dark', 'premium'];
    const viewports = [
      { name: '360px', width: 360, height: 960 },
      { name: '1280px', width: 1280, height: 800 }
    ];

    for (const theme of themes) {
      console.log(`\n─────────────────────────────────────────────────────────────`);
      console.log(`Testing Theme: ${theme.toUpperCase()}`);
      console.log(`─────────────────────────────────────────────────────────────`);

      for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/new-report`, { waitUntil: 'networkidle0' });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('theme', t);
          document.documentElement.classList.remove('theme-switching');
          // set session role in zustand store
          const store = window.__STORE__ || window.useAppStore;
          if (store) store.setState({ sessionRole: 'admin' });
        }, theme);

        await new Promise(r => setTimeout(r, 600));

        // Scroll to the bottom where the action cluster is located
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(r => setTimeout(r, 300));

        // Verify danger button text, aria-label, positioning
        const data = await page.evaluate(() => {
          const dangerBtn = document.querySelector('.action-cluster-danger-btn');
          const span = dangerBtn?.querySelector('span.font-gujarati');
          const isLast = dangerBtn && dangerBtn.parentElement?.lastElementChild === dangerBtn;

          return {
            found: !!dangerBtn,
            text: span?.textContent?.trim(),
            ariaLabel: dangerBtn?.getAttribute('aria-label'),
            isLast: !!isLast,
            hasTrashIcon: !!dangerBtn?.querySelector('svg'),
            classList: dangerBtn ? Array.from(dangerBtn.classList) : []
          };
        });

        assert(`[${theme} @ ${vp.name}] Danger button exists`, data.found);
        assert(`[${theme} @ ${vp.name}] Danger button text is exactly "કાઢી નાખો"`, data.text === 'કાઢી નાખો', { actual: data.text });
        assert(`[${theme} @ ${vp.name}] Danger button aria-label is exactly "કાઢી નાખો"`, data.ariaLabel === 'કાઢી નાખો', { actual: data.ariaLabel });
        assert(`[${theme} @ ${vp.name}] Danger button is LAST in action cluster`, data.isLast);

        // Capture screenshot of danger button in action cluster
        const shotName = `s45_${theme}_${vp.name}_action_cluster.png`;
        const shotPath = path.join(SCREENSHOT_DIR, shotName);
        await page.screenshot({ path: shotPath, fullPage: false });
        results.screenshots.push({ name: shotName, theme, viewport: vp.name });
        console.log(`Captured ${shotName}`);
      }
    }

    // REGRESSION TEST: Click the danger button to verify it opens the confirmation dialog
    console.log(`\n─────────────────────────────────────────────────────────────`);
    console.log(`Regression Test: Delete Confirmation Dialog Trigger`);
    console.log(`─────────────────────────────────────────────────────────────`);

    await page.setViewport({ width: 360, height: 960 });
    await page.goto(`${BASE_URL}/new-report`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'outdoor');
      localStorage.setItem('theme', 'outdoor');
      // Set session role
      try {
        const store = window.useAppStore;
        if (store) store.setState({ sessionRole: 'admin' });
      } catch (e) {}
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 400));

    // Click danger button via DOM click
    await page.evaluate(() => {
      const dangerBtn = document.querySelector('.action-cluster-danger-btn');
      dangerBtn?.scrollIntoView({ block: 'center' });
      dangerBtn?.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Verify dialog opened
    const dialogData = await page.evaluate(() => {
      const overlay = document.querySelector('#clear-confirm-dialog-overlay') || document.querySelector('.viewport-fixed-overlay');
      const container = document.querySelector('#clear-confirm-dialog-container');
      const dialogTitle = container?.querySelector('h3')?.textContent?.trim();
      const cancelBtn = container?.querySelector('button:first-of-type')?.textContent?.trim();
      const confirmBtn = container?.querySelector('button.bg-danger')?.textContent?.trim();

      return {
        hasOverlay: !!overlay,
        hasContainer: !!container,
        dialogTitle,
        cancelBtn,
        confirmBtn
      };
    });

    assert('Delete confirmation dialog overlay is displayed', dialogData.hasOverlay, dialogData);
    assert('Delete confirmation dialog container is displayed', dialogData.hasContainer, dialogData);

    const dialogShotName = `s45_delete_confirmation_dialog.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, dialogShotName), fullPage: false });
    results.screenshots.push({ name: dialogShotName, theme: 'outdoor', viewport: '360px' });
    console.log(`Captured ${dialogShotName}`);

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 's45_proof_results.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  ALL ${results.tests.length} S45 ASSERTIONS PASSED!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Proof failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runS45Proof();
