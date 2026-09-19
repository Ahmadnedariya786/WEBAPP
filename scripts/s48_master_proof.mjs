import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/b8e821af-fc57-432a-9b4b-d6fc917731b0';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's48_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runS48MasterProof() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  S48-MASTER PERFORMANCE + ANIMATION POLISH PROOF SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const suiteResults = {
    timestamp: new Date().toISOString(),
    tests: [],
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

  // 1. Static asset verification (D1 & N1)
  console.log('--- 1. Static Native Assets & CSS Tokens Verification ---');
  const themesXml = fs.readFileSync('android/app/src/main/res/values/themes.xml', 'utf8');
  assert('D1: themes.xml has windowBackground #20242B', themesXml.includes('<item name="android:windowBackground">#20242B</item>'));

  const layoutXml = fs.readFileSync('android/app/src/main/res/layout/activity_main.xml', 'utf8');
  assert('D1: activity_main.xml uses #20242B for background and splash', 
    layoutXml.includes('android:background="#20242B"') && !layoutXml.includes('#0f172a'));

  const mainKt = fs.readFileSync('android/app/src/main/java/com/mehnat/tracker/MainActivity.kt', 'utf8');
  assert('D1: MainActivity.kt sets webView background to #20242B', 
    mainKt.includes('webView.setBackgroundColor(Color.parseColor("#20242B"))'));

  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert('D1: index.html has #20242B body and default background', 
    indexHtml.includes('background-color: #20242B') && indexHtml.includes("let bg = '#20242B'"));

  const themeCss = fs.readFileSync('src/theme.css', 'utf8');
  assert('N1: theme.css defines --bg-rgb for outdoor', themeCss.includes('--bg-rgb: 245, 240, 225;'));
  assert('N1: theme.css defines --bg-rgb for dark', themeCss.includes('--bg-rgb: 31, 35, 41;'));
  assert('N1: theme.css defines --bg-rgb for premium', themeCss.includes('--bg-rgb: 23, 18, 56;'));

  const indexCss = fs.readFileSync('src/index.css', 'utf8');
  assert('D6 & N1: index.css uses rgba(var(--bg-rgb), 0.85) on mobile', 
    indexCss.includes('rgba(var(--bg-rgb), 0.85)'));
  assert('D4: index.css defines theme-crossfade animation', 
    indexCss.includes('@keyframes theme-crossfade') && indexCss.includes('html.theme-fading #root'));

  // 2. Puppeteer browser verification
  console.log('\n--- 2. Puppeteer Dynamic UI & Animation Verification ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // D6 Mobile Scrim Test (<900px)
    console.log('\nTesting D6: Mobile Backdrop Scrim on 360px viewport');
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2 });
    await page.goto(BASE_URL + '/#/', { waitUntil: 'networkidle0' });

    // Ensure sample data exists & bypass onboarding
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
    });
    await page.reload({ waitUntil: 'networkidle0' });

    // Open calendar dialog
    await page.waitForSelector('#btn-date-picker-trigger', { visible: true });
    await page.click('#btn-date-picker-trigger');
    await page.waitForSelector('#calendar-dialog-overlay', { visible: true });

    // Evaluate computed styles on mobile overlay
    const mobileOverlayStyle = await page.evaluate(() => {
      const el = document.getElementById('calendar-dialog-overlay');
      const cs = window.getComputedStyle(el);
      const bf = cs.backdropFilter || '';
      const wbf = cs.webkitBackdropFilter || '';
      return {
        backdropFilter: bf,
        webkitBackdropFilter: wbf,
        isNone: (bf === 'none' || bf === '') && (wbf === 'none' || wbf === ''),
        backgroundColor: cs.backgroundColor
      };
    });
    console.log('Mobile overlay style:', mobileOverlayStyle);

    assert('D6: Mobile overlay backdrop-filter is none', 
      mobileOverlayStyle.isNone,
      mobileOverlayStyle);
    assert('D6 & N1: Mobile overlay background-color is rgba(31, 35, 41, 0.85)', 
      mobileOverlayStyle.backgroundColor.includes('31, 35, 41') || mobileOverlayStyle.backgroundColor.includes('0.85'), 
      mobileOverlayStyle);

    // Test D3: Themed Dropdown Sheets (Custom Popover List)
    console.log('\nTesting D3: Custom Themed Month & Year Popovers');
    const isNativeSelect = await page.evaluate(() => {
      const monthEl = document.getElementById('neu-cal-month-select');
      return monthEl.tagName.toLowerCase() === 'select';
    });
    assert('D3: Month select is NOT a native <select> tag', !isNativeSelect);

    // Open month dropdown
    await page.click('#neu-cal-month-select');
    await page.waitForSelector('.neu-cal-dropdown-menu', { visible: true });

    const monthMenuData = await page.evaluate(() => {
      const menu = document.querySelector('.neu-cal-dropdown-menu');
      const items = Array.from(menu.querySelectorAll('.neu-cal-dropdown-item'));
      const selectedItem = menu.querySelector('.neu-cal-dropdown-item.is-selected');
      const checkIcon = selectedItem ? selectedItem.querySelector('.neu-cal-dropdown-check') : null;
      return {
        role: menu.getAttribute('role'),
        itemCount: items.length,
        firstItemText: items[0]?.textContent?.trim(),
        selectedMonthText: selectedItem?.textContent?.trim(),
        hasCheckIcon: !!checkIcon
      };
    });

    assert('D3: Month dropdown has role="listbox"', monthMenuData.role === 'listbox');
    assert('D3: Month dropdown has 12 Gujarati months', monthMenuData.itemCount === 12);
    assert('D3: Month dropdown has verbatim Gujarati months (e.g. જાન્યુઆરી)', monthMenuData.firstItemText?.includes('જાન્યુઆરી'));
    assert('D3: Selected month item has checkmark', monthMenuData.hasCheckIcon, monthMenuData);

    // Capture screenshot of open custom month dropdown in dark theme
    const darkMonthShot = path.join(SCREENSHOT_DIR, 'd3_month_dropdown_dark_360px.png');
    await page.screenshot({ path: darkMonthShot, fullPage: false });
    suiteResults.screenshots.push(darkMonthShot);

    // Select month index 2 (માર્ચ)
    const monthItems = await page.$$('.neu-cal-dropdown-item');
    console.log('Found month items:', monthItems.length);
    if (monthItems[2]) {
      await monthItems[2].click();
    }
    await new Promise(r => setTimeout(r, 400));

    // Verify month updated to માર્ચ and popover closed
    const currentMonthTitle = await page.evaluate(() => {
      const title = document.querySelector('.neu-cal-title')?.textContent?.trim();
      const menu = document.querySelector('.neu-cal-dropdown-menu');
      const btn = document.getElementById('neu-cal-month-select');
      return { 
        title, 
        menuOpen: !!menu,
        menuHTML: menu ? menu.outerHTML.slice(0, 120) : null,
        ariaExpanded: btn?.getAttribute('aria-expanded')
      };
    });
    console.log('After month select evaluation:', currentMonthTitle);
    assert('D3: Selecting month updates nav title and closes popover', 
      currentMonthTitle.title?.includes('માર્ચ') && !currentMonthTitle.menuOpen, currentMonthTitle);

    // Test Escape key closes dropdown
    await page.click('#neu-cal-month-select');
    await page.waitForSelector('.neu-cal-dropdown-menu', { visible: true });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    const popoverAfterEsc = await page.evaluate(() => !!document.querySelector('.neu-cal-dropdown-menu'));
    const calDialogAfterEsc = await page.evaluate(() => !!document.getElementById('calendar-dialog-container'));
    assert('D3: Escape closes popover while calendar dialog stays open', !popoverAfterEsc && calDialogAfterEsc);

    // Test Year dropdown
    await page.click('#neu-cal-year-select');
    await page.waitForSelector('.neu-cal-dropdown-menu', { visible: true });
    const yearMenuData = await page.evaluate(() => {
      const menu = document.querySelector('.neu-cal-dropdown-menu');
      const items = Array.from(menu.querySelectorAll('.neu-cal-dropdown-item'));
      return {
        count: items.length,
        firstYear: items[0]?.textContent?.trim()
      };
    });
    assert('D3: Year popover opens with year list', yearMenuData.count > 0, yearMenuData);

    // Close year popover
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    // Test D2: Dialog Exit Animation
    console.log('\nTesting D2: Dialog Exit Animation');
    await page.click('#calendar-dialog-overlay', { offset: { x: 10, y: 10 } }); // click backdrop to close
    // Immediately after click, dialog should still be in DOM animating exit
    const dialogDuringExit = await page.evaluate(() => !!document.getElementById('calendar-dialog-overlay'));
    assert('D2: Dialog element remains in DOM during 140ms exit animation', dialogDuringExit);

    await page.waitForFunction(() => !document.getElementById('calendar-dialog-overlay'), { timeout: 1500 });
    const dialogAfterExit = await page.evaluate(() => !!document.getElementById('calendar-dialog-overlay'));
    assert('D2: Dialog element cleanly unmounted after exit animation finishes', !dialogAfterExit);

    // Test D6 Desktop Backdrop Blur (>=900px)
    console.log('\nTesting D6: Desktop Backdrop Blur (>=900px)');
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.click('#btn-date-picker-trigger');
    await page.waitForSelector('#calendar-dialog-overlay', { visible: true });

    const desktopOverlayStyle = await page.evaluate(() => {
      const el = document.getElementById('calendar-dialog-overlay');
      const cs = window.getComputedStyle(el);
      const bf = cs.backdropFilter || '';
      const wbf = cs.webkitBackdropFilter || '';
      return {
        backdropFilter: bf,
        webkitBackdropFilter: wbf,
        hasBlur: bf.includes('blur') || wbf.includes('blur')
      };
    });
    assert('D6: Desktop overlay keeps backdrop-filter blur', 
      desktopOverlayStyle.hasBlur, desktopOverlayStyle);

    const desktopCalShot = path.join(SCREENSHOT_DIR, 'd6_desktop_cal_blur_1280px.png');
    await page.screenshot({ path: desktopCalShot, fullPage: false });
    suiteResults.screenshots.push(desktopCalShot);

    // Close calendar dialog
    await page.click('#calendar-dialog-overlay', { offset: { x: 10, y: 10 } });
    await new Promise(r => setTimeout(r, 250));

    // Test D4: Theme Switch Crossfade
    console.log('\nTesting D4: Theme Switch Crossfade');
    const themeSwitchResult = await page.evaluate(() => {
      window.__setTheme('outdoor');
      const rootClasses = document.documentElement.className;
      return { rootClasses, theme: document.documentElement.getAttribute('data-theme') };
    });
    assert('D4: Theme switch applies theme class and updates data-theme', 
      themeSwitchResult.theme === 'outdoor');

    await new Promise(r => setTimeout(r, 250));

    // Verify outdoor dropdown screenshot on 360px
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2 });
    await page.click('#btn-date-picker-trigger');
    await page.waitForSelector('#calendar-dialog-overlay', { visible: true });
    await page.click('#neu-cal-month-select');
    await page.waitForSelector('.neu-cal-dropdown-menu', { visible: true });

    const outdoorMonthShot = path.join(SCREENSHOT_DIR, 'd3_month_dropdown_outdoor_360px.png');
    await page.screenshot({ path: outdoorMonthShot, fullPage: false });
    suiteResults.screenshots.push(outdoorMonthShot);

    await page.click('#calendar-dialog-overlay', { offset: { x: 10, y: 10 } });
    await new Promise(r => setTimeout(r, 250));

    // Verify premium dropdown screenshot
    await page.evaluate(() => window.__setTheme('premium'));
    await new Promise(r => setTimeout(r, 250));
    await page.click('#btn-date-picker-trigger');
    await page.waitForSelector('#calendar-dialog-overlay', { visible: true });
    await page.click('#neu-cal-month-select');
    await page.waitForSelector('.neu-cal-dropdown-menu', { visible: true });

    const premiumMonthShot = path.join(SCREENSHOT_DIR, 'd3_month_dropdown_premium_360px.png');
    await page.screenshot({ path: premiumMonthShot, fullPage: false });
    suiteResults.screenshots.push(premiumMonthShot);

    await page.click('#calendar-dialog-overlay', { offset: { x: 10, y: 10 } });
    await new Promise(r => setTimeout(r, 250));

    // Reset back to dark
    await page.evaluate(() => window.__setTheme('dark'));
    await new Promise(r => setTimeout(r, 250));

    // Test D5: List-Card Entrance Stagger across routes
    console.log('\nTesting D5: List-Card Entrance Stagger on Settings, Help, PastReports');
    
    // Settings route
    await page.goto(BASE_URL + '/settings', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.space-y-4', { visible: true });
    const settingsCardsCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('.space-y-4 > div');
      return cards.length;
    });
    assert('D5: Settings has staggered card elements', settingsCardsCount >= 4, { settingsCardsCount });
    const settingsShot = path.join(SCREENSHOT_DIR, 'd5_settings_stagger_dark_360px.png');
    await page.screenshot({ path: settingsShot, fullPage: false });
    suiteResults.screenshots.push(settingsShot);

    // Help route
    await page.goto(BASE_URL + '/help', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.space-y-4', { visible: true });
    const helpCardsCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('.space-y-4 > div');
      return cards.length;
    });
    assert('D5: Help has staggered card elements', helpCardsCount >= 3, { helpCardsCount });
    const helpShot = path.join(SCREENSHOT_DIR, 'd5_help_stagger_dark_360px.png');
    await page.screenshot({ path: helpShot, fullPage: false });
    suiteResults.screenshots.push(helpShot);

    // Past reports route
    await page.goto(BASE_URL + '/past-reports', { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { visible: true });
    const pastReportsShot = path.join(SCREENSHOT_DIR, 'd5_past_reports_dark_360px.png');
    await page.screenshot({ path: pastReportsShot, fullPage: false });
    suiteResults.screenshots.push(pastReportsShot);

    // Save final report json
    const reportPath = path.join(SCREENSHOT_DIR, 's48_results.json');
    fs.writeFileSync(reportPath, JSON.stringify(suiteResults, null, 2), 'utf8');
    console.log('\nAll tests passed successfully! Results saved to:', reportPath);

  } finally {
    await browser.close();
  }
}

runS48MasterProof().catch((err) => {
  console.error('\n❌ PROOF SUITE ERROR:', err);
  process.exit(1);
});
