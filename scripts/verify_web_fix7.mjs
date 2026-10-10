import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const outDir = 'c:\\Users\\DELL\\OneDrive\\Desktop\\NEW WEB APP\\web_fix7_screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const APP_URL = 'http://localhost:5173/';

(async () => {
  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);
  const page = await browser.newPage();
  await configureDownloadSafety(page, tempDownloadDir);
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.method() === 'OPTIONS') {
      req.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
          'Access-Control-Allow-Headers': '*',
        }
      });
      return;
    }

    const url = req.url();
    if (url.includes('fn_login_code')) {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify('admin')
      });
    } else if (url.includes('fn_set_admin_code')) {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(false)
      });
    } else if (url.includes('fn_list_codes')) {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([])
      });
    } else {
      req.continue();
    }
  });

  // Pre-seed onboarding and greeted status
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mt_onboarded', '1');
    localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
    sessionStorage.setItem('mt_greeted', '1');
  });

  // Helper to get bounding rect and centering metrics
  const getModalMetrics = async (selector) => {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const topOffset = Math.round(r.top);
      const bottomOffset = Math.round(vh - r.bottom);
      const leftOffset = Math.round(r.left);
      const rightOffset = Math.round(vw - r.right);
      return {
        width: Math.round(r.width),
        height: Math.round(r.height),
        topOffset,
        bottomOffset,
        leftOffset,
        rightOffset,
        verticalDiff: Math.abs(topOffset - bottomOffset),
        horizontalDiff: Math.abs(leftOffset - rightOffset),
        isTopAnchored: topOffset < 30, // top-anchored overlays have top < 30px
        isVerticallyCentered: Math.abs(topOffset - bottomOffset) <= 40,
      };
    }, selector);
  };

  const results = [];

  // ==========================================
  // TEST 1-3: Team-Code Modal in 3 Themes
  // ==========================================
  const themes = [
    { id: 'outdoor', file: '01_team_code_modal_outdoor.png' },
    { id: 'dark', file: '02_team_code_modal_graphite.png' },
    { id: 'premium', file: '03_team_code_modal_premium.png' },
  ];

  for (const t of themes) {
    console.log(`\nTesting Team-Code modal in theme: ${t.id}...`);
    await page.goto(`${APP_URL}settings`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 400));

    // Set theme
    await page.evaluate((themeId) => {
      if (window.__setTheme) window.__setTheme(themeId);
    }, t.id);
    await new Promise((r) => setTimeout(r, 200));

    // Open AuthDialog
    await page.evaluate(() => {
      if (window.useAppStore) {
        window.useAppStore.setState({ authDialogOpen: true, authPendingAction: null });
      } else {
        const btn = document.getElementById('btn-settings-team-code');
        if (btn) btn.click();
      }
    });

    await page.waitForSelector('#auth-dialog-container', { visible: true, timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400)); // wait for entrance animation

    const metrics = await getModalMetrics('#auth-dialog-container');
    console.log(`Team-Code Modal Metrics [${t.id}]:`, JSON.stringify(metrics, null, 2));

    await page.screenshot({ path: path.join(outDir, t.file) });
    console.log(`Saved screenshot: ${t.file}`);

    results.push({
      modal: `Team-Code Modal (${t.id})`,
      topOffset: metrics.topOffset,
      bottomOffset: metrics.bottomOffset,
      verticalDiff: metrics.verticalDiff,
      isTopAnchored: metrics.isTopAnchored,
      isCentered: metrics.isVerticallyCentered,
    });

    // Close AuthDialog
    await page.evaluate(() => {
      if (window.useAppStore) {
        window.useAppStore.getState().closeAuthDialog();
      }
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  // ==========================================
  // TEST 4: Logout Confirm Dialog Centering
  // ==========================================
  console.log(`\nTesting Logout Confirm Dialog Centering...`);
  await page.goto(`${APP_URL}admin`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 500));

  await page.evaluate(() => {
    if (window.useAppStore) {
      window.useAppStore.getState().setSession('ADMIN123', 'admin');
    }
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.waitForSelector('#btn-admin-logout', { visible: true, timeout: 5000 });
  await page.click('#btn-admin-logout');

  await page.waitForSelector('.confirm-dialog-card', { visible: true, timeout: 5000 });
  await new Promise((r) => setTimeout(r, 400));

  const logoutMetrics = await getModalMetrics('.confirm-dialog-card');
  console.log(`Logout Confirm Dialog Metrics:`, JSON.stringify(logoutMetrics, null, 2));

  await page.screenshot({ path: path.join(outDir, '04_logout_confirm_dialog.png') });
  console.log(`Saved screenshot: 04_logout_confirm_dialog.png`);

  results.push({
    modal: `Logout Confirm Dialog`,
    topOffset: logoutMetrics.topOffset,
    bottomOffset: logoutMetrics.bottomOffset,
    verticalDiff: logoutMetrics.verticalDiff,
    isTopAnchored: logoutMetrics.isTopAnchored,
    isCentered: logoutMetrics.isVerticallyCentered,
  });

  // Cancel dialog
  await page.evaluate(() => {
    const cancelBtn = document.querySelector('.confirm-dialog-card button');
    if (cancelBtn) cancelBtn.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // ==========================================
  // TEST 5: Date Picker Calendar Modal Centering
  // ==========================================
  console.log(`\nTesting Date Picker Calendar Modal Centering...`);
  await page.goto(`${APP_URL}`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 500));

  // Click date picker trigger
  await page.click('#btn-date-picker-trigger');
  await page.waitForSelector('#calendar-dialog-container', { visible: true, timeout: 5000 });
  await new Promise((r) => setTimeout(r, 400));

  const calMetrics = await getModalMetrics('#calendar-dialog-container');
  console.log(`Date Picker Modal Metrics:`, JSON.stringify(calMetrics, null, 2));

  await page.screenshot({ path: path.join(outDir, '05_date_picker_dialog.png') });
  console.log(`Saved screenshot: 05_date_picker_dialog.png`);

  results.push({
    modal: `Date Picker Calendar Modal`,
    topOffset: calMetrics.topOffset,
    bottomOffset: calMetrics.bottomOffset,
    verticalDiff: calMetrics.verticalDiff,
    isTopAnchored: calMetrics.isTopAnchored,
    isCentered: calMetrics.isVerticallyCentered,
  });

  await page.close();
  await browser.close();

  console.log(`\n========================================`);
  console.log(`SUMMARY OF MODAL CENTERING AUDIT`);
  console.log(`========================================`);
  console.table(results);
})();
