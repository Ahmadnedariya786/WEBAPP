import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939/s35_proof_screenshots';
const RESULTS_FILE = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939/s35_proof_results.json';
const BASE_URL = 'http://127.0.0.1:4173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runProof() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    commitHash: 'd531151',
    tests: [],
    screenshots: []
  };

  try {
    const page = await browser.newPage();

    // Enable local storage onboarding completion
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });
    // Reload so Zustand store picks up mt_onboarded
    await page.reload({ waitUntil: 'networkidle0' });


    const themes = ['outdoor', 'dark', 'premium'];
    const routes = [
      { path: '/dashboard', name: 'dashboard', activeLabel: 'ડેશબોર્ડ' },
      { path: '/past-reports', name: 'past_reports', activeLabel: 'પાછલા રિપોર્ટ્સ' }
    ];
    const viewports = [
      { name: 'mobile_360px', width: 360, height: 740 },
      { name: 'desktop_1280px', width: 1280, height: 800 }
    ];

    for (const theme of themes) {
      for (const route of routes) {
        for (const vp of viewports) {
          await page.setViewport({ width: vp.width, height: vp.height });
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0' });

          // Set theme
          await page.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
            localStorage.setItem('theme', t);
            document.documentElement.classList.remove('theme-switching');
          }, theme);

          await new Promise(r => setTimeout(r, 300));

          // Verify elements exist and are positioned properly
          const navMetrics = await page.evaluate(() => {
            const root = document.querySelector('.bottom-nav-root');
            const svg = document.querySelector('.bottom-nav-svg');
            const fab = document.querySelector('.bottom-nav-fab');
            const pathEl = document.querySelector('.bottom-nav-fill');
            const buttons = Array.from(document.querySelectorAll('.bottom-nav-btn'));
            const activeBtn = document.querySelector('.bottom-nav-btn-active');
            const activeDot = document.querySelector('.bottom-nav-btn-active .bottom-nav-dot');

            if (!root || !fab || !svg) return null;

            const rootRect = root.getBoundingClientRect();
            const fabRect = fab.getBoundingClientRect();
            const svgRect = svg.getBoundingClientRect();

            return {
              rootWidth: rootRect.width,
              rootHeight: rootRect.height,
              fabWidth: fabRect.width,
              fabHeight: fabRect.height,
              fabTop: fabRect.top,
              fabLeft: fabRect.left,
              rootTop: rootRect.top,
              // FAB should be half-raised: center should be near root's top edge
              fabCenterYOffsetFromRootTop: (fabRect.top + fabRect.height / 2) - rootRect.top,
              hasCradleSvg: !!pathEl,
              buttonCount: buttons.length,
              activeLabel: activeBtn ? activeBtn.querySelector('.bottom-nav-btn-label')?.textContent?.trim() : null,
              activeDotVisible: activeDot ? window.getComputedStyle(activeDot).opacity === '1' : false,
              hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
            };
          });

          const screenshotName = `s35_nav_${theme}_${route.name}_${vp.name}.png`;
          const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);

          await page.screenshot({ path: screenshotPath, fullPage: false });

          results.screenshots.push({
            name: screenshotName,
            theme,
            route: route.path,
            viewport: vp.name,
            metrics: navMetrics
          });

          console.log(`Captured ${screenshotName}`);
        }
      }
    }

    // Capture closeup crop of the bottom nav for all 3 themes
    await page.setViewport({ width: 440, height: 260 });
    for (const theme of themes) {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      }, theme);
      await new Promise(r => setTimeout(r, 250));

      const navEl = await page.$('.bottom-nav-root');
      if (navEl) {
        const box = await navEl.boundingBox();
        if (box) {
          const closeupName = `s35_closeup_${theme}.png`;
          const closeupPath = path.join(SCREENSHOT_DIR, closeupName);
          // Include 36px above root to capture the full raised FAB without clipping
          await page.screenshot({
            path: closeupPath,
            clip: {
              x: Math.max(0, box.x - 10),
              y: Math.max(0, box.y - 36),
              width: box.width + 20,
              height: box.height + 46
            }
          });
          results.screenshots.push({
            name: closeupName,
            type: 'closeup',
            theme
          });
          console.log(`Captured closeup for ${theme}`);
        }
      }
    }

    // REGRESSION TEST: Navigation switching + FAB routing
    console.log('Running regression tests...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });

    // 1. Initial route is /dashboard
    let currentPath = await page.evaluate(() => window.location.pathname);
    results.tests.push({
      name: 'Initial route is /dashboard',
      passed: currentPath === '/dashboard'
    });

    // 2. Click Past Reports button (right slot)
    const pastReportsBtn = await page.$('button.bottom-nav-btn:last-of-type');
    await pastReportsBtn?.click();
    await new Promise(r => setTimeout(r, 300));
    currentPath = await page.evaluate(() => window.location.pathname);
    results.tests.push({
      name: 'Clicking past-reports button navigates to /past-reports',
      passed: currentPath === '/past-reports'
    });

    // 3. Click FAB (center slot)
    const fabBtn = await page.$('.bottom-nav-fab');
    await fabBtn?.click();
    await new Promise(r => setTimeout(r, 300));
    currentPath = await page.evaluate(() => window.location.pathname);
    results.tests.push({
      name: 'Clicking FAB navigates to / (New Report)',
      passed: currentPath === '/'
    });

    // 4. Click Dashboard button (left slot)
    const dashboardBtn = await page.$('button.bottom-nav-btn:first-of-type');
    await dashboardBtn?.click();
    await new Promise(r => setTimeout(r, 300));
    currentPath = await page.evaluate(() => window.location.pathname);
    results.tests.push({
      name: 'Clicking dashboard button navigates to /dashboard',
      passed: currentPath === '/dashboard'
    });

    // Write results JSON
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log('Proof results saved successfully to:', RESULTS_FILE);

  } catch (err) {
    console.error('Error during proof execution:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runProof();
