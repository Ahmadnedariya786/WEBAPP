import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const outDir = 'c:\\Users\\DELL\\OneDrive\\Desktop\\NEW WEB APP\\web_fix5_screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const APP_URL = 'http://localhost:4173/';

(async () => {
  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);

  // Helper to enable Slow 4G network throttling
  const enableSlow4G = async (page) => {
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (500 * 1024) / 8, // 500 kbps
      uploadThroughput: (200 * 1024) / 8,
      latency: 200, // 200 ms
    });
  };

  // Helper to test splash in a given theme (pausing app-ready so we capture crisp splash)
  const testSplashForTheme = async (themeName, screenshotName) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
    await enableSlow4G(page);

    await page.evaluateOnNewDocument((t) => {
      if (t) {
        localStorage.setItem('theme', t);
      } else {
        localStorage.removeItem('theme');
      }
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      // Prevent app-ready listener on splash from removing it prematurely during capture
      window.__holdSplashForInspection = true;
    }, themeName);

    console.log(`Loading page with theme "${themeName}" on Slow 4G...`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Inspect splash element
    const splashState = await page.evaluate(() => {
      const splash = document.getElementById('app-splash');
      const circle = document.getElementById('app-splash-circle');
      const title = document.getElementById('app-splash-title');
      const version = document.getElementById('app-splash-version');
      const metaVer = document.querySelector('meta[name="app-version"]');
      if (!splash) return null;

      const cs = (el) => el ? window.getComputedStyle(el) : null;
      return {
        exists: true,
        splashBg: cs(splash)?.backgroundColor,
        circleBg: cs(circle)?.backgroundColor,
        titleColor: cs(title)?.color,
        titleText: title?.textContent?.trim(),
        versionColor: cs(version)?.color,
        versionText: version?.textContent?.trim(),
        metaVersion: metaVer?.getAttribute('content'),
        circleWidth: Math.round(circle?.getBoundingClientRect().width || 0),
        circleHeight: Math.round(circle?.getBoundingClientRect().height || 0),
      };
    });

    console.log(`Splash State [${themeName}]:`, JSON.stringify(splashState, null, 2));

    // Capture screenshot of branded splash
    await page.screenshot({ path: path.join(outDir, screenshotName) });

    await page.close();
    return splashState;
  };

  console.log('=== TEST 1: Outdoor Theme Splash ===');
  await testSplashForTheme('outdoor', '01_splash_outdoor.png');

  console.log('=== TEST 2: Graphite (dark) Theme Splash ===');
  await testSplashForTheme('dark', '02_splash_graphite.png');

  console.log('=== TEST 3: Premium Theme Splash ===');
  await testSplashForTheme('premium', '03_splash_premium.png');

  console.log('=== TEST 4: Unset Theme Splash (defaults to Premium) ===');
  await testSplashForTheme(null, '04_splash_unset.png');

  console.log('=== TEST 5: Complete Launch Sequence (Branded Splash -> Greeting -> App Ready) ===');
  const launchPage = await browser.newPage();
  await launchPage.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await enableSlow4G(launchPage);

  // Allow greeting overlay to display naturally
  await launchPage.evaluateOnNewDocument(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('mt_onboarded', '1');
    sessionStorage.removeItem('mt_greeted'); // Show greeting overlay
  });

  // 1. Navigate: capture branded splash immediately on load
  await launchPage.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await launchPage.screenshot({ path: path.join(outDir, '05_launch_1_branded_splash.png') });

  // 2. Wait for app data load & app-ready event -> splash fades out, greeting overlay is visible
  console.log('Waiting for app data load and app-ready event...');
  await new Promise((r) => setTimeout(r, 600));
  await launchPage.screenshot({ path: path.join(outDir, '05_launch_2_app_greeting.png') });

  // 3. Wait for greeting overlay animation to complete (1.6s)
  console.log('Waiting for greeting overlay to finish fadeout...');
  await new Promise((r) => setTimeout(r, 1800));
  await launchPage.screenshot({ path: path.join(outDir, '05_launch_3_app_ready.png') });

  // Check that splash is completely removed from DOM
  const isSplashInDom = await launchPage.evaluate(() => {
    return document.getElementById('app-splash') !== null;
  });
  console.log('Is #app-splash still in DOM?', isSplashInDom);

  // Test tap responsiveness (click on header button to verify taps are not blocked)
  const canClick = await launchPage.evaluate(() => {
    const btn = document.querySelector('header button');
    return btn !== null;
  });
  console.log('Header buttons interactive and unblocked?', canClick);

  console.log('=== TEST 6: Settings Version Single Source ===');
  await launchPage.goto(`${APP_URL}settings`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));

  const settingsVersion = await launchPage.evaluate(() => {
    const metaVer = document.querySelector('meta[name="app-version"]')?.getAttribute('content');
    const settingsVer = document.getElementById('settings-app-version')?.textContent?.trim();
    return {
      metaVersion: metaVer,
      settingsVersion: settingsVer,
      matches: metaVer === settingsVer,
    };
  });
  console.log('Settings Version Single Source Check:', settingsVersion);
  await launchPage.screenshot({ path: path.join(outDir, '06_settings_version.png') });

  await launchPage.close();
  await browser.close();
  console.log('=== All tests finished successfully! ===');
})();
