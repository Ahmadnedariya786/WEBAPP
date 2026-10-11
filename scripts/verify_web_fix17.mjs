import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { launchHeadlessBrowser, configureDownloadSafety } from './verify_helpers.mjs';

const fixtureCleanPath = path.resolve('tests/fixtures/clean_form.png');
const fixtureHandwrittenPath = path.resolve('tests/fixtures/handwritten_sample.png');

if (!fs.existsSync(fixtureCleanPath)) {
  throw new Error('tests/fixtures/clean_form.png missing from repo!');
}
if (!fs.existsSync(fixtureHandwrittenPath)) {
  throw new Error('tests/fixtures/handwritten_sample.png missing from repo!');
}

let serverProcess = null;
const PORT = 5217;
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
  console.log(`=== WEB-FIX17 SCAN HONESTY AND FEEDBACK VERIFICATION ===`);
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

    await page.setViewport({ width: 1280, height: 900 });

    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('mt_onboarded', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      sessionStorage.setItem('mt_greeted', '1');
    });

    // ------------------------------------------------------------------------
    // RUN 1: CLEAN FIXTURE GATED VERIFICATION (F5 ZERO DIFF)
    // ------------------------------------------------------------------------
    console.log('\n--- RUN 1: FIXTURE clean_form.png GATED ASSERTIONS ---');
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    // Upload clean_form.png
    const galleryInputClean = await page.$('#gallery-scan-input');
    if (!galleryInputClean) {
      throw new Error('#gallery-scan-input not found for clean_form upload');
    }
    await galleryInputClean.uploadFile(fixtureCleanPath);
    console.log('[Upload] Uploaded fixture clean_form.png, awaiting OCR processing...');

    // Wait for review modal
    await page.waitForFunction(
      () => {
        const el = document.getElementById('scan-review-container');
        return el !== null && window.getComputedStyle(el).display !== 'none';
      },
      { timeout: 60000 }
    );
    console.log('[Modal] Review overlay modal opened successfully for clean fixture!');
    await new Promise((r) => setTimeout(r, 600));

    // Read extracted data from review modal
    const cleanData = await page.evaluate(() => {
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
        const rows = activitiesSection.querySelectorAll('[data-activity-row]');
        rows.forEach((row) => {
          const r = row.getAttribute('data-activity-row');
          const gInp = row.querySelector('[data-col-key="gujishata"] input');
          const aInp = row.querySelector('[data-col-key="agraaham"] input');
          const mInp = row.querySelector('[data-col-key="mojuda"] input');
          activities[r] = {
            guj: gInp ? gInp.value.trim() : '',
            azaim: aInp ? aInp.value.trim() : '',
            moj: mInp ? mInp.value.trim() : ''
          };
        });
      }

      return { stats, activities };
    });

    // Evaluate clean form stats
    let cleanExactStats = 0;
    for (const [k, expV] of Object.entries(EXPECTED_STATS)) {
      if (cleanData.stats[k] === expV) cleanExactStats++;
    }
    const cleanStatsPercent = Math.round((cleanExactStats / 8) * 100);

    console.log('------------------------------------------------------------------------');
    console.log('RUN 1 (clean_form.png) STATS EXTRACTION RESULTS');
    console.log('------------------------------------------------------------------------');
    for (const [k, expV] of Object.entries(EXPECTED_STATS)) {
      const got = cleanData.stats[k];
      const match = got === expV;
      console.log(`| Stat: ${k.padEnd(20)} | Expected: ${expV.padEnd(6)} | Got: ${got.padEnd(6)} | ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
    }
    console.log(`STATS ACCURACY: ${cleanExactStats} / 8 (${cleanStatsPercent}%, Gate requirement: >= 75%)`);

    // Gated assertions from AGENTS.md
    if (cleanData.stats.college === '172') {
      throw new Error('FATAL: college received 172 from Activity row 8! Value leaked into stats!');
    }
    console.log('✅ CRITICAL CHECK PASSED: Zero value leakage from activities table into stats! (college !== 172)');

    if (cleanStatsPercent < 75) {
      throw new Error(`FATAL: Stats extraction accuracy ${cleanStatsPercent}% is below required 75% gate!`);
    }
    console.log(`✅ CRITICAL CHECK PASSED: Stats extraction accuracy ${cleanStatsPercent}% meets >= 75% gate!`);

    for (const [k, expV] of Object.entries(EXPECTED_STATS)) {
      if (cleanData.stats[k] !== expV) {
        throw new Error(`FATAL: Stat ${k} expected ${expV} but got ${cleanData.stats[k]}`);
      }
    }
    console.log('✅ F5 PASSED: Clean fixture matches all 8 stats (340/62/58/64/96/28/12/9)!');

    // Close review modal
    const cancelBtn = await page.$('#btn-scan-review-cancel');
    if (cancelBtn) {
      await cancelBtn.click();
      await new Promise((r) => setTimeout(r, 600));
    }

    // ------------------------------------------------------------------------
    // RUN 2: HANDWRITTEN SAMPLE PHOTO RUN (F1, F2, F3, F4)
    // ------------------------------------------------------------------------
    console.log('\n--- RUN 2: HANDWRITTEN SAMPLE PHOTO RUN ---');
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    const importBtnSelector = '#btn-gallery-scan';
    await page.waitForSelector(importBtnSelector, { visible: true });

    // Track button text changes during OCR
    const observedStages = [];
    let isTracking = true;
    const trackingPromise = (async () => {
      while (isTracking) {
        try {
          const btnText = await page.$eval(importBtnSelector, (el) => {
            const progressSpan = el.querySelector('#scan-progress-text');
            return (progressSpan ? progressSpan.textContent : el.textContent)?.trim() || '';
          });
          if (btnText && !observedStages.includes(btnText)) {
            observedStages.push(btnText);
            console.log(`[Staged Progress Observed] "${btnText}"`);
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
    })();

    // Upload handwritten photo
    const galleryInputHandwritten = await page.$('#gallery-scan-input');
    if (!galleryInputHandwritten) {
      throw new Error('#gallery-scan-input not found for handwritten sample upload');
    }
    await galleryInputHandwritten.uploadFile(fixtureHandwrittenPath);
    console.log('[Upload] Uploaded handwritten_sample.png, monitoring staged progress...');

    // Wait for review modal
    await page.waitForFunction(
      () => {
        const el = document.getElementById('scan-review-container');
        return el !== null && window.getComputedStyle(el).display !== 'none';
      },
      { timeout: 60000 }
    );
    isTracking = false;
    await trackingPromise;

    console.log('[Modal] Review overlay modal opened for handwritten sample!');
    console.log(`[Staged Progress Summary] Observed stages: ${JSON.stringify(observedStages)}`);

    // Verify F3: Staged progress text advanced during scan
    const hasProgressStages = observedStages.some((s) =>
      s.includes('ટેબલ') || s.includes('હરોળ') || s.includes('ચકાસણ') || s.includes('ઇમેજ')
    );
    if (!hasProgressStages) {
      throw new Error(`FATAL: Staged progress text failed to advance during scan! Observed: ${JSON.stringify(observedStages)}`);
    }
    console.log('✅ F3 PASSED: Staged progress text visibly advanced during scan!');

    // Verify F1: Strict stat gating on handwritten photo
    const handwrittenStats = await page.evaluate(() => {
      const results = {};
      const statKeys = ['student_count', 'std10', 'std11', 'std12', 'college', 'engineer', 'medical', 'muslim_teachers'];
      for (const k of statKeys) {
        const inp = document.querySelector(`[data-stat-input="${k}"]`);
        const badge = document.querySelector(`[data-testid="badge-${k}"]`);
        results[k] = {
          val: inp ? inp.value.trim() : '',
          hasBadge: Boolean(badge),
          badgeText: badge ? badge.textContent.trim() : ''
        };
      }
      return results;
    });

    console.log('------------------------------------------------------------------------');
    console.log('RUN 2 (handwritten_sample.png) STATS GATING EVALUATION');
    console.log('------------------------------------------------------------------------');
    let unbadgedValuesFound = 0;
    for (const [k, res] of Object.entries(handwrittenStats)) {
      console.log(`| Stat: ${k.padEnd(20)} | Value: "${res.val.padEnd(8)}" | Badge: ${res.hasBadge ? `✅ "${res.badgeText}"` : 'NONE'} |`);
      // F1 rule: no stat input may show a value without the અસ્પષ્ટ badge unless confidence >= 70 & passed y-band.
      // If a value is shown, it must not be a wrong confident unbadged value.
      if (res.val && !res.hasBadge) {
        unbadgedValuesFound++;
        console.error(`❌ VIOLATION: Stat ${k} has value "${res.val}" without an અસ્પષ્ટ badge!`);
      }
    }

    if (unbadgedValuesFound > 0) {
      throw new Error(`FATAL: Found ${unbadgedValuesFound} unbadged stat value(s) in handwritten sample! F1 gating failed.`);
    }
    console.log('✅ F1 PASSED: Strict stat gating verified! No wrong confident/unbadged stat values appear.');

    // Verify F2: Low-Yield Notice Banner
    const bannerInfo = await page.evaluate(() => {
      const banner = document.getElementById('low-yield-notice-banner');
      if (!banner) return { visible: false, text: '' };
      return {
        visible: window.getComputedStyle(banner).display !== 'none',
        text: banner.textContent.trim()
      };
    });

    console.log('------------------------------------------------------------------------');
    console.log('RUN 2 (handwritten_sample.png) LOW-YIELD NOTICE BANNER EVALUATION');
    console.log('------------------------------------------------------------------------');
    console.log(`Banner Visible: ${bannerInfo.visible}`);
    console.log(`Banner Text:    "${bannerInfo.text}"`);

    if (!bannerInfo.visible) {
      throw new Error('FATAL: Low-yield notice banner #low-yield-notice-banner is NOT visible on handwritten sample!');
    }

    const expectedNoticeSubstring = 'આ ફોટો હાથપ્રત અથવા અસ્પષ્ટ લાગે છે — મોટા ભાગના ખાના ખાલી છે';
    if (!bannerInfo.text.includes(expectedNoticeSubstring)) {
      throw new Error(`FATAL: Low-yield notice text does not match expected message! Got: "${bannerInfo.text}"`);
    }
    console.log('✅ F2 PASSED: Low-yield notice banner is visible with expected Gujarati advisory text!');

    // Verify Banner Dismissibility
    const dismissBtn = await page.$('#btn-dismiss-low-yield-notice');
    if (!dismissBtn) {
      throw new Error('FATAL: Dismiss button #btn-dismiss-low-yield-notice not found on banner!');
    }
    await dismissBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    const isBannerDismissed = await page.evaluate(() => {
      const banner = document.getElementById('low-yield-notice-banner');
      return !banner || window.getComputedStyle(banner).display === 'none';
    });

    if (!isBannerDismissed) {
      throw new Error('FATAL: Banner was not dismissed after clicking dismiss button!');
    }
    console.log('✅ F2 PASSED: Banner successfully dismissed upon clicking close button!');

    console.log('\n========================================================================');
    console.log('       🎉 ALL WEB-FIX17 VERIFICATION ASSERTIONS PASSED! 🎉');
    console.log('========================================================================\n');

  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    await startServer();
    await runVerification();
    stopServer();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    stopServer();
    process.exit(1);
  }
}

main();
