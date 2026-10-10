import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const outDir = 'c:\\Users\\DELL\\OneDrive\\Desktop\\NEW WEB APP\\web_fix4_screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);
  const page = await browser.newPage();
  await configureDownloadSafety(page, tempDownloadDir);
  
  // Set viewport to mobile standard 375x812
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mt_onboarded', '1');
    sessionStorage.setItem('mt_greeted', '1');
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Helper to extract theme switcher state
  const getSwitcherState = async () => {
    return await page.evaluate(() => {
      const pill = document.getElementById('theme-switcher-pill');
      const indicator = document.querySelector('.theme-switcher-indicator');
      const segOutdoor = document.getElementById('theme-seg-outdoor');
      const segDark = document.getElementById('theme-seg-dark');
      const segPremium = document.getElementById('theme-seg-premium');
      const htmlTheme = document.documentElement.getAttribute('data-theme');
      
      const getStyles = (el) => {
        if (!el) return null;
        const comp = window.getComputedStyle(el);
        return {
          color: comp.color,
          backgroundColor: comp.backgroundColor,
          opacity: comp.opacity,
          isActive: el.classList.contains('active'),
          ariaChecked: el.getAttribute('aria-checked'),
        };
      };

      const getIndicatorStyle = () => {
        if (!indicator) return null;
        const comp = window.getComputedStyle(indicator);
        return {
          backgroundColor: comp.backgroundColor,
          transform: comp.transform,
          boxShadow: comp.boxShadow,
        };
      };

      return {
        htmlTheme,
        pillRect: pill ? pill.getBoundingClientRect() : null,
        indicator: getIndicatorStyle(),
        outdoor: getStyles(segOutdoor),
        dark: getStyles(segDark),
        premium: getStyles(segPremium),
      };
    });
  };

  // Helper to get Settings page active theme button
  const getSettingsState = async () => {
    return await page.evaluate(() => {
      const outdoorBtn = document.getElementById('settings-theme-outdoor');
      const darkBtn = document.getElementById('settings-theme-dark');
      const premiumBtn = document.getElementById('settings-theme-premium');

      const isBtnActive = (btn) => {
        if (!btn) return false;
        return btn.className.includes('bg-acc') && !btn.className.includes('bg-transparent');
      };

      return {
        outdoor: isBtnActive(outdoorBtn),
        dark: isBtnActive(darkBtn),
        premium: isBtnActive(premiumBtn),
      };
    });
  };

  console.log('--- Test 1: Click Outdoor segment (#theme-seg-outdoor) ---');
  await page.click('#theme-seg-outdoor');
  await new Promise((r) => setTimeout(r, 600));
  const outdoorState = await getSwitcherState();
  console.log('Outdoor state:', JSON.stringify(outdoorState, null, 2));
  await page.screenshot({ path: path.join(outDir, '01_header_outdoor.png') });

  // Navigate to settings to verify matching selection
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const settingsOutdoor = await getSettingsState();
  console.log('Settings when Outdoor active:', settingsOutdoor);
  await page.screenshot({ path: path.join(outDir, '02_settings_outdoor.png') });

  console.log('--- Test 2: Click Dark/Graphite segment (#theme-seg-dark) from header in Settings ---');
  await page.click('#theme-seg-dark');
  await new Promise((r) => setTimeout(r, 600));
  const darkState = await getSwitcherState();
  console.log('Dark/Graphite state:', JSON.stringify(darkState, null, 2));
  const settingsDark = await getSettingsState();
  console.log('Settings when Dark active:', settingsDark);
  await page.screenshot({ path: path.join(outDir, '03_settings_dark.png') });

  // Navigate back to home to see Graphite header
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, '04_header_dark.png') });

  console.log('--- Test 3: Click Premium segment (#theme-seg-premium) from header ---');
  await page.click('#theme-seg-premium');
  await new Promise((r) => setTimeout(r, 600));
  const premiumState = await getSwitcherState();
  console.log('Premium state:', JSON.stringify(premiumState, null, 2));
  await page.screenshot({ path: path.join(outDir, '05_header_premium.png') });

  // Navigate to settings to verify matching selection
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const settingsPremium = await getSettingsState();
  console.log('Settings when Premium active:', settingsPremium);
  await page.screenshot({ path: path.join(outDir, '06_settings_premium.png') });

  console.log('--- Test 4: Two-way sync test (click button in Settings card) ---');
  // Click Outdoor button in Settings card
  console.log('Clicking Outdoor button in Settings card...');
  await page.click('#settings-theme-outdoor');
  await new Promise((r) => setTimeout(r, 600));
  const switcherAfterSettingsOutdoor = await getSwitcherState();
  console.log('Switcher state after clicking Settings Outdoor:', switcherAfterSettingsOutdoor.htmlTheme, 'Outdoor active:', switcherAfterSettingsOutdoor.outdoor.isActive);

  // Click Premium button in Settings card
  console.log('Clicking Premium button in Settings card...');
  await page.click('#settings-theme-premium');
  await new Promise((r) => setTimeout(r, 600));
  const switcherAfterSettingsPremium = await getSwitcherState();
  console.log('Switcher state after clicking Settings Premium:', switcherAfterSettingsPremium.htmlTheme, 'Premium active:', switcherAfterSettingsPremium.premium.isActive, 'Dark/Moon active:', switcherAfterSettingsPremium.dark.isActive);

  console.log('--- Test 5: Verify 360px viewport ---');
  await page.setViewport({ width: 360, height: 740, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, '07_viewport_360px_home.png') });

  const header360 = await page.evaluate(() => {
    const pill = document.getElementById('theme-switcher-pill');
    const header = document.querySelector('.app-header');
    return {
      headerRect: header ? header.getBoundingClientRect() : null,
      pillRect: pill ? pill.getBoundingClientRect() : null,
    };
  });
  console.log('360px Header layout check:', JSON.stringify(header360, null, 2));

  await browser.close();
  console.log('All tests completed successfully!');
})();
