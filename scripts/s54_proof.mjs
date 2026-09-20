import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROOF_DIR = path.join(__dirname, '../s54_proof');

if (!fs.existsSync(PROOF_DIR)) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
}

const BASE_URL = 'http://127.0.0.1:4173';

function parseRgb(colorStr) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function getLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);
  return (max + 0.05) / (min + 0.05);
}

async function isServerListening() {
  try {
    const res = await fetch(BASE_URL);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function runProof() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  S54 AUTOMATED PROOF SUITE — LIVE TODAY-DOT & REPORT-BAR');
  console.log('════════════════════════════════════════════════════════════════\n');

  let previewProcess = null;
  const serverUp = await isServerListening();
  if (!serverUp) {
    console.log('Starting preview server on port 4173...');
    const isWindows = process.platform === 'win32';
    const spawnOptions = isWindows ? { shell: true } : { detached: true };
    previewProcess = spawn('npm', ['run', 'preview', '--', '--port', '4173'], spawnOptions);
    await new Promise(r => setTimeout(r, 3500));
  } else {
    console.log('Preview server already listening on 4173.');
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: [],
    screenshots: []
  };

  function assert(name, condition, details = {}) {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`  ✅ PASS: ${name}`);
      results.tests.push({ name, pass: true, details });
    } else {
      results.failed++;
      console.error(`  ❌ FAIL: ${name}`, details);
      results.tests.push({ name, pass: false, details });
    }
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Choose a seeded report date in the same month that is different from today
    const reportDay = now.getDate() === 5 ? 6 : 5;
    const seededReportDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(reportDay).padStart(2, '0')}`;

    console.log(`Current Test Date (Today): ${todayIso}`);
    console.log(`Seeded Test-Report Date: ${seededReportDate}\n`);

    // Enable request interception for Supabase reports query with CORS headers
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.method() === 'OPTIONS') {
        req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          }
        });
        return;
      }
      if (req.url().includes('/rest/v1/reports')) {
        req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            id: 'test-seed-rep-1',
            halqa: 'પાલનપુર',
            report_date: seededReportDate,
            total_students: 20,
            std10: 0,
            std11: 0,
            std12: 0,
            college: 0,
            engineer: 0,
            medical: 0,
            muslim_teachers: 0,
            activities: [],
            mashwara_text: 'કસોટી મશવરા',
            special_notes: 'S54 seeded test report'
          }])
        });
      } else {
        req.continue();
      }
    });

    // Setup initial state: complete onboarding, session, and seed a test report
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: '9999', role: 'admin' }));
      localStorage.setItem('theme', 'outdoor');
      document.documentElement.setAttribute('data-theme', 'outdoor');
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    // Helper: seeds report into Zustand store and opens the calendar dialog
    async function openCalendarWithSeed() {
      await page.evaluate(({ repDate }) => {
        if (window.useAppStore) {
          window.useAppStore.setState({
            reports: [{
              id: 'test-seed-rep-1',
              halqa: 'પાલનપુર',
              date: repDate,
              stats: { total: 20 },
              activities: [],
              mashwara: 'કસોટી મશવરા',
              notes: 'S54 seeded test report'
            }],
            isLoading: false
          });
        }
      }, { repDate: seededReportDate });

      await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
      await page.waitForSelector('#calendar-dialog-container', { visible: true });
      await new Promise(r => setTimeout(r, 450));
    }

    // ─────────────────────────────────────────────────────────────
    // 1. ALL-THEME VISIBILITY & MARKER SEMANTICS (3 Themes × 360px & 1280px)
    // ─────────────────────────────────────────────────────────────
    console.log('------------------------------------------------------------');
    console.log('  1. D1 & D2: MARKER SEMANTICS & CONTRAST (3 THEMES)');
    console.log('------------------------------------------------------------');

    const themes = ['outdoor', 'dark', 'premium'];

    for (const theme of themes) {
      await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
      await page.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
        localStorage.setItem('theme', th);
      }, theme);
      await new Promise(r => setTimeout(r, 200));

      // Open Calendar Dialog with seeded report guaranteed in Zustand
      await openCalendarWithSeed();
      await new Promise(r => setTimeout(r, 450)); // allow framer motion to settle

      const markerMetrics = await page.evaluate(({ curToday, repDate }) => {
        const todayCell = document.querySelector(`button[data-date="${curToday}"]`);
        const todayDot = todayCell?.querySelector('[data-testid="today-dot"]');
        const reportCell = document.querySelector(`button[data-date="${repDate}"]`);
        const reportBar = reportCell?.querySelector('[data-testid="report-bar"]');

        const card = document.querySelector('.neu-cal-dialog');
        const cardBg = card ? window.getComputedStyle(card).backgroundColor : 'rgb(255,255,255)';

        let dotMetrics = null;
        if (todayDot && todayCell) {
          const dotStyle = window.getComputedStyle(todayDot);
          const cellStyle = window.getComputedStyle(todayCell);
          const dotRect = todayDot.getBoundingClientRect();
          dotMetrics = {
            width: dotRect.width,
            height: dotRect.height,
            bgColor: dotStyle.backgroundColor,
            boxShadow: dotStyle.boxShadow,
            cellBg: cellStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ? cardBg : cellStyle.backgroundColor
          };
        }

        let barMetrics = null;
        if (reportBar && reportCell) {
          const barStyle = window.getComputedStyle(reportBar);
          const barRect = reportBar.getBoundingClientRect();
          barMetrics = {
            width: barRect.width,
            height: barRect.height,
            bgColor: barStyle.backgroundColor
          };
        }

        return {
          todayFound: !!todayCell,
          todayDotFound: !!todayDot,
          reportFound: !!reportCell,
          reportBarFound: !!reportBar,
          dotMetrics,
          barMetrics
        };
      }, { curToday: todayIso, repDate: seededReportDate });

      assert(`D1: Today dot present on today date (${todayIso}) [${theme}]`, markerMetrics.todayDotFound);
      assert(`D1: Report bar present on seeded report date (${seededReportDate}) [${theme}]`, markerMetrics.reportBarFound);

      if (markerMetrics.dotMetrics) {
        assert(`D1: Today dot min-size >= 6px (actual: ${markerMetrics.dotMetrics.width}x${markerMetrics.dotMetrics.height}) [${theme}]`,
          markerMetrics.dotMetrics.width >= 5.9 && markerMetrics.dotMetrics.height >= 5.9);

        // Contrast Assertion
        const dotRgb = parseRgb(markerMetrics.dotMetrics.bgColor);
        const bgRgb = parseRgb(markerMetrics.dotMetrics.cellBg);
        const contrast = getContrastRatio(dotRgb, bgRgb);
        console.log(`    📊 [${theme}] Today-Dot Contrast: ${contrast.toFixed(2)} : 1 (dot: ${markerMetrics.dotMetrics.bgColor} on surface: ${markerMetrics.dotMetrics.cellBg})`);
        assert(`D2: Today-dot contrast >= 3:1 against surface (actual: ${contrast.toFixed(2)}:1) [${theme}]`, contrast >= 3.0);

        // Ring / Glow assertion
        const shadow = markerMetrics.dotMetrics.boxShadow;
        const hasRingOrGlow = shadow && shadow !== 'none';
        assert(`D2: Today-dot has ring/glow for high visibility (${shadow}) [${theme}]`, hasRingOrGlow);
      }

      if (markerMetrics.barMetrics) {
        assert(`D1: Report bar geometry is 4px x 2px (actual: ${markerMetrics.barMetrics.width}x${markerMetrics.barMetrics.height}) [${theme}]`,
          Math.abs(markerMetrics.barMetrics.width - 4) <= 1 && Math.abs(markerMetrics.barMetrics.height - 2) <= 1);
      }

      const shotPath = path.join(PROOF_DIR, `s54_${theme}_360px_markers.png`);
      await page.screenshot({ path: shotPath });
      results.screenshots.push(shotPath);

      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForSelector('#calendar-dialog-container', { hidden: true });
      await new Promise(r => setTimeout(r, 150));
    }

    // ─────────────────────────────────────────────────────────────
    // Desktop Viewport (1280px) Check in Outdoor Theme
    // ─────────────────────────────────────────────────────────────
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'outdoor');
      localStorage.setItem('theme', 'outdoor');
    });
    await new Promise(r => setTimeout(r, 150));

    await openCalendarWithSeed();

    const desktopMarkerMetrics = await page.evaluate(({ curToday, repDate }) => {
      const todayDot = document.querySelector(`button[data-date="${curToday}"] [data-testid="today-dot"]`);
      const reportBar = document.querySelector(`button[data-date="${repDate}"] [data-testid="report-bar"]`);
      return {
        todayDotFound: !!todayDot,
        reportBarFound: !!reportBar
      };
    }, { curToday: todayIso, repDate: seededReportDate });

    assert('D1: Desktop 1280px renders both today-dot and report-bar simultaneously',
      desktopMarkerMetrics.todayDotFound && desktopMarkerMetrics.reportBarFound);

    const shotDesktop = path.join(PROOF_DIR, 's54_outdoor_1280px_markers.png');
    await page.screenshot({ path: shotDesktop });
    results.screenshots.push(shotDesktop);

    await page.keyboard.press('Escape');
    await page.waitForSelector('#calendar-dialog-container', { hidden: true });
    await new Promise(r => setTimeout(r, 150));

    // ─────────────────────────────────────────────────────────────
    // 2. D3: STALENESS KILLER (Date Override +1 Day Rollover Test)
    // ─────────────────────────────────────────────────────────────
    console.log('\n------------------------------------------------------------');
    console.log('  2. D3: STALENESS KILLER (+1 DAY OVERRIDE & REOPEN)');
    console.log('------------------------------------------------------------');

    // Compute tomorrow's ISO string
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    console.log(`Simulating date advance: ${todayIso} -> ${tomorrowIso}`);

    // Override window.Date inside the page to return tomorrow
    await page.evaluate(() => {
      const RealDate = window.Date;
      const targetTime = RealDate.now() + 24 * 60 * 60 * 1000;
      class MockDate extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            super(targetTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return targetTime;
        }
      }
      window.Date = MockDate;
    });

    // Reopen calendar dialog
    await openCalendarWithSeed();
    await new Promise(r => setTimeout(r, 450));

    const rolloverMetrics = await page.evaluate(({ oldToday, newToday, repDate }) => {
      const oldCellDot = document.querySelector(`button[data-date="${oldToday}"] [data-testid="today-dot"]`);
      const newCellDot = document.querySelector(`button[data-date="${newToday}"] [data-testid="today-dot"]`);
      const reportBar = document.querySelector(`button[data-date="${repDate}"] [data-testid="report-bar"]`);
      return {
        oldCellHasDot: !!oldCellDot,
        newCellHasDot: !!newCellDot,
        reportBarStillPresent: !!reportBar
      };
    }, { oldToday: todayIso, newToday: tomorrowIso, repDate: seededReportDate });

    assert(`D3: Today dot moved automatically to tomorrow (${tomorrowIso})`, rolloverMetrics.newCellHasDot);
    assert(`D3: Previous today date (${todayIso}) no longer has today dot`, !rolloverMetrics.oldCellHasDot);
    assert(`D3: Report bar on (${seededReportDate}) is unchanged and still visible`, rolloverMetrics.reportBarStillPresent);

    const shotRollover = path.join(PROOF_DIR, 's54_staleness_killer_rollover.png');
    await page.screenshot({ path: shotRollover });
    results.screenshots.push(shotRollover);

    // ─────────────────────────────────────────────────────────────
    // 3. D1: TODAY == SELECTED (On-Accent Inside Dot)
    // ─────────────────────────────────────────────────────────────
    console.log('\n------------------------------------------------------------');
    console.log('  3. D1: TODAY == SELECTED INTERACTION');
    console.log('------------------------------------------------------------');

    // Click tomorrow date (which is now today) to select it
    await page.evaluate((newToday) => {
      const btn = document.querySelector(`button[data-date="${newToday}"]`);
      if (btn) btn.click();
    }, tomorrowIso);

    await page.waitForSelector('#calendar-dialog-container', { hidden: true });
    await new Promise(r => setTimeout(r, 200));

    // Reopen calendar with tomorrow (today) selected
    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 450));

    const selectedTodayMetrics = await page.evaluate((newToday) => {
      const selectedDisc = document.querySelector(`button[data-date="${newToday}"].neu-cal-disc-selected`);
      const dot = selectedDisc?.querySelector('[data-testid="today-dot"]');
      if (!selectedDisc || !dot) return null;
      const dotStyle = window.getComputedStyle(dot);
      const discStyle = window.getComputedStyle(selectedDisc);
      return {
        isSelected: !!selectedDisc,
        dotFound: !!dot,
        dotColor: dotStyle.backgroundColor,
        discBg: discStyle.backgroundColor
      };
    }, tomorrowIso);

    assert('D1: Selected today disc has neu-cal-disc-selected class', !!selectedTodayMetrics?.isSelected);
    assert('D1: Today dot renders inside selected disc with on-accent color (#FFFFFF)',
      selectedTodayMetrics && selectedTodayMetrics.dotColor.includes('255, 255, 255'));

    const shotSelectedToday = path.join(PROOF_DIR, 's54_selected_today_dot.png');
    await page.screenshot({ path: shotSelectedToday });
    results.screenshots.push(shotSelectedToday);

    await page.keyboard.press('Escape');
    await page.waitForSelector('#calendar-dialog-container', { hidden: true });
    await new Promise(r => setTimeout(r, 150));

    // ─────────────────────────────────────────────────────────────
    // 4. D4: FUNCTIONAL REGRESSION CHECKS
    // ─────────────────────────────────────────────────────────────
    console.log('\n------------------------------------------------------------');
    console.log('  4. D4: FUNCTIONAL REGRESSION SUITE');
    console.log('------------------------------------------------------------');

    // 4A: "આજે" button
    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 200));

    const todayBtn = await page.$('#neu-cal-today-btn');
    if (todayBtn) {
      await todayBtn.click();
      await page.waitForSelector('#calendar-dialog-container', { hidden: true });
      await new Promise(r => setTimeout(r, 200));
    }
    const dialogClosedToday = await page.evaluate(() => !document.querySelector('#calendar-dialog-container'));
    assert('D4 Regression: "આજે" button selects date and closes dialog', dialogClosedToday);

    // 4B: "સાફ કરો" button
    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 200));

    const clearBtn = await page.$('#neu-cal-clear-btn');
    if (clearBtn) {
      await clearBtn.click();
      await page.waitForSelector('#calendar-dialog-container', { hidden: true });
      await new Promise(r => setTimeout(r, 200));
    }
    const dialogClosedClear = await page.evaluate(() => !document.querySelector('#calendar-dialog-container'));
    assert('D4 Regression: "સાફ કરો" button clears date and closes dialog', dialogClosedClear);

    // 4C: Month & Year Popover sheets
    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => document.querySelector('#neu-cal-month-select').click());
    await new Promise(r => setTimeout(r, 150));
    const monthListOpen = await page.evaluate(() => !!document.querySelector('[role="listbox"]'));
    assert('D4 Regression: Month themed popover listbox opens on click', monthListOpen);

    // Escape closes popover sheet without closing dialog
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 350));
    const popoverClosedDialogRemains = await page.evaluate(() => {
      return !document.querySelector('[role="listbox"]') && !!document.querySelector('#calendar-dialog-container');
    });
    assert('D4 Regression: Escape closes month popover while calendar dialog stays open', popoverClosedDialogRemains);

    // Escape again closes calendar dialog
    await page.keyboard.press('Escape');
    await page.waitForSelector('#calendar-dialog-container', { hidden: true });
    await new Promise(r => setTimeout(r, 150));

    const scrollUnlocked = await page.evaluate(() => document.body.style.overflow === '');
    assert('D4 Regression: Scroll-lock restored when calendar closes', scrollUnlocked);

  } finally {
    if (browser) await browser.close();
    if (previewProcess) {
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        try {
          const { execSync } = await import('child_process');
          execSync('taskkill /pid ' + previewProcess.pid + ' /T /F');
        } catch {}
      } else {
        try { process.kill(-previewProcess.pid); } catch {}
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  S54 PROOF SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED (TOTAL: ${results.total})`);
  console.log('════════════════════════════════════════════════════════════════\n');

  const outPath = path.join(PROOF_DIR, 's54_proof_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  if (results.failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL S54 PROOFS VERIFIED AND PASSED 100% GREEN! ✨');
    process.exit(0);
  }
}

runProof().catch(err => {
  console.error('\n❌ Unhandled error during S54 proof execution:', err);
  process.exit(1);
});
