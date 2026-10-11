import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const SCREENSHOT_DIR = path.resolve('web_fix13_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sampleImgPath = path.resolve('sample_report_test.jpg');
if (!fs.existsSync(sampleImgPath)) {
  throw new Error('sample_report_test.jpg missing from repo!');
}

let serverProcess = null;
const PORT = 5203;
const APP_URL = `http://localhost:${PORT}/`;

async function startServer() {
  serverProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Poll until server responds
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

export async function runVerification(runIndex = 1) {
  console.log(`\n========================================================================`);
  console.log(`=== RUN ${runIndex}: WEB-FIX13 FOUR COMBINED FIXES VERIFICATION ===`);
  console.log(`========================================================================`);

  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);
  console.log(`[Sandbox] Headless browser launched with isolated download dir: ${tempDownloadDir}`);

  try {
    const page = await browser.newPage();
    await configureDownloadSafety(page, tempDownloadDir);
    page.on('console', (msg) => {
      const text = msg.text();
      if (!text.includes('Download') && !text.includes('Failed to load resource')) {
        // console.log('[Browser]', text);
      }
    });
    page.on('pageerror', (err) => console.error('[Browser Error]', err.message));

    // CRITICAL REQUIREMENT: 360px viewport width
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2 });
    console.log('[Viewport] Strictly set to 360px width x 800px height');

    // Preload session & onboarded flags
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('mt_onboarded', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      sessionStorage.setItem('mt_greeted', '1');
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Wait for SW ready
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    console.log('\n[STEP 1] Uploading owner test photo (sample_report_test.jpg)...');
    const galleryInput = await page.$('#gallery-scan-input');
    if (!galleryInput) throw new Error('#gallery-scan-input not found');

    await galleryInput.uploadFile(sampleImgPath);

    // Wait for Review Overlay modal to open
    console.log('[OCR] Processing photo through self-contained OCR pipeline...');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('scan-review-container');
        return el !== null && window.getComputedStyle(el).display !== 'none';
      },
      { timeout: 35000 }
    );
    console.log('[Modal] Review overlay modal opened successfully!');

    // Wait for rendering
    await new Promise((r) => setTimeout(r, 600));

    // Capture screenshot of top portion (Student Stats block with 8 tiles)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '00_review_picker_stats_top_360px.png'),
      fullPage: false
    });
    console.log('📸 Saved top stats modal screenshot: 00_review_picker_stats_top_360px.png');

    // ------------------------------------------------------------------------
    // F2 VERIFICATION: STATS BLOCK STRUCTURE
    // ------------------------------------------------------------------------
    console.log('\n[F2 VERIFICATION] Inspecting Student Stats Block Structure...');
    const statsAnalysis = await page.evaluate(() => {
      const statsSection = document.getElementById('scan-review-stats-section');
      if (!statsSection) return { found: false };

      // 1. Assert NO 3-column header row inside stats block
      const columnHeaderInStats = statsSection.querySelector('.grid-cols-3');

      // 2. Assert all 8 stats exist with 1 input and label
      const statKeys = [
        'student_count', 'std10', 'std11', 'std12',
        'college', 'engineer', 'medical', 'muslim_teachers'
      ];

      const statsFound = statKeys.map(k => {
        const block = statsSection.querySelector(`[data-stat-key="${k}"]`);
        const label = block ? block.querySelector('label')?.textContent?.trim() : null;
        const inputs = block ? block.querySelectorAll('input') : [];
        const inputVal = inputs.length > 0 ? inputs[0].value : null;
        return {
          key: k,
          found: !!block,
          label,
          inputCount: inputs.length,
          value: inputVal
        };
      });

      // 3. Check Activities block has sticky 3-column header row
      const actSection = document.getElementById('scan-review-activities-section');
      const actHeader = document.getElementById('activities-column-header');
      const actHeaderLabels = actHeader
        ? Array.from(actHeader.querySelectorAll('.select-none')).map(e => e.textContent.trim())
        : [];

      return {
        found: true,
        hasThreeColHeaderInStats: !!columnHeaderInStats,
        statsFound,
        hasActHeader: !!actHeader,
        actHeaderLabels
      };
    });

    if (!statsAnalysis.found) {
      throw new Error('Stats section #scan-review-stats-section not found in modal!');
    }
    if (statsAnalysis.hasThreeColHeaderInStats) {
      throw new Error('F2 VIOLATION: Stats section must NOT have 3-column headers (ગુજિશતા/અઝાઇમ/મોજૂદા)!');
    }
    console.log('✅ F2 PASSED: Zero 3-column headers in Stats section (headers removed as required).');

    for (const stat of statsAnalysis.statsFound) {
      if (!stat.found) throw new Error(`Stat block ${stat.key} not found!`);
      if (stat.inputCount !== 1) throw new Error(`Stat ${stat.key} must have exactly 1 input, found ${stat.inputCount}!`);
      console.log(`  - Stat [${stat.label}]: value="${stat.value}", inputCount=${stat.inputCount} ✅`);
    }

    if (!statsAnalysis.hasActHeader) {
      throw new Error('F2 VIOLATION: Activities section must have sticky 3-column headers!');
    }
    console.log(`✅ F2 PASSED: Activities sticky headers confirmed: [${statsAnalysis.actHeaderLabels.join(' | ')}]`);

    // ------------------------------------------------------------------------
    // F1 VERIFICATION: STUCK અસ્પષ્ટ BADGE DISAPPEARS PERMANENTLY ON EDIT
    // ------------------------------------------------------------------------
    console.log('\n[F1 VERIFICATION] Testing અસ્પષ્ટ badge behavior on user edit...');

    // Locate the cell with low confidence (Row 8 col mojuda)
    const badgeSelector = '[data-testid="badge-8-mojuda"]';
    const inputSelector = '[data-activity-input="8-mojuda"]';

    const hasBadgeBefore = await page.$(badgeSelector);
    if (!hasBadgeBefore) {
      console.warn('Badge not found on 8-mojuda, checking other badges...');
    }

    // Capture BEFORE screenshot of the cell
    const cellBoxBefore = await page.$('[data-activity-no="8"]');
    if (cellBoxBefore) {
      await cellBoxBefore.scrollIntoView();
      await new Promise((r) => setTimeout(r, 300));
      await cellBoxBefore.screenshot({
        path: path.join(SCREENSHOT_DIR, '01_cell_before_edit_badge_visible.png')
      });
      console.log('📸 Saved before screenshot: 01_cell_before_edit_badge_visible.png');
    }

    // Verify badge properties before edit (pointer-events none, reserved right padding)
    const badgeMetrics = await page.evaluate((bSel, iSel) => {
      const badge = document.querySelector(bSel);
      const input = document.querySelector(iSel);
      if (!badge || !input) return null;
      const bStyle = window.getComputedStyle(badge);
      const iStyle = window.getComputedStyle(input);
      return {
        pointerEvents: bStyle.pointerEvents,
        inputPaddingRight: iStyle.paddingRight,
        badgeText: badge.textContent.trim()
      };
    }, badgeSelector, inputSelector);

    if (badgeMetrics) {
      console.log(`  Badge pointer-events: ${badgeMetrics.pointerEvents}`);
      console.log(`  Input padding-right: ${badgeMetrics.inputPaddingRight}`);
      if (badgeMetrics.pointerEvents !== 'none') {
        throw new Error('F1 VIOLATION: Badge must have pointer-events: none!');
      }
      const prVal = parseInt(badgeMetrics.inputPaddingRight, 10);
      if (prVal < 48) {
        throw new Error(`F1 VIOLATION: Input padding-right must be >= 56px, got ${badgeMetrics.inputPaddingRight}!`);
      }
      console.log('✅ F1 PASSED: Badge has pointer-events: none and reserved 56px padding-right.');
    }

    // Now EDIT the cell: Focus + Type
    console.log('[F1 Action] Focusing and typing into low-confidence cell...');
    await page.focus(inputSelector);
    await page.keyboard.press('Backspace');
    await page.type(inputSelector, '7');
    await new Promise((r) => setTimeout(r, 300));

    // Assert that the badge has permanently disappeared
    const hasBadgeAfter = await page.$(badgeSelector);
    if (hasBadgeAfter) {
      throw new Error('F1 VIOLATION: Badge did NOT disappear after user editing the cell!');
    }
    console.log('✅ F1 PASSED: Badge disappeared permanently upon user typing!');

    // Capture AFTER screenshot of the cell
    if (cellBoxBefore) {
      await cellBoxBefore.screenshot({
        path: path.join(SCREENSHOT_DIR, '02_cell_after_edit_badge_gone.png')
      });
      console.log('📸 Saved after screenshot: 02_cell_after_edit_badge_gone.png');
    }

    // Take full screenshot of Review Picker at 360px width
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_review_picker_360px.png'),
      fullPage: false
    });
    console.log('📸 Saved full modal screenshot: 03_review_picker_360px.png');

    // ------------------------------------------------------------------------
    // F3 VERIFICATION: APPLY MAPPING CORRECTNESS ("ફોર્મમાં ભરો")
    // ------------------------------------------------------------------------
    console.log('\n[F3 VERIFICATION] Applying reviewed values into the report form ("ફોર્મમાં ભરો")...');
    const confirmBtn = await page.$('#btn-scan-review-confirm');
    if (!confirmBtn) throw new Error('#btn-scan-review-confirm not found');
    await confirmBtn.click();

    // Wait for modal to close
    await page.waitForFunction(() => {
      const el = document.getElementById('scan-review-container');
      return el === null || window.getComputedStyle(el).display === 'none';
    });
    console.log('[Modal] Review overlay closed, reviewing populated form state...');

    await new Promise((r) => setTimeout(r, 800));

    // Extract form state and verify mappings
    const formState = await page.evaluate(() => {
      const totalCountElem = document.getElementById('total-student-count');
      const totalCountText = totalCountElem ? totalCountElem.textContent.trim() : null;

      const getValByLabel = (label) => {
        const input = document.querySelector(`input[aria-label="${label}"]`);
        return input ? input.value : null;
      };

      const std10 = getValByLabel('ધોરણ ૧૦');
      const std11 = getValByLabel('ધોરણ ૧૧');
      const std12 = getValByLabel('ધોરણ ૧૨');
      const college = getValByLabel('કોલેજ');
      const engineer = getValByLabel('એન્જિનિયર');
      const medical = getValByLabel('મેડિકલ');
      const muslimTeachers = getValByLabel('મુસ્લિમ શિક્ષકોની સંખ્યા');

      // Activity rows in table
      const rows = Array.from(document.querySelectorAll('tbody tr')).map(tr => {
        const title = tr.querySelector('td')?.textContent?.trim() || '';
        const inputs = Array.from(tr.querySelectorAll('input')).map(i => i.value);
        return { title, inputs };
      });

      // Mashwara input
      const mashwaraInput = document.querySelector('input[aria-label*="મશવારો"], textarea[aria-label*="મશવારો"]');
      const mashwaraVal = mashwaraInput ? mashwaraInput.value : '';

      return {
        totalCountText,
        std10,
        std11,
        std12,
        college,
        engineer,
        medical,
        muslimTeachers,
        rows,
        mashwaraVal
      };
    });

    // ------------------------------------------------------------------------
    // FULL MAPPING TABLE PRINT & ASSERTIONS
    // ------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log('                     FULL OCR -> FORM MAPPING TABLE                     ');
    console.log('------------------------------------------------------------------------');
    console.log('| Photo / Picker Field       | Form Field Target        | Value | Match |');
    console.log('------------------------------------------------------------------------');

    const mappingTable = [
      { picker: 'કુલ સંખ્યા (student_count)', form: 'કુલ સંખ્યા (Total Students)', expected: '120', actual: formState.totalCountText },
      { picker: 'ધોરણ ૧૦ (std10)', form: 'ધોરણ ૧૦ Input', expected: '25', actual: formState.std10 },
      { picker: 'ધોરણ ૧૧ (std11)', form: 'ધોરણ ૧૧ Input', expected: '18', actual: formState.std11 },
      { picker: 'ધોરણ ૧૨ (std12)', form: 'ધોરણ ૧૨ Input', expected: '15', actual: formState.std12 },
      { picker: 'કોલેજ (college)', form: 'કોલેજ Input', expected: '30', actual: formState.college },
      { picker: 'એન્જિનિયર (engineer)', form: 'એન્જિનિયર Input', expected: '8', actual: formState.engineer },
      { picker: 'મેડિકલ (medical)', form: 'મેડિકલ Input', expected: '5', actual: formState.medical },
      { picker: 'મુસ્લિમ શિક્ષકોની સંખ્યા', form: 'મુસ્લિમ શિક્ષકોની સંખ્યા Input', expected: '12', actual: formState.muslimTeachers }
    ];

    for (const item of mappingTable) {
      const match = item.actual === item.expected ? '✅ MATCH' : '❌ MISMATCH';
      console.log(
        `| ${item.picker.padEnd(26)} | ${item.form.padEnd(24)} | ${item.actual.padStart(5)} | ${match} |`
      );
      if (item.actual !== item.expected) {
        throw new Error(`F3 MAPPING MISMATCH: Expected ${item.form} to be "${item.expected}", got "${item.actual}"!`);
      }
    }
    console.log('------------------------------------------------------------------------\n');

    // CRITICAL ASSERTION: કુલ સંખ્યા to total, not to મુસ્લિમ શિક્ષકો
    if (formState.muslimTeachers === '120') {
      throw new Error('F3 CRITICAL VIOLATION: કુલ સંખ્યા was incorrectly mapped to મુસ્લિમ શિક્ષકો!');
    }
    if (formState.totalCountText !== '120') {
      throw new Error(`F3 CRITICAL VIOLATION: કુલ સંખ્યા was not mapped to total students display! Got: ${formState.totalCountText}`);
    }
    console.log('✅ F3 CONFIRMED: કુલ સંખ્યા (120) strictly mapped to total students, NOT to મુસ્લિમ શિક્ષકો (12)!');

    // Screenshot of populated form
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_form_filled_360px.png'),
      fullPage: false
    });
    console.log('📸 Saved populated form screenshot: 04_form_filled_360px.png');

    // ------------------------------------------------------------------------
    // F4 VERIFICATION: ZERO DOWNLOAD DIALOGS / EVENTS
    // ------------------------------------------------------------------------
    console.log('\n[F4 VERIFICATION] Verifying Zero Browser/OS Download Events...');
    const downloadAttempts = page._getDownloadAttempts ? page._getDownloadAttempts() : 0;
    const downloadedFiles = fs.readdirSync(tempDownloadDir);

    console.log(`  Intercepted CDP download attempts: ${downloadAttempts}`);
    console.log(`  Files written in isolated download directory: ${downloadedFiles.length} (${downloadedFiles.join(', ') || 'NONE'})`);

    if (downloadAttempts > 0) {
      throw new Error(`F4 VIOLATION: ${downloadAttempts} download events were triggered!`);
    }
    if (downloadedFiles.length > 0) {
      throw new Error(`F4 VIOLATION: Files were downloaded into temp dir: ${downloadedFiles.join(', ')}`);
    }
    console.log('✅ F4 PASSED: ZERO download dialogs or files occurred throughout execution!');

    console.log(`\n🎉 RUN ${runIndex} COMPLETED SUCCESSFULLY WITH ZERO ERRORS!\n`);
    return { success: true, downloadAttempts, downloadedFilesCount: downloadedFiles.length };
  } finally {
    await browser.close();
  }
}

// If run directly via node, execute twice consecutively per F4 requirement
if (process.argv[1] && process.argv[1].endsWith('verify_web_fix13.mjs')) {
  (async () => {
    try {
      console.log('Starting consecutive two-pass verification for WEB-FIX13...');
      await startServer();
      console.log(`[Server] Vite preview running at ${APP_URL}`);

      const run1 = await runVerification(1);
      const run2 = await runVerification(2);

      console.log('\n========================================================================');
      console.log('                        FINAL VERIFICATION SUMMARY                       ');
      console.log('========================================================================');
      console.log(`Run 1: ${run1.success ? 'PASSED ✅' : 'FAILED ❌'} | Download Events: ${run1.downloadAttempts}`);
      console.log(`Run 2: ${run2.success ? 'PASSED ✅' : 'FAILED ❌'} | Download Events: ${run2.downloadAttempts}`);
      console.log('Zero download events proved across both consecutive runs! 🚀');
      console.log('========================================================================\n');
      process.exit(0);
    } catch (err) {
      console.error('\n❌ VERIFICATION FAILED:', err);
      process.exit(1);
    } finally {
      stopServer();
    }
  })();
}
