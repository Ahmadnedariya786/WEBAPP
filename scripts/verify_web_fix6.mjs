import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const outDir = 'c:\\Users\\DELL\\OneDrive\\Desktop\\NEW WEB APP\\web_fix6_screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const APP_URL = 'http://localhost:5173/';

(async () => {
  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);

  // Helper to enable network conditions (fast local connection)
  const enableNetwork = async (page) => {
    // Local dev server loads many modules; don't artificially delay TCP localhost
  };

  // Helper to overlay a realistic mobile status bar band matching meta theme-color
  const renderMobileStatusBar = async (page) => {
    await page.evaluate(() => {
      let sb = document.getElementById('emulated-mobile-status-bar');
      if (!sb) {
        sb = document.createElement('div');
        sb.id = 'emulated-mobile-status-bar';
        sb.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          z-index: 9999999;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          pointer-events: none;
          box-sizing: border-box;
          transition: background-color 200ms ease;
        `;
        document.body.appendChild(sb);
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      const metaColor = meta ? meta.getAttribute('content') : '#171238';
      sb.style.backgroundColor = metaColor;

      // Determine text/icon brightness for contrast
      const isLight = metaColor === '#F5F0E1';
      const textColor = isLight ? '#1E2F73' : '#FFFFFF';
      sb.style.color = textColor;

      sb.innerHTML = `
        <span style="letter-spacing: -0.02em;">9:41</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <!-- Cellular -->
          <svg width="15" height="11" viewBox="0 0 17 11" fill="${textColor}">
            <rect x="0" y="7" width="2.5" height="4" rx="0.7"/>
            <rect x="4.5" y="5" width="2.5" height="6" rx="0.7"/>
            <rect x="9" y="2.5" width="2.5" height="8.5" rx="0.7"/>
            <rect x="13.5" y="0" width="2.5" height="11" rx="0.7"/>
          </svg>
          <!-- Wifi -->
          <svg width="14" height="11" viewBox="0 0 16 12" fill="${textColor}">
            <path d="M8 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.2-3.1a6 6 0 018.4 0l1.2-1.2a7.7 7.7 0 00-10.8 0l1.2 1.2zm-2.4-2.4a9.4 9.4 0 0113.2 0l1.2-1.2a11.1 11.1 0 00-15.6 0l1.2 1.2z"/>
          </svg>
          <!-- Battery -->
          <svg width="22" height="11" viewBox="0 0 24 12" fill="${textColor}">
            <rect x="1" y="1" width="19" height="10" rx="3" fill="none" stroke="${textColor}" stroke-width="1.8"/>
            <rect x="3" y="3" width="13" height="6" rx="1.5" fill="${textColor}"/>
            <path d="M22 4.5v3" stroke="${textColor}" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>
      `;
    });
  };

  const results = [];

  // Helper to test splash & post-splash for a theme
  const testTheme = async (themeName, expectedBg, splashFile, appReadyFile) => {
    console.log(`\n========================================`);
    console.log(`TESTING THEME: ${themeName || 'unset (default)'}`);
    console.log(`========================================`);

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    await enableNetwork(page);

    await page.evaluateOnNewDocument((t) => {
      if (t) {
        localStorage.setItem('theme', t);
      } else {
        localStorage.removeItem('theme');
      }
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      window.__holdSplashForInspection = true;
    }, themeName);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Inspect splash & meta theme-color BEFORE first paint / early DOM
    const splashData = await page.evaluate(() => {
      const splash = document.getElementById('app-splash');
      const logoSvg = document.getElementById('app-splash-logo');
      const logoContainer = document.getElementById('app-splash-logo-container');
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const title = document.getElementById('app-splash-title')?.textContent?.trim();
      const version = document.getElementById('app-splash-version')?.textContent?.trim();

      // Check if graduation cap exists
      const hasCap = document.querySelector('path[d*="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"]') !== null;
      const logoRect = logoSvg ? logoSvg.getBoundingClientRect() : null;

      const cs = (el) => el ? window.getComputedStyle(el) : null;
      return {
        splashBg: cs(splash)?.backgroundColor,
        metaThemeColor,
        hasLogoSvg: logoSvg !== null,
        hasGraduationCap: hasCap,
        title,
        version,
        logoWidth: logoRect ? Math.round(logoRect.width) : 0,
        logoHeight: logoRect ? Math.round(logoRect.height) : 0,
      };
    });

    console.log(`Splash inspection [${themeName}]:`, JSON.stringify(splashData, null, 2));

    await renderMobileStatusBar(page);
    await page.screenshot({ path: path.join(outDir, splashFile) });
    console.log(`Saved splash screenshot: ${splashFile}`);

    // Now release splash inspection hold and trigger app-ready
    await page.evaluate(() => {
      window.__holdSplashForInspection = false;
      window.dispatchEvent(new CustomEvent('app-ready'));
    });

    // Wait for splash transition (300ms + margin)
    await new Promise((r) => setTimeout(r, 600));

    // Inspect state after splash fades
    const readyData = await page.evaluate(() => {
      const splashInDom = document.getElementById('app-splash') !== null;
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const rootTheme = document.documentElement.getAttribute('data-theme');
      return {
        splashInDom,
        metaThemeColor,
        rootTheme,
      };
    });

    console.log(`App Ready inspection [${themeName}]:`, JSON.stringify(readyData, null, 2));

    await renderMobileStatusBar(page);
    await page.screenshot({ path: path.join(outDir, appReadyFile) });
    console.log(`Saved app ready screenshot: ${appReadyFile}`);

    results.push({
      theme: themeName || 'unset',
      expectedBg,
      splashMetaColor: splashData.metaThemeColor,
      readyMetaColor: readyData.metaThemeColor,
      hasLogoSvg: splashData.hasLogoSvg,
      hasNoCap: !splashData.hasGraduationCap,
      splashRemoved: !readyData.splashInDom,
    });

    await page.close();
  };

  // Run the 3 themes + unset
  await testTheme('outdoor', '#F5F0E1', '01_splash_outdoor.png', '01_app_outdoor.png');
  await testTheme('dark', '#20242B', '02_splash_graphite.png', '02_app_graphite.png');
  await testTheme('premium', '#171238', '03_splash_premium.png', '03_app_premium.png');
  await testTheme(null, '#171238', '04_splash_unset.png', '04_app_unset.png');

  // Test dynamic in-app switching (header 3-icon pill & settings card)
  console.log(`\n========================================`);
  console.log(`TESTING DYNAMIC SWITCHING IN APP`);
  console.log(`========================================`);
  const switchPage = await browser.newPage();
  await switchPage.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await switchPage.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 500));

  const switchThemeAndVerify = async (targetTheme, expectedColor, screenshotName) => {
    await switchPage.evaluate((t) => {
      if (window.__setTheme) window.__setTheme(t);
    }, targetTheme);

    await new Promise((r) => setTimeout(r, 300));
    const metaColor = await switchPage.evaluate(() => {
      return document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    });

    console.log(`Switched to [${targetTheme}]: meta theme-color = ${metaColor} (expected: ${expectedColor})`);
    await renderMobileStatusBar(switchPage);
    await switchPage.screenshot({ path: path.join(outDir, screenshotName) });
    return metaColor === expectedColor;
  };

  await switchThemeAndVerify('outdoor', '#F5F0E1', '05_switch_outdoor.png');
  await switchThemeAndVerify('dark', '#20242B', '06_switch_graphite.png');
  await switchThemeAndVerify('premium', '#171238', '07_switch_premium.png');

  await switchPage.close();
  await browser.close();

  console.log(`\n========================================`);
  console.log(`SUMMARY OF RESULTS`);
  console.log(`========================================`);
  console.table(results);
})();
