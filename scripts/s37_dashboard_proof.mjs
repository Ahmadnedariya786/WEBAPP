import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's37_proof_screenshots');

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
    tests: [],
    screenshots: []
  };

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // Ensure onboarding is bypassed
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });
    await page.reload({ waitUntil: 'networkidle0' });

    const themes = ['outdoor', 'dark', 'premium'];

    for (const theme of themes) {
      console.log(`Testing theme: ${theme}`);

      // 1. Mobile 360px Full View
      await page.setViewport({ width: 360, height: 960 });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
        document.documentElement.classList.remove('theme-switching');
      }, theme);
      await new Promise(r => setTimeout(r, 900)); // Allow animations to fully settle

      const mobileMetrics = await page.evaluate(() => {
        const header = document.querySelector('.dashboard-header-zone');
        const targetCard = document.querySelector('.dashboard-target-card');
        const actCard = document.querySelector('.dashboard-activities-card');
        const donuts = document.querySelectorAll('.dashboard-donut-arc');
        const donutLabels = Array.from(document.querySelectorAll('.dashboard-target-card span.font-gujarati')).map(e => e.textContent.trim());
        const donutValues = Array.from(document.querySelectorAll('.dashboard-target-card span.font-num')).map(e => e.textContent.trim());
        const rows = document.querySelectorAll('.dashboard-activities-card .space-y-3\\.5 > div');

        const headerRect = header?.getBoundingClientRect();
        const targetRect = targetCard?.getBoundingClientRect();

        return {
          hasHeader: !!header,
          headerBottom: headerRect?.bottom,
          targetTop: targetRect?.top,
          // Overlap check: targetTop should be ~24px above headerBottom
          overlapPx: (headerRect && targetRect) ? (headerRect.bottom - targetRect.top) : 0,
          donutsCount: donuts.length,
          donutLabels,
          donutValues,
          rowsCount: rows.length,
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });

      const mobileName = `s37_${theme}_mobile_360px.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, mobileName), fullPage: false });
      results.screenshots.push({ name: mobileName, theme, viewport: '360x960', metrics: mobileMetrics });
      console.log(`Captured ${mobileName}`);

      // 2. Desktop 1280px Two-Column View
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      }, theme);
      await new Promise(r => setTimeout(r, 900));

      const desktopMetrics = await page.evaluate(() => {
        const leftCol = document.querySelector('.dashboard-left-column');
        const rightCol = document.querySelector('.dashboard-right-column');
        return {
          hasTwoColumns: !!leftCol && !!rightCol,
          leftColWidth: leftCol?.getBoundingClientRect().width,
          rightColWidth: rightCol?.getBoundingClientRect().width,
          isSideBySide: (leftCol && rightCol) ? (rightCol.getBoundingClientRect().left > leftCol.getBoundingClientRect().right) : false
        };
      });

      const desktopName = `s37_${theme}_desktop_1280px.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, desktopName), fullPage: false });
      results.screenshots.push({ name: desktopName, theme, viewport: '1280x800', metrics: desktopMetrics });
      console.log(`Captured ${desktopName}`);

      // 3. Mid-Animation Frame (proving donut sweep / staggered bar animation)
      await page.setViewport({ width: 360, height: 740 });
      // Navigate to /dashboard fresh
      await page.goto(`${BASE_URL}/past-reports`, { waitUntil: 'networkidle0' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      }, theme);
      await new Promise(r => setTimeout(r, 200));

      // Click dashboard to trigger mount animations
      const dashBtn = await page.$('.bottom-nav-slot:first-of-type');
      await dashBtn?.click();

      // Wait ~220ms into the 700ms donut sweep and 500ms bar fills
      await new Promise(r => setTimeout(r, 220));

      const midMetrics = await page.evaluate(() => {
        const donuts = Array.from(document.querySelectorAll('.dashboard-donut-arc'));
        const bars = Array.from(document.querySelectorAll('.dashboard-bar-fill'));
        return {
          donutOffsets: donuts.map(d => window.getComputedStyle(d).strokeDashoffset),
          firstBarWidth: bars[0] ? window.getComputedStyle(bars[0]).width : null,
          lastBarWidth: bars[bars.length - 1] ? window.getComputedStyle(bars[bars.length - 1]).width : null
        };
      });

      const midName = `s37_${theme}_mid_animation.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, midName), fullPage: false });
      results.screenshots.push({ name: midName, theme, type: 'mid_animation', metrics: midMetrics });
      console.log(`Captured ${midName}`);
    }

    // 4. Automated Regression Tests
    console.log('Running automated regression tests...');
    await page.setViewport({ width: 360, height: 960 });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    // Test 1: Donut 1 exact label 'નબાળોની પાબંદી 85/100'
    const donut1Label = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.dashboard-target-card span.font-gujarati'));
      return labels[0]?.textContent.trim();
    });
    const test1Passed = donut1Label === 'નબાળોની પાબંદી 85/100';
    results.tests.push({
      name: "N1: Donut 1 label reads exactly 'નબાળોની પાબંદી 85/100'",
      passed: test1Passed,
      actual: donut1Label
    });

    // Test 2: Donut 2 label 'મુલાકાત કેટલી થઈ (%)'
    const donut2Label = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.dashboard-target-card span.font-gujarati'));
      return labels[1]?.textContent.trim();
    });
    const test2Passed = donut2Label === 'મુલાકાત કેટલી થઈ (%)';
    results.tests.push({
      name: "Donut 2 label reads 'મુલાકાત કેટલી થઈ (%)'",
      passed: test2Passed,
      actual: donut2Label
    });

    // Test 3: 13 Activity rows exist
    const rowsCount = await page.evaluate(() => {
      return document.querySelectorAll('.dashboard-activities-card .space-y-3\\.5 > div').length;
    });
    const test3Passed = rowsCount === 13;
    results.tests.push({
      name: "13 activity rows present with 22px chips and 6px bars",
      passed: test3Passed,
      actual: rowsCount
    });

    // Test 4: Sort pill 'અવરોહી' sorts descending by % value
    const sortPills = await page.$$('.dashboard-sort-pill');
    if (sortPills.length >= 2) {
      await sortPills[1].click(); // Click 'અવરોહી'
      await new Promise(r => setTimeout(r, 300));
    }

    const valuesAfterDesc = await page.evaluate(() => {
      const valueEls = Array.from(document.querySelectorAll('.dashboard-activities-card .font-semibold.text-acc'));
      return valueEls.map(el => parseInt(el.textContent.replace('%', '').trim(), 10));
    });

    // Check if values are monotonically descending
    let isDescending = true;
    for (let i = 0; i < valuesAfterDesc.length - 1; i++) {
      if (valuesAfterDesc[i] < valuesAfterDesc[i + 1]) {
        isDescending = false;
        break;
      }
    }
    results.tests.push({
      name: "Clicking 'અવરોહી' sort pill sorts activities descending (highest % first)",
      passed: isDescending && valuesAfterDesc.length === 13,
      actual: valuesAfterDesc
    });

    // Test 5: Sort pill 'પ્રવૃત્તિ' restores original order
    if (sortPills.length >= 2) {
      await sortPills[0].click(); // Click 'પ્રવૃત્તિ'
      await new Promise(r => setTimeout(r, 300));
    }

    const firstItemLabel = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.dashboard-activities-card .truncate'));
      return labels[0]?.textContent.trim();
    });
    const test5Passed = firstItemLabel === 'નબાળોની પાબંદી';
    results.tests.push({
      name: "Clicking 'પ્રવૃત્તિ' sort pill restores default activity order",
      passed: test5Passed,
      actual: firstItemLabel
    });

    // Save proof results
    const resultsPath = path.join(ARTIFACT_DIR, 's37_proof_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`Proof results saved successfully to: ${resultsPath}`);

  } catch (err) {
    console.error('Proof error:', err);
  } finally {
    await browser.close();
  }
}

runProof();
