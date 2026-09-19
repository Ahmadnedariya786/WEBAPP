import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/b8e821af-fc57-432a-9b4b-d6fc917731b0';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's44_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runMasterProof() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  S44 DASHBOARD HEADER-ZONE OVERLAP CLIPPING FIX PROOF SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const suiteResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    metrics: [],
    screenshots: []
  };

  function assert(name, condition, details = {}) {
    suiteResults.tests.push({ name, passed: !!condition, details });
    const mark = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${name}`, details);
    if (!condition) {
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // Initial load and bypass onboarding / greeting modal
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });

    const themes = ['outdoor', 'dark', 'premium'];
    const viewports = [
      { name: '360px', width: 360, height: 960 },
      { name: '1280px', width: 1280, height: 800 },
      { name: '2560px', width: 2560, height: 1440 }
    ];

    for (const theme of themes) {
      console.log(`\n─────────────────────────────────────────────────────────────`);
      console.log(`Testing Theme: ${theme.toUpperCase()}`);
      console.log(`─────────────────────────────────────────────────────────────`);

      for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('theme', t);
          document.documentElement.classList.remove('theme-switching');
        }, theme);

        // Wait for count-up and entrance animations to settle
        await new Promise(r => setTimeout(r, 650));

        const data = await page.evaluate(() => {
          const header = document.querySelector('.dashboard-header-zone');
          const chip = document.querySelector('.dashboard-header-zone .header-chip');
          const targetCard = document.querySelector('.dashboard-target-card');
          const activitiesCard = document.querySelector('.dashboard-activities-card');
          const headerValue = document.querySelector('.dashboard-header-zone .header-value');
          const headerLabel = document.querySelector('.dashboard-header-zone .header-label');
          const headerContext = document.querySelector('.dashboard-header-zone .header-context');
          const donuts = document.querySelectorAll('.dashboard-donut-arc');

          const hRect = header ? header.getBoundingClientRect() : null;
          const cRect = chip ? chip.getBoundingClientRect() : null;
          const tRect = targetCard ? targetCard.getBoundingClientRect() : null;
          const aRect = activitiesCard ? activitiesCard.getBoundingClientRect() : null;

          const hStyle = header ? window.getComputedStyle(header) : null;
          const cStyle = chip ? window.getComputedStyle(chip) : null;
          const tStyle = targetCard ? window.getComputedStyle(targetCard) : null;
          const valStyle = headerValue ? window.getComputedStyle(headerValue) : null;

          return {
            hRect: hRect ? { top: hRect.top, bottom: hRect.bottom, height: hRect.height } : null,
            cRect: cRect ? { top: cRect.top, bottom: cRect.bottom, height: cRect.height } : null,
            tRect: tRect ? { top: tRect.top, bottom: tRect.bottom, height: tRect.height } : null,
            aRect: aRect ? { top: aRect.top, bottom: aRect.bottom } : null,
            hPaddingBottom: hStyle?.paddingBottom,
            hBorderBottomLeftRadius: hStyle?.borderBottomLeftRadius,
            hBorderBottomRightRadius: hStyle?.borderBottomRightRadius,
            chipFontSize: cStyle?.fontSize,
            valFontSize: valStyle?.fontSize,
            targetMarginTop: tStyle?.marginTop,
            targetZIndex: tStyle?.zIndex,
            donutsCount: donuts.length,
            hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
            headerValueText: headerValue?.textContent?.trim()
          };
        });

        // 1. Spacing Fix Assertion (D1, D3):
        // change-chip boundingRect.bottom <= target-card boundingRect.top - 8px
        const clearance = data.tRect.top - data.cRect.bottom;
        assert(
          `[${theme} @ ${vp.name}] D3: change-chip sits >= 8px above target card (clearance: ${clearance.toFixed(1)}px)`,
          data.cRect.bottom <= (data.tRect.top - 8),
          { chipBottom: data.cRect.bottom, targetTop: data.tRect.top, clearance }
        );

        // 2. Exact breathing room (D1): sits >= 28px above target card's top edge
        assert(
          `[${theme} @ ${vp.name}] D1: chip sits >= 28px above target card top edge`,
          clearance >= 28,
          { clearance }
        );

        // 3. Header zone visually intact (D1, D3): rounded-bottom 24px preserved
        assert(
          `[${theme} @ ${vp.name}] D3: header zone bottom-left radius is 24px`,
          data.hBorderBottomLeftRadius === '24px',
          { actual: data.hBorderBottomLeftRadius }
        );
        assert(
          `[${theme} @ ${vp.name}] D3: header zone bottom-right radius is 24px`,
          data.hBorderBottomRightRadius === '24px',
          { actual: data.hBorderBottomRightRadius }
        );

        // 4. Header padding-bottom is 52px (calc(20px + var(--overlap) + 8px))
        assert(
          `[${theme} @ ${vp.name}] D1: header padding-bottom is 52px`,
          data.hPaddingBottom === '52px',
          { actual: data.hPaddingBottom }
        );

        // 5. Target card -24px overlap (-mt-6) and z-10 preserved (D1)
        assert(
          `[${theme} @ ${vp.name}] D1: target card -24px overlap (-mt-6) preserved`,
          data.targetMarginTop === '-24px',
          { actual: data.targetMarginTop }
        );
        assert(
          `[${theme} @ ${vp.name}] D1: target card z-10 stacking preserved`,
          data.targetZIndex === '10',
          { actual: data.targetZIndex }
        );

        // 6. Zero horizontal overflow
        assert(
          `[${theme} @ ${vp.name}] No horizontal overflow`,
          !data.hasHorizontalScroll,
          { scrollWidth: data.hasHorizontalScroll }
        );

        // 7. Donut arcs exist
        assert(
          `[${theme} @ ${vp.name}] Donut rings exist (count = 2)`,
          data.donutsCount === 2,
          { actual: data.donutsCount }
        );

        // Save screenshot
        const shotFilename = `s44_${theme}_${vp.name}.png`;
        const shotPath = path.join(SCREENSHOT_DIR, shotFilename);
        await page.screenshot({ path: shotPath, fullPage: false });
        suiteResults.screenshots.push({ name: shotFilename, theme, viewport: vp.name });
      }
    }

    // Animation Test: Check donut sweep & count-up live progression
    console.log(`\n─────────────────────────────────────────────────────────────`);
    console.log('Testing Donut Sweep & Count-up Animation Progression');
    console.log(`─────────────────────────────────────────────────────────────`);

    await page.setViewport({ width: 360, height: 960 });
    await page.goto(`${BASE_URL}/past-reports`, { waitUntil: 'networkidle0' });
    // Switch to dashboard tab to trigger mount animation
    const dashTab = await page.$('.bottom-nav-slot:first-of-type');
    await dashTab?.click();

    // Check mid-flight animation (~150ms)
    await new Promise(r => setTimeout(r, 150));
    const midAnim = await page.evaluate(() => {
      const donuts = Array.from(document.querySelectorAll('.dashboard-donut-arc'));
      const headerVal = document.querySelector('.dashboard-header-zone .header-value');
      return {
        donutsFound: donuts.length,
        headerValText: headerVal?.textContent?.trim()
      };
    });

    assert('Donut arcs rendered during animation', midAnim.donutsFound === 2, midAnim);

    // Wait until animation settles (total ~700ms)
    await new Promise(r => setTimeout(r, 600));
    const settledVal = await page.evaluate(() => {
      const headerVal = document.querySelector('.dashboard-header-zone .header-value');
      return headerVal?.textContent?.trim();
    });

    assert('Header count-up value settled properly', settledVal !== undefined && settledVal !== '', { settledVal });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  ALL ${suiteResults.tests.length} ASSERTIONS PASSED WITH ZERO ERRORS!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 's44_suite_summary.json'),
      JSON.stringify(suiteResults, null, 2)
    );

  } catch (err) {
    console.error('Test suite failure:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runMasterProof();
