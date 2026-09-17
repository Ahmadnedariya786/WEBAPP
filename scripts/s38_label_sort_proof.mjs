import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's38_proof_screenshots');

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

    // Ensure onboarding is complete
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });
    await page.reload({ waitUntil: 'networkidle0' });

    const themes = ['outdoor', 'premium'];

    for (const theme of themes) {
      console.log(`Testing theme: ${theme}`);

      // Set theme
      await page.setViewport({ width: 360, height: 860 });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
        document.documentElement.classList.remove('theme-switching');
      }, theme);
      await new Promise(r => setTimeout(r, 800));

      // 1. Default state: 'પ્રવૃત્તિ' active
      const defaultMetrics = await page.evaluate(() => {
        const donut1 = Array.from(document.querySelectorAll('.dashboard-target-card span.font-gujarati'))[0]?.textContent.trim();
        const row1 = Array.from(document.querySelectorAll('.dashboard-activities-card .truncate'))[0]?.textContent.trim();
        const sortPills = Array.from(document.querySelectorAll('.dashboard-sort-pill'));
        return {
          donut1Label: donut1,
          row1Label: row1,
          pills: sortPills.map(p => ({
            text: p.textContent.trim(),
            ariaLabel: p.getAttribute('aria-label'),
            isActive: p.classList.contains('dashboard-sort-pill-active'),
            hasSvgIcon: !!p.querySelector('svg')
          }))
        };
      });

      const defaultScreenshot = `s38_${theme}_default_activity_sort.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, defaultScreenshot) });
      results.screenshots.push({ name: defaultScreenshot, theme, state: 'default', metrics: defaultMetrics });
      console.log(`Captured ${defaultScreenshot}`);

      // 2. Click 'અવરોહી' pill -> sorted descending state
      const sortButtons = await page.$$('.dashboard-sort-pill');
      if (sortButtons.length >= 2) {
        await sortButtons[1].click();
        await new Promise(r => setTimeout(r, 400));
      }

      const descMetrics = await page.evaluate(() => {
        const row1 = Array.from(document.querySelectorAll('.dashboard-activities-card .truncate'))[0]?.textContent.trim();
        const row1Val = Array.from(document.querySelectorAll('.dashboard-activities-card .font-semibold.text-acc'))[0]?.textContent.trim();
        const sortPills = Array.from(document.querySelectorAll('.dashboard-sort-pill'));
        return {
          row1Label: row1,
          row1Value: row1Val,
          pills: sortPills.map(p => ({
            text: p.textContent.trim(),
            ariaLabel: p.getAttribute('aria-label'),
            isActive: p.classList.contains('dashboard-sort-pill-active')
          }))
        };
      });

      const descScreenshot = `s38_${theme}_descending_sort.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, descScreenshot) });
      results.screenshots.push({ name: descScreenshot, theme, state: 'descending', metrics: descMetrics });
      console.log(`Captured ${descScreenshot}`);
    }

    // 3. Automated Assertions
    console.log('Running automated assertions...');
    await page.setViewport({ width: 360, height: 860 });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Assertion 1: Donut 1 label is exactly 'નમાઝોની પાબંદી 85/100'
    const donut1Label = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.dashboard-target-card span.font-gujarati'));
      return labels[0]?.textContent.trim();
    });
    const a1Passed = donut1Label === 'નમાઝોની પાબંદી 85/100';
    results.tests.push({
      name: "D1: Donut 1 label is exactly 'નમાઝોની પાબંદી 85/100'",
      passed: a1Passed,
      actual: donut1Label
    });

    // Assertion 2: Row 1 label in default sort is exactly 'નમાઝોની પાબંદી'
    const row1Label = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.dashboard-activities-card .truncate'));
      return labels[0]?.textContent.trim();
    });
    const a2Passed = row1Label === 'નમાઝોની પાબંદી';
    results.tests.push({
      name: "D1: Row 1 label in default order is exactly 'નમાઝોની પાબંદી'",
      passed: a2Passed,
      actual: row1Label
    });

    // Assertion 3: Sort pills have distinct icons and aria-labels
    const sortPillDetails = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.dashboard-sort-pill'));
      return pills.map(p => ({
        text: p.textContent.trim(),
        ariaLabel: p.getAttribute('aria-label'),
        hasSvg: !!p.querySelector('svg')
      }));
    });
    const a3Passed =
      sortPillDetails.length === 2 &&
      sortPillDetails[0].ariaLabel === 'પ્રવૃત્તિ ક્રમ' &&
      sortPillDetails[1].ariaLabel === 'અવરોહી ક્રમ' &&
      sortPillDetails[0].hasSvg &&
      sortPillDetails[1].hasSvg;
    results.tests.push({
      name: "D2: Sort pills have distinct icons and proper aria-labels",
      passed: a3Passed,
      actual: sortPillDetails
    });

    // Assertion 4: Clicking 'અવરોહી' sorts activities descending
    const sortButtons = await page.$$('.dashboard-sort-pill');
    await sortButtons[1].click();
    await new Promise(r => setTimeout(r, 300));

    const descValues = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.dashboard-activities-card .font-semibold.text-acc'));
      return els.map(el => parseInt(el.textContent.replace('%', '').trim(), 10));
    });
    let isMonotonicDesc = true;
    for (let i = 0; i < descValues.length - 1; i++) {
      if (descValues[i] < descValues[i + 1]) {
        isMonotonicDesc = false;
        break;
      }
    }
    const a4Passed = isMonotonicDesc && descValues.length === 13;
    results.tests.push({
      name: "D2: Descending sort works correctly",
      passed: a4Passed,
      actual: descValues
    });

    // Assertion 5: Clicking 'પ્રવૃત્તિ' restores default order
    await sortButtons[0].click();
    await new Promise(r => setTimeout(r, 300));

    const restoredRow1 = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.dashboard-activities-card .truncate'));
      return labels[0]?.textContent.trim();
    });
    const a5Passed = restoredRow1 === 'નમાઝોની પાબંદી';
    results.tests.push({
      name: "D2: Default activity sequence restored correctly",
      passed: a5Passed,
      actual: restoredRow1
    });

    // Save proof results
    const resultsPath = path.join(ARTIFACT_DIR, 's38_proof_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`Proof results saved successfully to: ${resultsPath}`);

  } catch (err) {
    console.error('Proof error:', err);
  } finally {
    await browser.close();
  }
}

runProof();
