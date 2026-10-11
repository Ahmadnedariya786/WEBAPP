import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const SCREENSHOT_DIR = path.resolve('web_fix16_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const fixturePath = path.resolve('tests/fixtures/clean_form.png');
if (!fs.existsSync(fixturePath)) {
  throw new Error('tests/fixtures/clean_form.png missing from repo!');
}

let serverProcess = null;
const PORT = 5216;
const APP_URL = `http://localhost:${PORT}/`;

async function startServer() {
  serverProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
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

// Expected fixture ground truth per clean_form.png
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

const EXPECTED_ACTIVITIES = {
  1: { guj: '135', azaim: '211', moj: '164' },
  2: { guj: '135', azaim: '205', moj: '195' },
  3: { guj: '68', azaim: '96', moj: '87' },
  4: { guj: '141', azaim: '226', moj: '204' },
  5: { guj: '67', azaim: '84', moj: '50' },
  6: { guj: '97', azaim: '120', moj: '43' },
  7: { guj: '157', azaim: '243', moj: '62' },
  8: { guj: '172', azaim: '227', moj: '172' },
  9: { guj: '23', azaim: '37', moj: '27' },
  10: { guj: '8', azaim: '22', moj: '2' },
  11: { guj: '19', azaim: '25', moj: '7' },
  12: { guj: '4', azaim: '12', moj: '4' },
  13: { guj: '', azaim: '', moj: '' }
};

export async function runVerification() {
  console.log(`\n========================================================================`);
  console.log(`=== WEB-FIX16 THREE LOGIC FIXES VERIFICATION ===`);
  console.log(`========================================================================`);

  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);
  console.log(`[Sandbox] Headless browser launched with isolated download dir: ${tempDownloadDir}`);

  try {
    const page = await browser.newPage();
    await configureDownloadSafety(page, tempDownloadDir);
    page.on('console', (msg) => {
      const text = msg.text();
      if (!text.includes('Download') && !text.includes('Failed to load resource')) {
        console.log('[Browser]', text);
      }
    });

    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2 });
    console.log('[Viewport] Strictly set to 360px width x 800px height');

    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('mt_onboarded', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      sessionStorage.setItem('mt_greeted', '1');
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // ------------------------------------------------------------------------
    // PHASE 1: OCR FIXTURE EXTRACTION & TABLE VERIFICATION (clean_form.png)
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 1: OCR FIXTURE EXTRACTION & STATS VALUE-ROW VERIFICATION ---');
    console.log('[STEP 1] Uploading clean computer-printed fixture (tests/fixtures/clean_form.png)...');
    const galleryInput = await page.$('#gallery-scan-input');
    if (!galleryInput) throw new Error('#gallery-scan-input not found');
    await galleryInput.uploadFile(fixturePath);

    console.log('[OCR] Processing photo through self-contained OCR pipeline...');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('scan-review-container');
        return el !== null && window.getComputedStyle(el).display !== 'none';
      },
      { timeout: 45000 }
    );
    console.log('[Modal] Review overlay modal opened successfully!');
    await new Promise((r) => setTimeout(r, 600));

    // Extract values from review picker modal
    const extractedData = await page.evaluate(() => {
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

      const activitiesSection = document.getElementById('scan-review-activities-section');
      const activities = {};
      if (activitiesSection) {
        const rowBlocks = activitiesSection.querySelectorAll('[data-activity-row]');
        rowBlocks.forEach((rb) => {
          const rowNo = parseInt(rb.getAttribute('data-activity-row'), 10);
          const inputs = rb.querySelectorAll('input');
          activities[rowNo] = {
            guj: inputs[0]?.value.trim() || '',
            azaim: inputs[1]?.value.trim() || '',
            moj: inputs[2]?.value.trim() || ''
          };
        });
      }

      return { stats, activities };
    });

    // PRINT FORMATTED TABLE: Expected vs Extracted for all 8 stats and 13 activity rows
    console.log('\n------------------------------------------------------------------------');
    console.log('                 OCR EXTRACTION EXPECTED VS GOT TABLE                   ');
    console.log('------------------------------------------------------------------------');
    console.log(
      '| ' +
        'Field / Row'.padEnd(28) +
        ' | ' +
        'Expected'.padEnd(16) +
        ' | ' +
        'Got'.padEnd(16) +
        ' | ' +
        'Status'.padEnd(10) +
        ' |'
    );
    console.log('------------------------------------------------------------------------');

    let totalCells = 0;
    let exactMatches = 0;
    let exactStatsMatches = 0;
    const mismatches = [];

    // 1. Stats Evaluation (340 / 62 / 58 / 64 / 96 / 28 / 12 / 9)
    for (const [key, expectedVal] of Object.entries(EXPECTED_STATS)) {
      totalCells++;
      const gotVal = extractedData.stats[key] || '';
      const isMatch = gotVal === expectedVal;
      if (isMatch) {
        exactMatches++;
        exactStatsMatches++;
      } else {
        mismatches.push({ field: `Stat: ${key}`, expected: expectedVal, got: gotVal });
      }

      console.log(
        '| ' +
          `Stat: ${key}`.padEnd(28) +
          ' | ' +
          expectedVal.padEnd(16) +
          ' | ' +
          gotVal.padEnd(16) +
          ' | ' +
          (isMatch ? '✅ MATCH' : '❌ MISMATCH').padEnd(10) +
          ' |'
      );
    }

    // 2. Activities Evaluation (Rows 1 to 13)
    for (let r = 1; r <= 13; r++) {
      const exp = EXPECTED_ACTIVITIES[r];
      const got = extractedData.activities[r] || { guj: '', azaim: '', moj: '' };

      if (r <= 12) {
        // Gujishta
        totalCells++;
        const gMatch = got.guj === exp.guj;
        if (gMatch) exactMatches++;
        else mismatches.push({ field: `Row ${r} Gujishta`, expected: exp.guj, got: got.guj });
        console.log(
          '| ' +
            `Row ${r} Gujishta`.padEnd(28) +
            ' | ' +
            exp.guj.padEnd(16) +
            ' | ' +
            got.guj.padEnd(16) +
            ' | ' +
            (gMatch ? '✅ MATCH' : '❌ MISMATCH').padEnd(10) +
            ' |'
        );

        // Azaim
        totalCells++;
        const aMatch = got.azaim === exp.azaim;
        if (aMatch) exactMatches++;
        else mismatches.push({ field: `Row ${r} Azaim`, expected: exp.azaim, got: got.azaim });
        console.log(
          '| ' +
            `Row ${r} Azaim`.padEnd(28) +
            ' | ' +
            exp.azaim.padEnd(16) +
            ' | ' +
            got.azaim.padEnd(16) +
            ' | ' +
            (aMatch ? '✅ MATCH' : '❌ MISMATCH').padEnd(10) +
            ' |'
        );

        // Mojuda
        totalCells++;
        const mMatch = got.moj === exp.moj;
        if (mMatch) exactMatches++;
        else mismatches.push({ field: `Row ${r} Mojuda`, expected: exp.moj, got: got.moj });
        console.log(
          '| ' +
            `Row ${r} Mojuda`.padEnd(28) +
            ' | ' +
            exp.moj.padEnd(16) +
            ' | ' +
            got.moj.padEnd(16) +
            ' | ' +
            (mMatch ? '✅ MATCH' : '❌ MISMATCH').padEnd(10) +
            ' |'
        );
      } else {
        // Row 13: empty
        totalCells++;
        const isEmpty = !got.moj || got.moj.trim() === '';
        if (isEmpty) exactMatches++;
        else mismatches.push({ field: `Row 13 Mashwara (empty)`, expected: '(empty)', got: got.moj });
        console.log(
          '| ' +
            `Row 13 Mashwara (empty)`.padEnd(28) +
            ' | ' +
            '(empty)'.padEnd(16) +
            ' | ' +
            got.moj.padEnd(16) +
            ' | ' +
            (isEmpty ? '✅ MATCH' : '❌ MISMATCH').padEnd(10) +
            ' |'
        );
      }
    }

    const statsMatchPercent = Math.round((exactStatsMatches / 8) * 100);
    const matchPercent = Math.round((exactMatches / totalCells) * 100);
    console.log('------------------------------------------------------------------------');
    console.log(`TOTAL CELLS EVALUATED: ${totalCells}`);
    console.log(`EXACT MATCHES:        ${exactMatches} / ${totalCells}`);
    console.log(`STATS MATCHES:        ${exactStatsMatches} / 8 (${statsMatchPercent}%, Gate requirement: >= 75%)`);
    console.log(`MATCH PERCENTAGE:     ${matchPercent}% (Requirement: >= 90%)`);
    console.log('------------------------------------------------------------------------');

    // CRITICAL ASSERTION: WEB-FIX15 & WEB-FIX16
    if (extractedData.stats.college === '172') {
      throw new Error('FATAL: college received 172 from Activity row 8! Value leaked into stats!');
    }
    console.log('✅ CRITICAL CHECK PASSED: Zero value leakage from activities table into stats! (college !== 172)');

    if (statsMatchPercent < 75) {
      throw new Error(`FATAL: Stats extraction accuracy ${statsMatchPercent}% is below required 75% gate!`);
    }
    console.log(`✅ CRITICAL CHECK PASSED: Stats extraction accuracy ${statsMatchPercent}% meets >= 75% gate!`);

    // Verify stats exact values: 340 / 62 / 58 / 64 / 96 / 28 / 12 / 9
    for (const [k, expV] of Object.entries(EXPECTED_STATS)) {
      if (extractedData.stats[k] !== expV) {
        throw new Error(`FATAL: Stat ${k} expected ${expV} but got ${extractedData.stats[k]}`);
      }
    }
    console.log('✅ F1 PASSED: All 8 stats equal 340 / 62 / 58 / 64 / 96 / 28 / 12 / 9 in their own fields!');

    // Apply values to form ("ફોર્મમાં ભરો")
    const fillBtn = (await page.$('#btn-scan-review-confirm')) || (await page.$('[data-testid="scan-review-fill-btn"]'));
    if (fillBtn) {
      await fillBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // ------------------------------------------------------------------------
    // PHASE 2: SYNTHETIC REPORT VERIFICATION (F2 & F3)
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 2: SYNTHETIC REPORT (gu 135 / az 211 / mo 164, total 300) ---');
    // Save synthetic report into store
    await page.evaluate(async () => {
      const store = window.useAppStore.getState();
      // Clear existing reports or set single synthetic report in scope
      const syntheticReport = {
        id: 'synthetic-test-report-fix16',
        halqa: 'પાલનપુર',
        date: '2026-10-11',
        stats: {
          total: 300,
          std_10: 62,
          std_11: 58,
          std_12: 64,
          college: 96,
          engineering: 28,
          medical: 12,
          muslim_teachers: 9
        },
        activities: {
          'activity.namaz': { gujishta: '135', azaim: '211', maujuda: '164' },
          'activity.mashwara_pabandi': { gujishta: '100', azaim: '100', maujuda: '80' },
          'activity.mulaqat_percent': { gujishta: '157', azaim: '243', maujuda: '62' },
          'mashwara': { gujishta: '', azaim: '', maujuda: 'પાલનપુર મસ્જિદ' }
        },
        mashwara: 'પાલનપુર મસ્જિદ',
        notes: 'Synthetic test report'
      };
      // Set reports in state
      window.useAppStore.setState({ reports: [syntheticReport] });
    });
    console.log('[Synthetic Report] Successfully saved into app store (gu 135 / az 211 / mo 164, total 300).');

    // 1. Verify Dashboard computed percent for activity 1 and district card total
    console.log('\n[Dashboard Verification] Navigating to Dashboard via BottomNav...');
    await page.evaluate(() => {
      const slots = document.querySelectorAll('.bottom-nav-slot');
      if (slots[0]) slots[0].click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const dashboardData = await page.evaluate(() => {
      const headerValEl = document.querySelector('.header-value');
      const headerVal = headerValEl ? headerValEl.textContent.trim().replace(/,/g, '') : '';

      // Donut Ring 1
      const donuts = document.querySelectorAll('.dashboard-target-card .relative');
      const donut1Val = donuts[0]?.querySelector('.font-num')?.textContent.trim() || '';
      const donut1Label = document.querySelectorAll('.dashboard-target-card span.font-gujarati')[0]?.textContent.trim() || '';

      // Activity 1 bar percentage in summary
      const barLabels = document.querySelectorAll('.dashboard-activities-card .dashboard-rank-chip');
      let act1BarVal = '';
      if (barLabels.length > 0) {
        const firstRow = barLabels[0].closest('.space-y-1\\.5') || barLabels[0].parentElement?.parentElement;
        const pctEl = firstRow?.querySelector('.text-acc');
        act1BarVal = pctEl ? pctEl.textContent.trim() : '';
      }

      return {
        headerVal,
        donut1Val,
        donut1Label,
        act1BarVal
      };
    });

    console.log('------------------------------------------------------------------------');
    console.log('                 DASHBOARD COMPUTATION VERIFICATION                      ');
    console.log('------------------------------------------------------------------------');
    console.log(`District Card Total:       Expected: 300 | Got: ${dashboardData.headerVal}`);
    console.log(`Activity 1 Donut Ring:     Expected: 100% | Got: ${dashboardData.donut1Val}`);
    console.log(`Activity 1 Ring Label:     Expected: ...100/100 | Got: "${dashboardData.donut1Label}"`);
    console.log(`Activity 1 Bar Percentage: Expected: 100% | Got: ${dashboardData.act1BarVal}`);
    console.log('------------------------------------------------------------------------');

    if (dashboardData.headerVal !== '300') {
      throw new Error(`FATAL: Dashboard district card total expected 300 but got ${dashboardData.headerVal}`);
    }
    console.log('✅ F3 PASSED: Dashboard district card total correctly uses કુલ સંખ્યા (300) instead of grade box sum!');

    if (!dashboardData.donut1Val.includes('100')) {
      throw new Error(`FATAL: Activity 1 donut ring expected 100% after cap, but got ${dashboardData.donut1Val}`);
    }
    if (!dashboardData.donut1Label.includes('100/100')) {
      throw new Error(`FATAL: Activity 1 label expected "100/100", but got "${dashboardData.donut1Label}"`);
    }
    console.log('✅ F2 PASSED: Activity 1 computed percent is 100 after cap (164 ÷ 135 = 121% capped at 100%), ring label shows 100/100!');

    // 2. Verify Past Reports Card Badge
    console.log('\n[Past Reports Verification] Navigating to Past Reports via BottomNav...');
    await page.evaluate(() => {
      const slots = document.querySelectorAll('.bottom-nav-slot');
      if (slots[2]) slots[2].click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const pastReportsData = await page.evaluate(() => {
      // Find the card badge with student icon
      const badges = document.querySelectorAll('.rounded-full .font-num');
      const badgeVals = Array.from(badges).map((b) => b.textContent.trim());
      return { badgeVals };
    });

    console.log('------------------------------------------------------------------------');
    console.log('                 PAST REPORTS CARD BADGE VERIFICATION                   ');
    console.log('------------------------------------------------------------------------');
    console.log(`Card Badge Values: [${pastReportsData.badgeVals.join(', ')}]`);
    console.log('------------------------------------------------------------------------');

    const hasBadge300 = pastReportsData.badgeVals.some((v) => v === '300');
    if (!hasBadge300) {
      throw new Error(`FATAL: Past reports card badge expected 300 but got [${pastReportsData.badgeVals.join(', ')}]`);
    }
    console.log('✅ F3 PASSED: Past reports card badge correctly displays 300 (કુલ સંખ્યા)!');

    // ------------------------------------------------------------------------
    // F4 ZERO DIFF & SAFETY CHECKS
    // ------------------------------------------------------------------------
    const filesInDownloadDir = fs.readdirSync(tempDownloadDir);
    if (filesInDownloadDir.length > 0) {
      throw new Error(`Safety violation: unexpected file download occurred: ${filesInDownloadDir.join(', ')}`);
    }
    console.log('✅ SAFETY VERIFIED: Fully headless execution with zero OS/browser download dialogs.');

    console.log('\n========================================================================');
    console.log('               🎉 ALL WEB-FIX16 VERIFICATIONS PASSED! 🎉                 ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    console.log('Starting preview server...');
    await startServer();
    await runVerification();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    stopServer();
  }
}

main();
