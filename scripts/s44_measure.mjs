import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/b8e821af-fc57-432a-9b4b-d6fc917731b0';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's44_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const prefix = process.argv[2] || 'before'; // 'before' or 'after'

async function runMeasurement() {
  console.log(`Running measurement: stage=${prefix}...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    stage: prefix,
    timestamp: new Date().toISOString(),
    metrics: []
  };

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // Bypass onboarding & greeting
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });

    const themes = ['outdoor', 'dark', 'premium'];
    const viewports = [
      { name: '360px', width: 360, height: 960 },
      { name: '1280px', width: 1280, height: 800 }
    ];

    for (const theme of themes) {
      for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('theme', t);
          document.documentElement.classList.remove('theme-switching');
        }, theme);

        await new Promise(r => setTimeout(r, 600));

        const m = await page.evaluate(() => {
          const header = document.querySelector('.dashboard-header-zone');
          const chip = document.querySelector('.dashboard-header-zone .header-chip') || document.querySelector('.dashboard-header-zone .inline-flex');
          const targetCard = document.querySelector('.dashboard-target-card');

          const hRect = header?.getBoundingClientRect();
          const cRect = chip?.getBoundingClientRect();
          const tRect = targetCard?.getBoundingClientRect();

          const computedHeader = header ? window.getComputedStyle(header) : null;

          return {
            headerBottom: hRect?.bottom,
            headerPaddingBottom: computedHeader?.paddingBottom,
            chipBottom: cRect?.bottom,
            targetTop: tRect?.top,
            // Gap between chip bottom and target card top: positive means chip is ABOVE target card, negative means target card overlaps/clips chip
            gapAboveTarget: (tRect && cRect) ? (tRect.top - cRect.bottom) : null,
            // Assertion requirement: chipBottom <= targetTop - 8px => (targetTop - chipBottom) >= 8px
            assertionPass: (tRect && cRect) ? (cRect.bottom <= tRect.top - 8) : false
          };
        });

        const shotName = `${prefix}_${theme}_${vp.name}.png`;
        const shotPath = path.join(SCREENSHOT_DIR, shotName);
        await page.screenshot({ path: shotPath, fullPage: false });

        console.log(`[${theme} @ ${vp.name}] paddingBottom: ${m.headerPaddingBottom} | chip.bottom: ${m.chipBottom?.toFixed(1)} | target.top: ${m.targetTop?.toFixed(1)} | clearance (target.top - chip.bottom): ${m.gapAboveTarget?.toFixed(1)}px | assertion (clearance >= 8px): ${m.assertionPass}`);

        results.metrics.push({
          theme,
          viewport: vp.name,
          screenshot: shotName,
          ...m
        });
      }
    }

    fs.writeFileSync(path.join(SCREENSHOT_DIR, `${prefix}_results.json`), JSON.stringify(results, null, 2));
    console.log(`Saved results to ${path.join(SCREENSHOT_DIR, `${prefix}_results.json`)}`);
  } catch (err) {
    console.error('Error during measurement:', err);
  } finally {
    await browser.close();
  }
}

runMeasurement();
