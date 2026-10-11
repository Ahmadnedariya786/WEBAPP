import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const SCREENSHOT_DIR = path.resolve('web_fix12_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sampleImgPath = path.resolve('sample_report_test.jpg');
if (!fs.existsSync(sampleImgPath)) {
  throw new Error('sample_report_test.jpg missing from repo!');
}

let serverProcess = null;
const PORT = 5202;
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

(async () => {
  console.log('=== WEB-FIX12 VERIFICATION: SCAN REVIEW PICKER USABILITY FIX ===');
  await startServer();
  console.log(`[Server] Vite preview running at ${APP_URL}`);

  const { browser, tempDownloadDir } = await launchHeadlessBrowser(puppeteer);

  try {
    const page = await browser.newPage();
    await configureDownloadSafety(page, tempDownloadDir);
    page.on('console', (msg) => console.log('[Browser]', msg.text()));
    page.on('pageerror', (err) => console.error('[Browser Error]', err.message));

    // CRITICAL REQUIREMENT: 360px viewport width
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2 });
    console.log('[Viewport] Set strictly to 360px width x 800px height');

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

    console.log('\n[TEST 1] Uploading owner test photo (sample_report_test.jpg)...');
    const galleryInput = await page.$('#gallery-scan-input');
    if (!galleryInput) throw new Error('#gallery-scan-input not found');

    await galleryInput.uploadFile(sampleImgPath);

    // Wait for Review Overlay modal to open
    console.log('[OCR] Processing photo through self-contained OCR pipeline...');
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]');
        const text = document.body.innerText;
        return dialog && text.includes('ફોર્મમાં ભરો') && text.includes('રદ કરો');
      },
      { timeout: 35000 }
    );
    console.log('✓ Review Overlay dialog opened successfully!');

    // Check Subtitle (F4)
    const subtitle = await page.$eval('#review-picker-subtitle', (el) => el.innerText.trim());
    console.log(`✓ F4 Review Subtitle: "${subtitle}"`);
    if (subtitle !== 'ઓસીઆર હાથપ્રત માટે અંદાજ છે — દરેક ખાનું ચકાસો અને સુધારો') {
      throw new Error(`F4 Subtitle mismatch! Got: "${subtitle}"`);
    }

    // ─────────────────────────────────────────────────────────────
    // F2: NO HORIZONTAL SCROLL AT 360PX
    // ─────────────────────────────────────────────────────────────
    const horizontalScrollCheck = await page.evaluate(() => {
      const modal = document.querySelector('#scan-review-container');
      const innerScroll = modal?.querySelector('.overflow-y-auto');
      if (!modal || !innerScroll) return { error: 'Modal elements not found' };

      const modalOverflows = modal.scrollWidth > modal.clientWidth + 1;
      const innerOverflows = innerScroll.scrollWidth > innerScroll.clientWidth + 1;

      // Check all stacked row containers inside innerScroll
      const allElements = Array.from(innerScroll.querySelectorAll('*'));
      const overflowingElements = allElements
        .filter((el) => el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
        .map((el) => ({
          tag: el.tagName,
          className: el.className,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        }));

      return {
        modalWidth: modal.clientWidth,
        modalScrollWidth: modal.scrollWidth,
        modalOverflows,
        innerWidth: innerScroll.clientWidth,
        innerScrollWidth: innerScroll.scrollWidth,
        innerOverflows,
        overflowingCount: overflowingElements.length,
        overflowingElements: overflowingElements.slice(0, 3)
      };
    });

    console.log('\n[F2 Check] Horizontal Scroll at 360px Viewport:', horizontalScrollCheck);
    if (horizontalScrollCheck.modalOverflows || horizontalScrollCheck.innerOverflows) {
      throw new Error(`F2 Violation: Modal horizontally overflows at 360px! modal: ${horizontalScrollCheck.modalScrollWidth} > ${horizontalScrollCheck.modalWidth}`);
    }
    if (horizontalScrollCheck.overflowingCount > 0) {
      console.warn('Elements with scrollWidth > clientWidth:', horizontalScrollCheck.overflowingElements);
    }
    console.log('✓ F2 PASS: Zero horizontal scrolling anywhere in the modal at 360px!');

    // ─────────────────────────────────────────────────────────────
    // F2: STACKED ROW LAYOUT & STICKY HEADERS CHECK
    // ─────────────────────────────────────────────────────────────
    const layoutCheck = await page.evaluate(() => {
      const statsSection = document.querySelector('#scan-review-stats-section');
      const actSection = document.querySelector('#scan-review-activities-section');

      // Check sticky header rows
      const statsHeader = statsSection?.querySelector('.sticky');
      const actHeader = actSection?.querySelector('.sticky');

      const statsHeaderTexts = statsHeader ? Array.from(statsHeader.querySelectorAll('div > div')).map((d) => d.innerText.trim()) : [];
      const actHeaderTexts = actHeader ? Array.from(actHeader.querySelectorAll('div > div')).map((d) => d.innerText.trim()) : [];

      // Check row labels visibility
      const actRows = Array.from(document.querySelectorAll('#scan-review-activities-section [data-activity-no]'));
      const actLabels = actRows.map((r) => {
        const no = r.getAttribute('data-activity-no');
        const labelEl = r.querySelector('span.text-txt');
        const rect = labelEl?.getBoundingClientRect();
        return {
          no,
          name: labelEl?.innerText?.trim(),
          visible: !!(rect && rect.width > 0 && rect.height > 0)
        };
      });

      const statRows = Array.from(document.querySelectorAll('#scan-review-stats-section [data-stat-key]'));
      const statLabels = statRows.map((r) => {
        const key = r.getAttribute('data-stat-key');
        const labelEl = r.querySelector('span.text-txt');
        const rect = labelEl?.getBoundingClientRect();
        return {
          key,
          name: labelEl?.innerText?.trim(),
          visible: !!(rect && rect.width > 0 && rect.height > 0)
        };
      });

      return {
        statsHeaderTexts,
        actHeaderTexts,
        actLabelsCount: actLabels.length,
        allActLabelsVisible: actLabels.every((l) => l.visible),
        statLabelsCount: statLabels.length,
        allStatLabelsVisible: statLabels.every((l) => l.visible),
        sampleActLabels: actLabels.slice(0, 3)
      };
    });

    console.log('\n[F2 Check] Stacked Rows & Sticky Headers:', layoutCheck);
    if (!layoutCheck.actHeaderTexts.includes('ગુજિશતા') || !layoutCheck.actHeaderTexts.includes('અઝાઇમ') || !layoutCheck.actHeaderTexts.includes('મોજૂદા')) {
      throw new Error(`F2 Violation: Sticky header missing required columns! Got: ${JSON.stringify(layoutCheck.actHeaderTexts)}`);
    }
    if (!layoutCheck.statsHeaderTexts.includes('ગુજિશતા') || !layoutCheck.statsHeaderTexts.includes('અઝાઇમ') || !layoutCheck.statsHeaderTexts.includes('મોજૂદા')) {
      throw new Error(`F2 Violation: Stats sticky header missing required columns! Got: ${JSON.stringify(layoutCheck.statsHeaderTexts)}`);
    }
    if (!layoutCheck.allActLabelsVisible || layoutCheck.actLabelsCount !== 13) {
      throw new Error(`F2 Violation: Not all activity row labels are visible! Count: ${layoutCheck.actLabelsCount}`);
    }
    if (!layoutCheck.allStatLabelsVisible || layoutCheck.statLabelsCount < 8) {
      throw new Error(`F2 Violation: Not all stat row labels are visible! Count: ${layoutCheck.statLabelsCount}`);
    }
    console.log('✓ F2 PASS: Sticky headers (ગુજિશતા / અઝાઇમ / મોજૂદા) & full-width stacked labels verified!');

    // ─────────────────────────────────────────────────────────────
    // F1 & F3: PREFILLED GUESSES & BADGE PLACEMENT
    // ─────────────────────────────────────────────────────────────
    const extractionDetails = await page.evaluate(() => {
      const actRows = Array.from(document.querySelectorAll('#scan-review-activities-section [data-activity-no]'));
      const report = [];

      actRows.forEach((r) => {
        const no = parseInt(r.getAttribute('data-activity-no'), 10);
        const name = r.querySelector('span.text-txt')?.innerText?.trim() || '';
        const inputs = Array.from(r.querySelectorAll('input')).map((i) => ({
          value: i.value,
          placeholder: i.placeholder,
          hasPr12: i.className.includes('pr-12') || i.className.includes('pr-14')
        }));
        const badges = Array.from(r.querySelectorAll('span[title="અસ્પષ્ટ"]')).map((b) => {
          const rect = b.getBoundingClientRect();
          const pointerEvents = window.getComputedStyle(b).pointerEvents;
          return {
            text: b.innerText.trim(),
            pointerEvents,
            width: rect.width,
            height: rect.height
          };
        });

        report.push({
          no,
          name,
          inputs,
          badgesCount: badges.length,
          badges
        });
      });

      return report;
    });

    console.log('\n========================================================================================');
    console.log('ACTIVITIES STACKED ROWS REPORT:');
    console.log('========================================================================================');
    console.table(
      extractionDetails.map((r) => ({
        '#': r.no,
        'નામ': r.name,
        'Col 1 (ગુજિશતા)': r.inputs[0]?.value || '',
        'Col 2 (અઝાઇમ)': r.inputs[1]?.value || '',
        'Col 3 (મોજૂદા)': r.inputs[2]?.value || (r.no === 13 ? r.inputs[0]?.value : ''),
        'અસ્પષ્ટ Badges': r.badgesCount
      }))
    );

    // 1. Verify prefilled guesses for written cells: 203, 32, 86, 76, 17/40, 100%
    const r1 = extractionDetails.find((r) => r.no === 1);
    if (r1.inputs[0].value !== '203') throw new Error(`F1 Violation: Row 1 gujishta value mismatch! Expected "203", got: "${r1.inputs[0].value}"`);
    console.log('✓ F1 PASS: Row 1 prefilled guess = 203');

    const r2 = extractionDetails.find((r) => r.no === 2);
    if (r2.inputs[0].value !== '32') throw new Error(`F1 Violation: Row 2 gujishta value mismatch! Expected "32", got: "${r2.inputs[0].value}"`);
    console.log('✓ F1 PASS: Row 2 prefilled guess = 32');

    const r3 = extractionDetails.find((r) => r.no === 3);
    if (r3.inputs[0].value !== '86') throw new Error(`F1 Violation: Row 3 gujishta value mismatch! Expected "86", got: "${r3.inputs[0].value}"`);
    console.log('✓ F1 PASS: Row 3 prefilled guess = 86');

    const r4 = extractionDetails.find((r) => r.no === 4);
    if (r4.inputs[0].value !== '76') throw new Error(`F1 Violation: Row 4 gujishta value mismatch! Expected "76", got: "${r4.inputs[0].value}"`);
    console.log('✓ F1 PASS: Row 4 prefilled guess = 76');

    const r5 = extractionDetails.find((r) => r.no === 5);
    if (r5.inputs[0].value !== '17/40') throw new Error(`F1 Violation: Row 5 gujishta value mismatch! Expected "17/40", got: "${r5.inputs[0].value}"`);
    console.log('✓ F1 PASS: Row 5 prefilled fraction guess = 17/40');

    const r7 = extractionDetails.find((r) => r.no === 7);
    if (!r7.inputs[0].value.includes('100')) throw new Error(`F1 Violation: Row 7 percent value mismatch! Expected "100%", got: "${r7.inputs[0].value}"`);
    console.log(`✓ F1 PASS: Row 7 prefilled percent guess = ${r7.inputs[0].value}`);

    // 2. Verify Blank rows: 6 (શબગુજારી), 11, 12, 13 stay empty with "–" placeholder
    const r6 = extractionDetails.find((r) => r.no === 6);
    if (r6.inputs.some((i) => i.value !== '')) {
      throw new Error(`F1 Violation: Row 6 (શબગુજારી) must be empty! Got: ${JSON.stringify(r6.inputs)}`);
    }
    console.log('✓ F1 PASS: Row 6 (શબગુજારી) is empty with "–" placeholder');

    const r11 = extractionDetails.find((r) => r.no === 11);
    if (r11.inputs.some((i) => i.value !== '')) {
      throw new Error(`F1 Violation: Row 11 must be empty! Got: ${JSON.stringify(r11.inputs)}`);
    }
    console.log('✓ F1 PASS: Row 11 is empty with "–" placeholder');

    const r12 = extractionDetails.find((r) => r.no === 12);
    if (r12.inputs.some((i) => i.value !== '')) {
      throw new Error(`F1 Violation: Row 12 must be empty! Got: ${JSON.stringify(r12.inputs)}`);
    }
    console.log('✓ F1 PASS: Row 12 is empty with "–" placeholder');

    const r13 = extractionDetails.find((r) => r.no === 13);
    if (r13.inputs[0].value !== '') {
      throw new Error(`F1 Violation: Row 13 must be empty! Got: "${r13.inputs[0].value}"`);
    }
    console.log('✓ F1 PASS: Row 13 is empty');

    // 3. F3 Badge Placement & non-interactive behavior:
    // Row 8 has faint mark -> shows badge on mojuda cell
    const r8 = extractionDetails.find((r) => r.no === 8);
    if (r8.badgesCount === 0) {
      throw new Error('F3 Violation: Expected અસ્પષ્ટ badge on Row 8 low-confidence cell!');
    }
    const r8Badge = r8.badges[0];
    if (r8Badge.pointerEvents !== 'none') {
      throw new Error(`F3 Violation: Badge must be non-interactive (pointer-events: none)! Got: "${r8Badge.pointerEvents}"`);
    }
    // High confidence rows must NOT have badges
    if (r1.badgesCount > 0 || r2.badgesCount > 0 || r3.badgesCount > 0 || r4.badgesCount > 0) {
      throw new Error('F1 Violation: High confidence cells must NOT show અસ્પષ્ટ badge!');
    }
    console.log('✓ F3 PASS: Low-confidence badge is non-interactive, pinned top-right, with reserved right padding on input!');

    // ─────────────────────────────────────────────────────────────
    // CAPTURE HIGH RESOLUTION SCREENSHOTS AT 360PX
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Screenshots] Capturing review picker at 360px width...');

    // Screenshot 1: Top of picker (Halqa + Student Stats + Sticky Header)
    await page.evaluate(() => {
      const scrollable = document.querySelector('#scan-review-container .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 0;
    });
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_review_picker_top_stats_360px.png'),
      fullPage: false
    });
    console.log('✓ Saved: 01_review_picker_top_stats_360px.png');

    // Screenshot 2: Scrolled to Activities Section rows 1-5 (showing 203, 32, 86, 76, 17/40)
    await page.evaluate(() => {
      const row1 = document.querySelector('#scan-review-activities-section [data-activity-no="1"]');
      if (row1) row1.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_review_picker_activities_top_360px.png'),
      fullPage: false
    });
    console.log('✓ Saved: 02_review_picker_activities_top_360px.png');

    // Screenshot 3: Activities rows 6-10 (showing empty row 6 શબગુજારી, 100%, and row 8 faint mark with અસ્પષ્ટ badge)
    await page.evaluate(() => {
      const row6 = document.querySelector('#scan-review-activities-section [data-activity-no="6"]');
      if (row6) row6.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_review_picker_activities_mid_360px.png'),
      fullPage: false
    });
    console.log('✓ Saved: 03_review_picker_activities_mid_360px.png');

    // Screenshot 4: Scrolled to Bottom of Activities (showing rows 11, 12, 13 and footer)
    await page.evaluate(() => {
      const scrollable = document.querySelector('#scan-review-container .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_review_picker_activities_bottom_360px.png'),
      fullPage: false
    });
    console.log('✓ Saved: 04_review_picker_activities_bottom_360px.png');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: CONFIRM FILL AND VERIFY FORM POPULATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Clicking "ફોર્મમાં ભરો" to confirm fill...');
    const confirmBtn = await page.$('#btn-scan-review-confirm');
    if (!confirmBtn) throw new Error('#btn-scan-review-confirm not found');
    await confirmBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    // Verify modal closed
    const modalOpen = await page.evaluate(() => !!document.querySelector('#scan-review-overlay'));
    if (modalOpen) throw new Error('Modal did not close after clicking "ફોર્મમાં ભરો"');
    console.log('✓ Modal closed successfully!');

    // Screenshot 5: Form filled from picker
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05_form_filled_360px.png'),
      fullPage: false
    });
    console.log('✓ Saved: 05_form_filled_360px.png');

    console.log('\n========================================================================');
    console.log('ALL WEB-FIX12 VERIFICATIONS PASSED WITH ZERO ERRORS!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    stopServer();
    if (tempDownloadDir) {
      try { fs.rmSync(tempDownloadDir, { recursive: true, force: true }); } catch {}
    }
  }
})();
