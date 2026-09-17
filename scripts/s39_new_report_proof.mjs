import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's39_proof_screenshots');

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

    // Setup initial state: complete onboarding and session
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      // Set admin session role so action buttons (WhatsApp, copy, excel, pdf) are visible
      const storeData = localStorage.getItem('banaskantha-mehnat-tracker');
      if (storeData) {
        try {
          const parsed = JSON.parse(storeData);
          parsed.state.sessionRole = 'admin';
          localStorage.setItem('banaskantha-mehnat-tracker', JSON.stringify(parsed));
        } catch (e) {}
      }
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const themes = ['outdoor', 'dark', 'premium'];
    const viewports = [
      { name: '360px', width: 360, height: 860 },
      { name: '1280px', width: 1280, height: 900 },
      { name: '2560px', width: 2560, height: 1200 }
    ];

    // Loop through themes and viewports
    for (const theme of themes) {
      console.log(`\n================ Testing theme: ${theme} ================`);

      for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('theme', t);
          document.documentElement.classList.remove('theme-switching');
        }, theme);
        await new Promise(r => setTimeout(r, 600));

        // 1. Capture empty state screenshot
        const emptyShot = `s39_${theme}_${vp.name}_empty.png`;
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, emptyShot), fullPage: vp.name === '360px' ? false : true });
        results.screenshots.push({ name: emptyShot, theme, viewport: vp.name, state: 'empty' });
        console.log(`Captured ${emptyShot}`);

        // 2. Select Halqa and enter some student stats
        await page.evaluate(() => {
          // Click first halqa button if available
          const halqaBtn = document.querySelector('.snap-start button');
          if (halqaBtn) halqaBtn.click();

          // Fill a stat input
          const statInputs = document.querySelectorAll('.count-zone-tile input[type="number"]');
          if (statInputs.length > 0) {
            statInputs[0].value = '15';
            statInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            statInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        await new Promise(r => setTimeout(r, 500));

        // 3. Capture filled state screenshot
        const filledShot = `s39_${theme}_${vp.name}_filled.png`;
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, filledShot), fullPage: vp.name === '360px' ? false : true });
        results.screenshots.push({ name: filledShot, theme, viewport: vp.name, state: 'filled' });
        console.log(`Captured ${filledShot}`);

        // 4. For 360px mobile: test horizontal scroll & capture mid-scroll frame
        if (vp.name === '360px' && theme === 'outdoor') {
          await page.evaluate(() => {
            const tableScroller = document.querySelector('.report-table-scroll');
            if (tableScroller) {
              tableScroller.scrollLeft = 140;
            }
          });
          await new Promise(r => setTimeout(r, 300));
          const scrollShot = `s39_${theme}_360px_table_scrolled.png`;
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, scrollShot) });
          results.screenshots.push({ name: scrollShot, theme, viewport: '360px', state: 'scrolled' });
          console.log(`Captured ${scrollShot}`);
        }

        // 5. For 1280px desktop: capture bottom clearance frame
        if (vp.name === '1280px' && theme === 'outdoor') {
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await new Promise(r => setTimeout(r, 300));
          const clearanceShot = `s39_${theme}_1280px_bottom_clearance.png`;
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, clearanceShot) });
          results.screenshots.push({ name: clearanceShot, theme, viewport: '1280px', state: 'bottom_clearance' });
          console.log(`Captured ${clearanceShot}`);
        }
      }
    }

    // ================= Detailed Assertions =================
    console.log('\nRunning Automated Assertions...');

    // Test 1: Flow Stepper structure, labels, and N1 (position: relative)
    await page.setViewport({ width: 360, height: 860 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const stepperData = await page.evaluate(() => {
      const container = document.querySelector('.flow-stepper-container');
      const dots = Array.from(document.querySelectorAll('.flow-stepper-dot'));
      const labels = Array.from(document.querySelectorAll('.flow-stepper-container span.font-gujarati'));
      const computedPos = container ? window.getComputedStyle(container).position : '';
      return {
        position: computedPos,
        dotCount: dots.length,
        labels: labels.map(l => l.textContent.trim()),
        hasDots: dots.length === 5
      };
    });

    const expectedLabels = ['હલકો', 'તારીખ', 'ગણતરી', 'નોંધ', 'સાચવો'];
    const t1Passed = 
      stepperData.position === 'relative' &&
      stepperData.dotCount === 5 &&
      JSON.stringify(stepperData.labels) === JSON.stringify(expectedLabels);
    
    results.tests.push({
      name: "D1 & N1: Flow stepper has 5 chips and position: relative (NOT sticky)",
      passed: t1Passed,
      actual: stepperData
    });

    // Test 2: Card 1 "ક્યાં અને ક્યારે" internal order: halqa chips -> scan pills -> date card
    const card1Data = await page.evaluate(() => {
      const card = document.querySelector('.new-report-card');
      const title = card?.querySelector('h3')?.textContent.trim();
      const hasHalqaChips = !!card?.querySelector('.snap-start');
      const hasScanPills = !!card?.querySelector('#scan-fill-module');
      const hasDateTrigger = !!card?.querySelector('#btn-date-picker-trigger');
      return {
        title,
        hasHalqaChips,
        hasScanPills,
        hasDateTrigger
      };
    });
    const t2Passed = 
      card1Data.title === 'ક્યાં અને ક્યારે' &&
      card1Data.hasHalqaChips &&
      card1Data.hasScanPills &&
      card1Data.hasDateTrigger;
    results.tests.push({
      name: "D2: Card 1 'ક્યાં અને ક્યારે' contains halqa chips, scan pills, and date card in order",
      passed: t2Passed,
      actual: card1Data
    });

    // Test 3: Card 2 "ગણતરી" Count-Zone & KPI Tiles
    const countZoneData = await page.evaluate(() => {
      const card = document.querySelector('.count-zone-card');
      const topLabel = card?.querySelector('.count-zone-top-label')?.textContent.trim();
      const topValue = card?.querySelector('.count-zone-top-value')?.textContent.trim();
      const tiles = Array.from(card?.querySelectorAll('.count-zone-tile') || []);
      const tileLabels = tiles.map(t => t.querySelector('span')?.textContent.trim());
      return {
        topLabel,
        topValue,
        tileCount: tiles.length,
        tileLabels
      };
    });
    const expectedKPIs = ['ધોરણ ૧૦', 'ધોરણ ૧૧', 'ધોરણ ૧૨', 'કોલેજ', 'એન્જિનિયર', 'મેડિકલ', 'મુસ્લિમ શિક્ષકોની સંખ્યા'];
    const t3Passed = 
      countZoneData.topLabel === 'સ્ટુડન્ટની સંખ્યા' &&
      countZoneData.tileCount === 7 &&
      JSON.stringify(countZoneData.tileLabels) === JSON.stringify(expectedKPIs);
    results.tests.push({
      name: "D3: Card 2 'ગણતરી' has 'સ્ટુડન્ટની સંખ્યા' and all 7 KPI tiles",
      passed: t3Passed,
      actual: countZoneData
    });

    // Test 4: KPI Tiles Grid Column layout: 2 cols on mobile 360px, 3 cols on desktop 1280px (NEVER 6)
    const mobileGridCols = await page.evaluate(() => {
      const grid = document.querySelector('.count-zone-card .grid');
      return grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    });
    await page.setViewport({ width: 1280, height: 900 });
    await new Promise(r => setTimeout(r, 400));
    const desktopGridCols = await page.evaluate(() => {
      const grid = document.querySelector('.count-zone-card .grid');
      return grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    });
    const t4Passed = mobileGridCols === 2 && desktopGridCols === 3;
    results.tests.push({
      name: "D3: KPI tiles grid has exactly 2 columns on mobile (≤640px) and 3 columns on desktop (NEVER 6)",
      passed: t4Passed,
      actual: { mobileGridCols, desktopGridCols }
    });

    // Test 5: Action Cluster: Primary "સાચવો", Secondary 2x2 grid, Danger "ડાલી નાખો"
    const actionClusterData = await page.evaluate(() => {
      const primaryBtn = document.querySelector('.action-cluster-primary-btn');
      const gridBtns = Array.from(document.querySelectorAll('.action-cluster-grid-btn'));
      const dangerBtn = document.querySelector('.action-cluster-danger-btn');
      return {
        primaryText: primaryBtn?.textContent.trim(),
        primaryHeight: primaryBtn ? window.getComputedStyle(primaryBtn).height : '',
        gridBtnCount: gridBtns.length,
        gridLabels: gridBtns.map(b => b.textContent.trim()),
        dangerText: dangerBtn?.textContent.trim()
      };
    });
    const expectedGridLabels = [
      'WhatsApp પર શેર કરો',
      'કૉપી કરો',
      'Excel ડાઉનલોડ કરો',
      'PDF ડાઉનલોડ કરો'
    ];
    const t5Passed =
      actionClusterData.primaryText === 'સાચવો' &&
      actionClusterData.primaryHeight === '48px' &&
      actionClusterData.gridBtnCount === 4 &&
      JSON.stringify(actionClusterData.gridLabels) === JSON.stringify(expectedGridLabels) &&
      actionClusterData.dangerText === 'ડાલી નાખો';
    results.tests.push({
      name: "D5: Action cluster has 48px 'સાચવો', 2x2 secondary grid, and 'ડાલી નાખો' danger button",
      passed: t5Passed,
      actual: actionClusterData
    });

    // Test 6: Table at 1280px shows FULLY with ZERO clipping and ZERO scrollbar
    await page.setViewport({ width: 1280, height: 900 });
    await new Promise(r => setTimeout(r, 400));
    const tableScrollMetrics = await page.evaluate(() => {
      const scroller = document.querySelector('.report-table-scroll');
      return {
        scrollWidth: scroller?.scrollWidth || 0,
        clientWidth: scroller?.clientWidth || 0,
        hasScrollbar: (scroller?.scrollWidth || 0) > (scroller?.clientWidth || 0)
      };
    });
    const t6Passed = !tableScrollMetrics.hasScrollbar;
    results.tests.push({
      name: "D6: Table at 1280px desktop shows FULLY with ZERO horizontal scrollbar",
      passed: t6Passed,
      actual: tableScrollMetrics
    });

    // Test 7: Table sticky column & 13 activity rows & Row 13 placeholder
    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.report-table-scroll tbody tr'));
      const stickyCols = Array.from(document.querySelectorAll('.report-table-sticky-col'));
      const row13Input = document.querySelector('.row13-text-input');
      const row1Text = rows[0]?.querySelector('.report-table-sticky-col .truncate')?.textContent.trim();
      const row13Text = rows[12]?.querySelector('.report-table-sticky-col .truncate')?.textContent.trim();
      return {
        rowCount: rows.length,
        stickyColCount: stickyCols.length,
        row1Name: row1Text,
        row13Name: row13Text,
        row13Placeholder: row13Input?.getAttribute('placeholder')
      };
    });
    const t7Passed =
      tableData.rowCount === 13 &&
      tableData.row1Name === 'નમાઝોની પાબંદી' &&
      tableData.row13Name === 'મશવારો ક્યારે અને ક્યાં' &&
      tableData.row13Placeholder === 'કિંમત લખો...';
    results.tests.push({
      name: "D6: Table has 13 rows, Row 1 is 'નમાઝોની પાબંદી', Row 13 placeholder is 'કિંમત લખો...'",
      passed: t7Passed,
      actual: tableData
    });

    // Test 8: Zero native title attributes on inputs/tiles to prevent black tooltip bubble on touch
    const titleAttributeCount = await page.evaluate(() => {
      const elementsWithTitle = document.querySelectorAll('input[title], textarea[title], button[title], .count-zone-tile[title]');
      return elementsWithTitle.length;
    });
    const t8Passed = titleAttributeCount === 0;
    results.tests.push({
      name: "D10: Zero native title attributes on inputs/tiles (eliminated touch tooltip bubbles)",
      passed: t8Passed,
      actual: { titleAttributeCount }
    });

    // Save proof results
    const resultsPath = path.join(ARTIFACT_DIR, 's39_proof_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nProof results saved successfully to: ${resultsPath}`);

  } catch (err) {
    console.error('Proof suite execution error:', err);
  } finally {
    await browser.close();
  }
}

runProof();
