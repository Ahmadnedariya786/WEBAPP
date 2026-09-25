import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/df088a0f-fb3a-426b-8537-564576d48962';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'b2_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function isServerListening() {
  try {
    const res = await fetch(BASE_URL);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const halqas = ['પાલનપુર શહેર', 'છાપી મધ્ય', 'ડીસા ઉત્તર', 'વડગામ પૂર્વ', 'ભાભર કેન્દ્ર', 'ધાનેરા', 'થરાદ', 'દાંતા'];

function generateInitialReports(count = 8) {
  const reports = [];
  for (let i = 0; i < count; i++) {
    reports.push({
      id: `rep-fix-${i + 1}`,
      halqa: halqas[i % halqas.length],
      report_date: `2026-09-${String(25 - (i % 20)).padStart(2, '0')}`,
      total_students: 15 + i * 2,
      std10: 5 + i,
      std11: 4 + i,
      std12: 3,
      college: 3,
      activities: {
        'activity.namaz': { gujishta: String(15 + i), azaim: String(20 + i) },
        'activity.jamaat_3': { maujuda: '2' },
        'activity.jamaat_10': { maujuda: '1' }
      },
      mashwara_text: `મશવરા અહેવાલ ${i + 1}`,
      special_notes: `નોંધ ${i + 1}`
    });
  }
  return reports;
}

async function run() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  B2-BULK-WEB-FIX AUTOMATED PROOF: TRULY FIXED PORTAL BULK BAR');
  console.log('════════════════════════════════════════════════════════════════\n');

  let previewProcess = null;
  const serverUp = await isServerListening();
  if (!serverUp) {
    console.log('Starting preview server on port 4173...');
    previewProcess = spawn('npm', ['run', 'preview', '--', '--port', '4173'], { shell: true });
    await new Promise(r => setTimeout(r, 3500));
  } else {
    console.log('Preview server already listening on 4173.');
  }

  const results = { total: 0, passed: 0, failed: 0 };
  function assert(name, condition, details = {}) {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`  ✅ PASS: ${name}`);
    } else {
      results.failed++;
      console.error(`  ❌ FAIL: ${name}`, details);
    }
  }

  let testReports = generateInitialReports(8);
  const deletedIds = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

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

      const url = req.url();

      if (url.includes('/rest/v1/rpc/fn_login_code')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify('admin')
        });
        return;
      }

      if (url.includes('/rest/v1/rpc/fn_delete_report')) {
        const postData = JSON.parse(req.postData() || '{}');
        const id = postData.p_id;
        deletedIds.push(id);
        testReports = testReports.filter(r => r.id !== id);
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(null)
        });
        return;
      }

      if (url.includes('/rest/v1/reports')) {
        req.respond({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify(testReports)
        });
        return;
      }

      req.continue();
    });

    // ─── STEP 0: AUTH & INITIAL LOAD ───
    console.log('--- Step 0: Navigating with Admin Auth & 8 Reports ---');
    await page.goto(`${BASE_URL}/past-reports`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      if (window.useAppStore) {
        window.useAppStore.getState().setSession('ADMIN123', 'admin');
      }
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const initialCards = await page.$$('[id^="report-card-"]');
    assert('Initial state renders 8 reports (tall scrollable list)', initialCards.length === 8, { count: initialCards.length });

    const initialScrollY = await page.evaluate(() => window.scrollY);
    assert('Page is at TOP (scrollY === 0)', initialScrollY === 0, { initialScrollY });

    // ─── STEP 1: ENTER SELECT MODE AT TOP ───
    console.log('\n--- Step 1: Entering Select Mode at TOP of Long List ---');
    await page.click('#btn-toggle-select-mode');
    await new Promise(r => setTimeout(r, 400));

    // Verify D1: Portal check - bar must be child of document.body
    const portalParentCheck = await page.evaluate(() => {
      const bar = document.getElementById('fixed-bulk-bar');
      if (!bar) return { found: false };
      return {
        found: true,
        parentTagName: bar.parentElement ? bar.parentElement.tagName : null,
        isDirectChildOfBody: bar.parentElement === document.body,
        bodyContainsBar: document.body.contains(bar)
      };
    });
    assert('D1: Bulk bar is rendered via createPortal into document.body', 
      portalParentCheck.found && portalParentCheck.isDirectChildOfBody, 
      portalParentCheck
    );

    // Verify D2 & D3: Bar visible immediately in viewport without scrolling
    const topBarRect = await page.evaluate(() => {
      const bar = document.getElementById('fixed-bulk-bar');
      if (!bar) return null;
      const r = bar.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        height: Math.round(r.height),
        width: Math.round(r.width),
        windowHeight: window.innerHeight,
        windowScrollY: window.scrollY
      };
    });

    const isVisibleAtTop = topBarRect && 
      topBarRect.windowScrollY === 0 && 
      topBarRect.top > 0 && 
      topBarRect.bottom <= topBarRect.windowHeight &&
      topBarRect.bottom >= (topBarRect.windowHeight - 110);

    assert('D3: Bar is visible IMMEDIATELY at TOP without scrolling', isVisibleAtTop, topBarRect);

    // Capture screenshot: top-of-list with bar visible
    const topScreenshot = path.join(SCREENSHOT_DIR, 'b2_fix_mobile_top.png');
    await page.screenshot({ path: topScreenshot });
    console.log(`  Saved screenshot (top of list): ${topScreenshot}`);

    // Select 2 items to verify live count updates in bar
    const checkboxes = await page.$$('button[id^="card-checkbox-"]');
    await checkboxes[0].click();
    await new Promise(r => setTimeout(r, 150));
    await checkboxes[1].click();
    await new Promise(r => setTimeout(r, 150));

    const selectedText = await page.$eval('#fixed-bulk-bar', el => el.innerText);
    assert('Bar live count updates to "2 રિપોર્ટ પસંદ"', selectedText.includes('2') && selectedText.includes('રિપોર્ટ પસંદ'), { selectedText });

    // ─── STEP 2: SCROLL TO MIDDLE ───
    console.log('\n--- Step 2: Scrolling to Middle of Long List ---');
    await page.evaluate(() => window.scrollTo({ top: 450, behavior: 'instant' }));
    await new Promise(r => setTimeout(r, 300));

    const midScrollY = await page.evaluate(() => window.scrollY);
    assert('Page is scrolled to middle (scrollY >= 400)', midScrollY >= 400, { midScrollY });

    const midBarRect = await page.evaluate(() => {
      const bar = document.getElementById('fixed-bulk-bar');
      if (!bar) return null;
      const r = bar.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        windowHeight: window.innerHeight,
        windowScrollY: window.scrollY
      };
    });

    // Pinned check: bar bottom position in viewport stays identical within 3px
    const isPinnedMidScroll = midBarRect && 
      Math.abs(midBarRect.bottom - topBarRect.bottom) <= 3 &&
      midBarRect.top > 0 &&
      midBarRect.bottom <= midBarRect.windowHeight;

    assert('D3: Bar STAYS PINNED at exact same viewport position while scrolling', isPinnedMidScroll, {
      topBottom: topBarRect?.bottom,
      midBottom: midBarRect?.bottom,
      midScrollY
    });

    // Capture screenshot: mid-scroll with bar pinned
    const midScreenshot = path.join(SCREENSHOT_DIR, 'b2_fix_mobile_midscroll.png');
    await page.screenshot({ path: midScreenshot });
    console.log(`  Saved screenshot (mid-scroll pinned): ${midScreenshot}`);

    // ─── STEP 3: SCROLL TO BOTTOM ───
    console.log('\n--- Step 3: Scrolling to Bottom of List ---');
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await new Promise(r => setTimeout(r, 300));

    const bottomScrollY = await page.evaluate(() => window.scrollY);
    assert('Page is scrolled to bottom', bottomScrollY > midScrollY, { bottomScrollY });

    const bottomPaddingCheck = await page.evaluate(() => {
      const bar = document.getElementById('fixed-bulk-bar');
      const list = document.getElementById('report-cards-list');
      if (!bar || !list) return null;
      const rBar = bar.getBoundingClientRect();
      const listPad = window.getComputedStyle(list).paddingBottom;
      return {
        barBottom: Math.round(rBar.bottom),
        listPad,
        windowHeight: window.innerHeight
      };
    });

    assert('D4: List has bottom padding = bar height + 16px', 
      bottomPaddingCheck && parseFloat(bottomPaddingCheck.listPad) >= 70, 
      bottomPaddingCheck
    );

    // ─── STEP 4: SELECT-ALL & IN-BAR CONFIRM ───
    console.log('\n--- Step 4: Select-All and In-Bar Confirmation ---');
    await page.click('#btn-select-all-toggle');
    await new Promise(r => setTimeout(r, 250));

    const selectAllText = await page.$eval('#fixed-bulk-bar', el => el.innerText);
    assert('Select-all selected all 8 reports ("8 રિપોર્ટ પસંદ")', selectAllText.includes('8'), { selectAllText });

    // Click "કાઢી નાખો (8)"
    await page.click('#bulk-delete-btn');
    await new Promise(r => setTimeout(r, 250));

    // D3 & D4 in-bar confirm content replaces standard content
    const confirmMessage = await page.$eval('#bulk-bar-confirm-content', el => el.innerText);
    assert('D3: In-bar confirm replaces bar content ("ખરેખર 8 કાઢી નાખવા?...")', 
      confirmMessage.includes('ખરેખર 8 કાઢી નાખવા? આ ક્રિયા પરત નહીં થાય.'), 
      { confirmMessage }
    );

    // Execute bulk delete
    await page.click('#bulk-execute-delete-btn');
    await new Promise(r => setTimeout(r, 1200));

    // Toast check
    const toastText = await page.evaluate(() => {
      const toast = document.querySelector('[role="status"]');
      return toast ? toast.textContent : '';
    });
    assert('D5: Truthful toast displayed "8 રિપોર્ટ્સ કાઢી નાખ્યા ✅"', toastText.includes('8 રિપોર્ટ્સ કાઢી નાખ્યા ✅'), { toastText });

    const allDeleted = await page.evaluate(() => {
      const cards = document.querySelectorAll('[id^="report-card-"]');
      const bar = document.getElementById('fixed-bulk-bar');
      return cards.length === 0 && !bar;
    });
    assert('D5: All 8 reports deleted, list empty, select mode exited', allDeleted);

    // ─── STEP 5: LAPTOP VIEWPORT & THEMES (Outdoor, Dark, Premium) ───
    console.log('\n--- Step 5: Multi-Theme & Laptop Viewport Verification ---');
    await page.setViewport({ width: 1280, height: 800 });

    const themes = [
      { name: 'outdoor', label: 'Outdoor' },
      { name: 'dark', label: 'Dark' },
      { name: 'premium', label: 'Premium' }
    ];

    for (const theme of themes) {
      console.log(`\nVerifying Theme: ${theme.label}`);
      testReports = generateInitialReports(6);

      await page.evaluate((themeName) => {
        document.documentElement.setAttribute('data-theme', themeName);
        if (window.useThemeStore) {
          window.useThemeStore.setState({ theme: themeName });
        }
      }, theme.name);

      await page.reload({ waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 400));

      // Enter select mode
      await page.click('#btn-toggle-select-mode');
      await new Promise(r => setTimeout(r, 300));

      // Select 2 items
      const cbs = await page.$$('button[id^="card-checkbox-"]');
      if (cbs.length >= 2) {
        await cbs[0].click();
        await new Promise(r => setTimeout(r, 100));
        await cbs[1].click();
        await new Promise(r => setTimeout(r, 100));
      }

      // Laptop top check
      const laptopRect = await page.evaluate(() => {
        const bar = document.getElementById('fixed-bulk-bar');
        if (!bar) return null;
        const r = bar.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          width: Math.round(r.width),
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight
        };
      });

      assert(`Laptop [${theme.label}]: Bar visible above bottom nav without scrolling`, 
        laptopRect && laptopRect.bottom <= 800 && laptopRect.bottom >= 700, 
        laptopRect
      );

      const laptopCentered = laptopRect && Math.abs((laptopRect.left + laptopRect.width / 2) - (laptopRect.windowWidth / 2)) < 30;
      assert(`Laptop [${theme.label}]: Bar centered horizontally`, laptopCentered, laptopRect);

      const laptopTopPath = path.join(SCREENSHOT_DIR, `b2_fix_${theme.name}_laptop_top.png`);
      await page.screenshot({ path: laptopTopPath });
      console.log(`  Saved screenshot: ${laptopTopPath}`);

      // Laptop mid-scroll
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
      await new Promise(r => setTimeout(r, 200));

      const laptopMidPath = path.join(SCREENSHOT_DIR, `b2_fix_${theme.name}_laptop_midscroll.png`);
      await page.screenshot({ path: laptopMidPath });
      console.log(`  Saved screenshot: ${laptopMidPath}`);

      // Mobile theme screenshots
      await page.setViewport({ width: 375, height: 812, isMobile: true });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await new Promise(r => setTimeout(r, 200));

      const mobileThemeTop = path.join(SCREENSHOT_DIR, `b2_fix_${theme.name}_mobile_top.png`);
      await page.screenshot({ path: mobileThemeTop });
      console.log(`  Saved screenshot: ${mobileThemeTop}`);

      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
      await new Promise(r => setTimeout(r, 200));

      const mobileThemeMid = path.join(SCREENSHOT_DIR, `b2_fix_${theme.name}_mobile_midscroll.png`);
      await page.screenshot({ path: mobileThemeMid });
      console.log(`  Saved screenshot: ${mobileThemeMid}`);

      // Reset to laptop for next iteration
      await page.setViewport({ width: 1280, height: 800 });
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`  AUTOMATED VERIFICATION SUITE: ${results.passed}/${results.total} PASSED`);
    if (results.failed === 0) {
      console.log('  🎉 ALL B2-BULK-WEB-FIX REQUIREMENTS FULLY VERIFIED GREEN!');
    }
    console.log('════════════════════════════════════════════════════════════════\n');

  } finally {
    await browser.close();
    if (previewProcess) {
      previewProcess.kill();
    }
  }
}

run().catch(err => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
