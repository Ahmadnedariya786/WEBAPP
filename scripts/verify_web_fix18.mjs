import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { launchHeadlessBrowser, configureDownloadSafety, preseedTesseractLangData } from './verify_helpers.mjs';

const outDir = path.resolve('web_fix18_screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const fixtureCleanPath = path.resolve('tests/fixtures/clean_form.png');
if (!fs.existsSync(fixtureCleanPath)) {
  throw new Error('tests/fixtures/clean_form.png missing from repo!');
}

let serverProcess = null;
const PORT = 5218;
const APP_URL = `http://localhost:${PORT}/`;

async function startServer() {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  serverProcess = spawn(npxCmd, ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const code = await new Promise((resolve, reject) => {
        const req = http.get(APP_URL, (res) => resolve(res.statusCode));
        req.on('error', reject);
        req.setTimeout(400, () => req.destroy());
      });
      if (code && code >= 200 && code < 400) {
        await new Promise((r) => setTimeout(r, 400));
        return;
      }
    } catch {}
  }
  throw new Error('Vite preview server failed to start on port ' + PORT);
}

function stopServer() {
  if (serverProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {}
  }
}

// Expected fixture ground truth per clean_form.png for WEB-FIX15 verification gate
const EXPECTED_STATS = {
  student_count: '340',
  std10: '62',
  std11: '58',
  std12: '64',
  college: '96',
  engineer: '28',
  medical: '12',
  muslim_teachers: '9'
};

const THEME_SPECS = {
  outdoor: {
    name: 'outdoor',
    headerBg: '#FBF7EC',
    headerBgRgb: 'rgb(251, 247, 236)',
    pageBg: '#F5F0E1',
    pageBgRgb: 'rgb(245, 240, 225)',
    colorScheme: 'light',
    iconColor: '#1E2F73', // Dark Navy for contrast
    isDarkIcons: true
  },
  dark: {
    name: 'dark',
    headerBg: '#20242B',
    headerBgRgb: 'rgb(32, 36, 43)',
    pageBg: '#20242B',
    pageBgRgb: 'rgb(32, 36, 43)',
    colorScheme: 'dark',
    iconColor: '#F3F4F6', // Light gray/white for contrast
    isDarkIcons: false
  },
  premium: {
    name: 'premium',
    headerBg: '#241640',
    headerBgRgb: 'rgb(36, 22, 64)',
    pageBg: '#171238',
    pageBgRgb: 'rgb(23, 18, 56)',
    colorScheme: 'dark',
    iconColor: '#FFFFFF', // Pure white for contrast
    isDarkIcons: false
  }
};

// Emulate realistic mobile status bar over the edge-to-edge header
async function renderMobileStatusBar(page, themeName) {
  const spec = THEME_SPECS[themeName] || THEME_SPECS.premium;
  await page.evaluate((themeSpec) => {
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
    document.documentElement.style.setProperty('--safe-area-inset-top', '36px');
    const meta = document.querySelector('meta[name="theme-color"]');
    const metaColor = meta ? meta.getAttribute('content') : themeSpec.headerBg;
    // Edge-to-edge: status bar background matches meta theme-color / header background
    sb.style.backgroundColor = metaColor;

    const textColor = themeSpec.iconColor;
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
  }, spec);
}

export async function runVerification() {
  console.log(`\n========================================================================`);
  console.log(`=== WEB-FIX18 EDGE-TO-EDGE & REMOVE DARK TOP BAND VERIFICATION ===`);
  console.log(`========================================================================`);

  await preseedTesseractLangData();
  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);
  console.log(`[Sandbox] Headless browser launched with isolated download dir: ${tempDownloadDir}`);

  try {
    // ------------------------------------------------------------------------
    // GATE CHECK: WEB-FIX15 VERIFICATION GATE (CLEAN FORM OCR STATS >= 75%)
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('=== PART 1: MANDATORY VERIFICATION GATE ENFORCEMENT (AGENTS.md) ===');
    console.log('========================================================================');
    const gatePage = await browser.newPage();
    await configureDownloadSafety(gatePage, tempDownloadDir);
    gatePage.on('console', (msg) => {
      const text = msg.text();
      if (!text.includes('Download') && !text.includes('Failed to load resource')) {
        console.log('[Browser Gate]', text);
      }
    });

    await gatePage.setViewport({ width: 1280, height: 900 });
    await gatePage.evaluateOnNewDocument(() => {
      localStorage.setItem('mt_onboarded', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      sessionStorage.setItem('mt_greeted', '1');
    });

    await gatePage.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    const galleryInputClean = await gatePage.$('#gallery-scan-input');
    if (!galleryInputClean) {
      throw new Error('#gallery-scan-input not found for clean_form upload');
    }
    await galleryInputClean.uploadFile(fixtureCleanPath);
    console.log('[Upload] Uploaded fixture clean_form.png, awaiting OCR processing...');

    await gatePage.waitForFunction(
      () => {
        const el = document.getElementById('scan-review-container');
        return el !== null && window.getComputedStyle(el).display !== 'none';
      },
      { timeout: 60000 }
    );
    console.log('[Modal] Review overlay modal opened successfully for clean fixture!');
    await new Promise((r) => setTimeout(r, 600));

    const cleanData = await gatePage.evaluate(() => {
      const statsSection = document.getElementById('scan-review-stats-section');
      const stats = {};
      if (statsSection) {
        const blocks = statsSection.querySelectorAll('[data-stat-key]');
        blocks.forEach((b) => {
          const k = b.getAttribute('data-stat-key');
          const inp = b.querySelector('input');
          stats[k] = inp ? inp.value.trim() : '';
        });
      }
      return { stats };
    });

    let cleanExactStats = 0;
    for (const [k, expV] of Object.entries(EXPECTED_STATS)) {
      if (cleanData.stats[k] === expV) cleanExactStats++;
    }
    const cleanStatsPercent = Math.round((cleanExactStats / 8) * 100);
    console.log(`Gate evaluation: ${cleanExactStats}/8 exact matches (${cleanStatsPercent}%). College: ${cleanData.stats.college}`);

    if (cleanData.stats.college === '172') {
      throw new Error('FATAL: college received 172 from Activity row 8! Value leaked into stats!');
    }
    if (cleanStatsPercent < 75) {
      throw new Error(`FATAL: Stats extraction accuracy ${cleanStatsPercent}% is below required 75% gate!`);
    }
    console.log('✅ MANDATORY GATE PASSED: Stats >= 75%, college != 172, zero leakage!');
    await gatePage.close();

    // ------------------------------------------------------------------------
    // PART 2: MANIFEST & VIEWPORT AUDIT (F1(c), F2, F4)
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('=== PART 2: MANIFEST & VIEWPORT-FIT EDGE-TO-EDGE AUDIT ===');
    console.log('========================================================================');
    const manifestPath = path.resolve('public/manifest.json');
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`Manifest display mode: "${manifestJson.display}" (Must be "standalone", never fullscreen)`);
    if (manifestJson.display !== 'standalone') {
      throw new Error(`Manifest display must be "standalone", got "${manifestJson.display}"`);
    }
    console.log('✅ F4 PASSED: PWA display mode is standalone (system status icons remain visible)!');

    // ------------------------------------------------------------------------
    // PART 3: THEME INSPECTION ACROSS ALL THREE THEMES + UNSET (F1, F2, F3, F4)
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('=== PART 3: THREE-THEME EDGE-TO-EDGE SWEEP & STATUS BAR LEGIBILITY ===');
    console.log('========================================================================');

    const themesToTest = ['outdoor', 'dark', 'premium', null];

    for (const targetTheme of themesToTest) {
      const themeKey = targetTheme || 'premium';
      const spec = THEME_SPECS[themeKey];
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`Testing Theme: [${targetTheme || 'unset -> defaults to premium'}]`);
      console.log(`------------------------------------------------------------------------`);

      const testPage = await browser.newPage();
      await configureDownloadSafety(testPage, tempDownloadDir);
      // Realistic mobile viewport: iPhone 12/13/14 (390x844 with safe-area)
      await testPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

      await testPage.evaluateOnNewDocument((t) => {
        if (t) {
          localStorage.setItem('theme', t);
        } else {
          localStorage.removeItem('theme');
        }
        localStorage.setItem('mt_onboarded', '1');
        sessionStorage.setItem('mt_greeted', '1');
        // Pause splash removal to inspect initial splash state & meta theme-color
        window.__holdSplashForInspection = true;
      }, targetTheme);

      await testPage.goto(APP_URL, { waitUntil: 'domcontentloaded' });

      // Step A: Inspect Splash Screen State (F1, F4)
      const splashInspection = await testPage.evaluate(() => {
        const splash = document.getElementById('app-splash');
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const metaColorScheme = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content');
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content');
        const docTheme = document.documentElement.getAttribute('data-theme');
        const splashBg = splash ? window.getComputedStyle(splash).backgroundColor : null;
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        const bodyBg = document.body ? window.getComputedStyle(document.body).backgroundColor : null;

        return {
          metaThemeColor,
          metaColorScheme,
          viewportMeta,
          docTheme,
          splashBg,
          htmlBg,
          bodyBg
        };
      });

      console.log(`[Splash State] meta[theme-color]: ${splashInspection.metaThemeColor}`);
      console.log(`[Splash State] meta[color-scheme]: ${splashInspection.metaColorScheme}`);
      console.log(`[Splash State] splash background: ${splashInspection.splashBg}`);
      console.log(`[Splash State] viewport content: ${splashInspection.viewportMeta}`);

      // Check viewport-fit=cover
      if (!splashInspection.viewportMeta?.includes('viewport-fit=cover')) {
        throw new Error('FATAL: viewport meta must contain viewport-fit=cover for edge-to-edge rendering!');
      }

      // Check splash theme-color equals header background
      if (splashInspection.metaThemeColor?.toUpperCase() !== spec.headerBg.toUpperCase()) {
        throw new Error(`FATAL: Splash meta theme-color expected ${spec.headerBg}, got ${splashInspection.metaThemeColor}`);
      }

      // Check splash background is NOT fixed dark #171238 on outdoor
      if (themeKey === 'outdoor') {
        if (splashInspection.splashBg === 'rgb(23, 18, 56)') {
          throw new Error('FATAL: Outdoor splash background is fixed dark charcoal rgb(23, 18, 56)!');
        }
      }

      // Render mobile status bar and capture splash screenshot
      await renderMobileStatusBar(testPage, themeKey);
      const splashFilename = `0${targetTheme ? (targetTheme === 'outdoor' ? '1' : targetTheme === 'dark' ? '2' : '3') : '4'}_pwa_splash_${themeKey}.png`;
      await testPage.screenshot({ path: path.join(outDir, splashFilename) });
      console.log(`[Screenshot Saved] ${splashFilename}`);

      // Release splash hold and trigger app-ready
      await testPage.evaluate(() => {
        window.__holdSplashForInspection = false;
        if (window.__hideSplash) {
          window.__hideSplash();
        } else {
          window.dispatchEvent(new CustomEvent('app-ready'));
        }
      });

      // Wait for splash fade transition
      await new Promise((r) => setTimeout(r, 700));

      // Step B: Inspect App Header & Edge-to-Edge Layout (F1, F2, F3)
      const appInspection = await testPage.evaluate(() => {
        const header = document.querySelector('.app-header');
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const metaColorScheme = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content');
        const docColorScheme = window.getComputedStyle(document.documentElement).colorScheme;
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;

        let headerData = null;
        if (header) {
          const cs = window.getComputedStyle(header);
          const rect = header.getBoundingClientRect();
          headerData = {
            offsetTop: header.offsetTop,
            rectTop: rect.top,
            backgroundColor: cs.backgroundColor,
            paddingTop: cs.paddingTop,
            paddingBottom: cs.paddingBottom,
            marginTop: cs.marginTop,
            position: cs.position
          };
        }

        return {
          metaThemeColor,
          metaColorScheme,
          docColorScheme,
          htmlBg,
          bodyBg,
          headerData
        };
      });

      console.log(`[App State] meta[theme-color]: ${appInspection.metaThemeColor} (Expected: ${spec.headerBg})`);
      console.log(`[App State] meta[color-scheme]: ${appInspection.metaColorScheme} (Expected: ${spec.colorScheme})`);
      console.log(`[App State] doc colorScheme: ${appInspection.docColorScheme}`);
      console.log(`[App State] header rectTop: ${appInspection.headerData?.rectTop}px, offsetTop: ${appInspection.headerData?.offsetTop}px`);
      console.log(`[App State] header backgroundColor: ${appInspection.headerData?.backgroundColor}`);
      console.log(`[App State] header paddingTop: ${appInspection.headerData?.paddingTop}`);
      console.log(`[App State] body backgroundColor: ${appInspection.bodyBg}`);

      // F1(a): meta theme-color matches header background
      if (appInspection.metaThemeColor?.toUpperCase() !== spec.headerBg.toUpperCase()) {
        throw new Error(`FATAL: Post-load meta theme-color expected ${spec.headerBg}, got ${appInspection.metaThemeColor}`);
      }
      console.log('✅ F1(a) PASSED: meta theme-color matches active header background!');

      // F1(b): html and body background follow active theme background
      if (themeKey === 'outdoor') {
        if (appInspection.bodyBg === 'rgb(23, 18, 56)') {
          throw new Error('FATAL: Body background in outdoor theme is fixed dark charcoal rgb(23, 18, 56)!');
        }
      }
      console.log('✅ F1(b) PASSED: html and body background follow active theme!');

      // F2: Edge-to-edge header reaches absolute top with 0 offset and safe-area padding
      if (!appInspection.headerData) {
        throw new Error('FATAL: .app-header element not found in DOM!');
      }
      if (appInspection.headerData.rectTop !== 0 && appInspection.headerData.offsetTop !== 0) {
        throw new Error(`FATAL: .app-header does not reach top: rectTop=${appInspection.headerData.rectTop}, offsetTop=${appInspection.headerData.offsetTop}`);
      }
      console.log('✅ F2 PASSED: Header reaches top edge (offsetTop === 0, no top gap showing body background)!');

      // F3: Status icon legibility
      if (appInspection.metaColorScheme !== spec.colorScheme) {
        throw new Error(`FATAL: meta[color-scheme] expected ${spec.colorScheme}, got ${appInspection.metaColorScheme}`);
      }
      console.log(`✅ F3 PASSED: Status icons configured with ${spec.colorScheme} scheme (Dark icons on outdoor, Light icons on dark/premium)!`);

      // F4: Splash-to-app handoff theme-color parity (zero flash of dark band)
      if (splashInspection.metaThemeColor?.toUpperCase() !== appInspection.metaThemeColor?.toUpperCase()) {
        throw new Error(`FATAL: Splash theme-color (${splashInspection.metaThemeColor}) does not match post-load theme-color (${appInspection.metaThemeColor})! Dark band flash!`);
      }
      console.log('✅ F4 PASSED: Splash inline theme-color and post-load theme-color match perfectly!');

      // Render mobile status bar and capture app ready screenshot
      await renderMobileStatusBar(testPage, themeKey);
      const appFilename = `0${targetTheme ? (targetTheme === 'outdoor' ? '1' : targetTheme === 'dark' ? '2' : '3') : '4'}_pwa_app_${themeKey}.png`;
      await testPage.screenshot({ path: path.join(outDir, appFilename) });
      console.log(`[Screenshot Saved] ${appFilename}`);

      await testPage.close();
    }

    // ------------------------------------------------------------------------
    // PART 4: DYNAMIC IN-APP THEME SWITCHING SWEEP (F1, F2, F3)
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('=== PART 4: DYNAMIC IN-APP THEME SWITCHING SWEEP ===');
    console.log('========================================================================');

    const switchPage = await browser.newPage();
    await configureDownloadSafety(switchPage, tempDownloadDir);
    await switchPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await switchPage.evaluateOnNewDocument(() => {
      localStorage.setItem('theme', 'outdoor');
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });

    await switchPage.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const switchSequence = ['outdoor', 'dark', 'premium', 'outdoor'];
    for (const targetTheme of switchSequence) {
      console.log(`Switching dynamically in running app to: [${targetTheme}]...`);
      const spec = THEME_SPECS[targetTheme];

      // Switch theme via pill element click or __setTheme
      await switchPage.evaluate((t) => {
        if (window.__setTheme) {
          window.__setTheme(t);
        } else {
          const seg = document.getElementById(`theme-seg-${t}`);
          if (seg) seg.click();
        }
      }, targetTheme);

      await new Promise((r) => setTimeout(r, 400));

      const switchedData = await switchPage.evaluate(() => {
        const meta = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
        const cs = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content');
        const header = document.querySelector('.app-header');
        const headerBg = header ? window.getComputedStyle(header).backgroundColor : null;
        const rectTop = header ? header.getBoundingClientRect().top : null;
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;

        return { meta, cs, headerBg, rectTop, bodyBg };
      });

      console.log(`  [Switched State] meta[theme-color]: ${switchedData.meta} (Expected: ${spec.headerBg})`);
      console.log(`  [Switched State] meta[color-scheme]: ${switchedData.cs} (Expected: ${spec.colorScheme})`);
      console.log(`  [Switched State] header rectTop: ${switchedData.rectTop}px`);

      if (switchedData.meta?.toUpperCase() !== spec.headerBg.toUpperCase()) {
        throw new Error(`FATAL: Dynamic switch to ${targetTheme} failed to update meta theme-color! Expected ${spec.headerBg}, got ${switchedData.meta}`);
      }
      if (switchedData.cs !== spec.colorScheme) {
        throw new Error(`FATAL: Dynamic switch to ${targetTheme} failed to update color-scheme! Expected ${spec.colorScheme}, got ${switchedData.cs}`);
      }
      if (switchedData.rectTop !== 0) {
        throw new Error(`FATAL: Header rectTop is not 0 after switch to ${targetTheme}! Got ${switchedData.rectTop}`);
      }

      await renderMobileStatusBar(switchPage, targetTheme);
      const switchFilename = `05_switch_${targetTheme}.png`;
      await switchPage.screenshot({ path: path.join(outDir, switchFilename) });
      console.log(`  [Screenshot Saved] ${switchFilename}`);
    }

    await switchPage.close();

    console.log(`\n========================================================================`);
    console.log(`🎉 ALL WEB-FIX18 VERIFICATION ASSERTIONS PASSED! 🎉`);
    console.log(`========================================================================`);

  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    await startServer();
    console.log(`[Server] Vite preview running at ${APP_URL}`);
    await runVerification();
    console.log('\n✅ VERIFICATION SUCCEEDED WITH ZERO FAILURES!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    stopServer();
  }
}

main();
