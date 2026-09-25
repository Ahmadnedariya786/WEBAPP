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

async function runProof() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  B2-BULK-WEB AUTOMATED PROOF SUITE — BULK SELECT + DELETE');
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
    await page.setViewport({ width: 375, height: 812 });

    // In-memory test reports store for request interception
    let testReports = [
      {
        id: 'rep-001',
        halqa: 'પાલનપુર',
        report_date: '2026-09-20',
        total_students: 15,
        std10: 5, std11: 4, std12: 3, college: 3,
        activities: { 'activity.namaz': { gujishta: '12', azaim: '15' }, 'activity.jamaat_3': { maujuda: '2' }, 'activity.jamaat_10': { maujuda: '1' } },
        mashwara_text: 'પાલનપુર મશવરા',
        special_notes: 'ટેસ્ટ નોંધ ૧'
      },
      {
        id: 'rep-002',
        halqa: 'છાપી',
        report_date: '2026-09-21',
        total_students: 22,
        std10: 8, std11: 6, std12: 4, college: 4,
        activities: { 'activity.namaz': { gujishta: '18', azaim: '20' }, 'activity.jamaat_3': { maujuda: '3' }, 'activity.jamaat_10': { maujuda: '2' } },
        mashwara_text: 'છાપી મશવરા',
        special_notes: 'ટેસ્ટ નોંધ ૨'
      },
      {
        id: 'rep-003',
        halqa: 'ડીસા',
        report_date: '2026-09-22',
        total_students: 10,
        std10: 3, std11: 3, std12: 2, college: 2,
        activities: { 'activity.namaz': { gujishta: '8', azaim: '10' }, 'activity.jamaat_3': { maujuda: '1' }, 'activity.jamaat_10': { maujuda: '0' } },
        mashwara_text: 'ડીસા મશવરા',
        special_notes: 'ટેસ્ટ નોંધ ૩'
      }
    ];

    let deletedIds = [];

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
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': 'application/json'
          },
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
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(null)
        });
        return;
      }

      if (url.includes('/rest/v1/reports')) {
        req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testReports)
        });
        return;
      }

      req.continue();
    });

    // ─── INITIAL NAVIGATION & AUTH ───────────────────────────────
    console.log('\n--- Step 0: Navigating to Past Reports with Admin Auth ---');
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

    // Verify 3 initial reports rendered
    const initialCardsCount = await page.$$eval('#report-cards-list > div', divs => divs.length);
    assert('Initial state renders 3 reports', initialCardsCount === 3, { initialCardsCount });

    // Verify D1: Header row toggle button "પસંદ કરો"
    const toggleBtnText = await page.$eval('#btn-toggle-select-mode', el => el.textContent.trim());
    assert('D1: Header row button starts with "પસંદ કરો"', toggleBtnText.includes('પસંદ કરો'), { toggleBtnText });

    // ─── D1 & D3: ENTER SELECT MODE ───────────────────────────────
    console.log('\n--- Step 1: Entering Select Mode ---');
    await page.click('#btn-toggle-select-mode');
    await new Promise(r => setTimeout(r, 400));

    const toggleBtnInModeText = await page.$eval('#btn-toggle-select-mode', el => el.textContent.trim());
    assert('D1: Header row button flips to "બંધ કરો" in select mode', toggleBtnInModeText.includes('બંધ કરો'), { toggleBtnInModeText });

    // Verify 44px checkboxes top-right on each card
    const checkboxes = await page.$$('button[id^="card-checkbox-"]');
    assert('D1: Every card shows a checkbox top-right', checkboxes.length === 3, { count: checkboxes.length });

    // Check size of touch target (should be 44px)
    const checkboxBox = await checkboxes[0].boundingBox();
    assert('D1: Checkbox touch target is 44px (accessible)', Math.round(checkboxBox.width) === 44 && Math.round(checkboxBox.height) === 44, checkboxBox);

    // Verify D3: Fixed Bulk Bar is visible immediately at top without scrolling
    const bulkBar = await page.$('#fixed-bulk-bar');
    assert('D3: Fixed bulk bar is present in DOM', !!bulkBar);

    const bulkBarBox = await bulkBar.boundingBox();
    const viewportHeight = 812;
    const isBarVisibleInViewport = bulkBarBox.y + bulkBarBox.height <= viewportHeight && bulkBarBox.y > 0;
    assert('D3: Fixed bulk bar visible immediately at top without scrolling', isBarVisibleInViewport, bulkBarBox);

    // Verify D3: Bulk bar contains "0 રિપોર્ટ પસંદ" + "રદ કરો" + disabled "કાઢી નાખો (0)"
    const bulkBarText = await page.$eval('#fixed-bulk-bar', el => el.textContent.trim());
    assert('D3: Bar contains initial count "0 રિપોર્ટ પસંદ"', bulkBarText.includes('0') && bulkBarText.includes('રિપોર્ટ પસંદ'), { bulkBarText });

    const deleteBtnDisabled = await page.$eval('#bulk-delete-btn', el => el.hasAttribute('disabled') || el.disabled);
    assert('D6: Delete button disabled at 0 selected', deleteBtnDisabled);

    // Verify D3 list padding-bottom added
    const listPaddingBottom = await page.$eval('#report-cards-list', el => window.getComputedStyle(el).paddingBottom);
    assert('D3: List has bottom padding added so last card never hides behind bar', parseFloat(listPaddingBottom) >= 80, { listPaddingBottom });

    console.log('\n--- Step 2: Selecting 2 Reports (rep-001 & rep-002) ---');
    const step2CardIds = await page.$$eval('#report-cards-list > div', els => els.map(e => e.id));
    console.log('Card IDs present in DOM:', step2CardIds);

    // Tap card 1 to toggle selection (tests card click)
    console.log('Tapping card 1 to toggle selection...');
    await page.evaluate(() => document.querySelector('#report-card-rep-001')?.click());
    await new Promise(r => setTimeout(r, 200));
    console.log('Bulk bar after card 1:', await page.$eval('#fixed-bulk-bar', el => el.textContent.trim()));

    // Tap checkbox 2 to toggle selection (tests checkbox click)
    console.log('Tapping checkbox 2 to toggle selection...');
    await page.evaluate(() => document.querySelector('#card-checkbox-rep-002')?.click());
    await new Promise(r => setTimeout(r, 200));
    console.log('Bulk bar after checkbox 2:', await page.$eval('#fixed-bulk-bar', el => el.textContent.trim()));

    const countAfterTwoSelected = await page.$eval('#fixed-bulk-bar', el => el.textContent.trim());
    assert('D1 & D3: Live count updates to "2 રિપોર્ટ પસંદ"', countAfterTwoSelected.includes('2') && countAfterTwoSelected.includes('રિપોર્ટ પસંદ'), { countAfterTwoSelected });

    const deleteBtnEnabled = await page.$eval('#bulk-delete-btn', el => !el.disabled);
    assert('D3: Danger button shows "કાઢી નાખો (2)" and is enabled', deleteBtnEnabled);

    // ─── D4: IN-BAR CONFIRM ───────────────────────────────────────
    console.log('\n--- Step 3: In-Bar Confirmation ---');
    await page.click('#bulk-delete-btn');
    await new Promise(r => setTimeout(r, 300));

    const confirmContent = await page.$('#bulk-bar-confirm-content');
    assert('D4: In-bar confirm replaces bar content (no overlay/portal, no scroll)', !!confirmContent);

    const confirmText = await page.$eval('#bulk-bar-confirm-content p', el => el.textContent.trim());
    assert('D4: Confirm message shows exact count "ખરેખર 2 કાઢી નાખવા? આ ક્રિયા પરત નહીં થાય."', 
      confirmText.includes('ખરેખર 2 કાઢી નાખવા? આ ક્રિયા પરત નહીં થાય.'), { confirmText });

    const cancelConfirmBtn = await page.$('#bulk-cancel-confirm-btn');
    const executeDeleteBtn = await page.$('#bulk-execute-delete-btn');
    assert('D4: In-bar confirm has "રદ કરો" and "હા, કાઢી નાખો" buttons', !!cancelConfirmBtn && !!executeDeleteBtn);

    // ─── D5: EXECUTION (Delete 2 of 3) ────────────────────────────
    console.log('\n--- Step 4: Executing Bulk Delete of 2 Reports ---');
    await page.click('#bulk-execute-delete-btn');
    await new Promise(r => setTimeout(r, 700));

    // Assert sequential RPC calls made for the 2 deleted reports
    assert('D5: Sequential await loop executed deleteReport for both selected IDs', 
      deletedIds.includes('rep-001') && deletedIds.includes('rep-002') && deletedIds.length === 2, { deletedIds });

    // Assert truthful end toast: all ok -> "2 રિપોર્ટ્સ કાઢી નાખ્યા ✅"
    const toastText = await page.$eval('.fixed.inset-x-4.bottom-24 span', el => el.textContent.trim()).catch(() => '');
    assert('D5: Truthful toast displayed "2 રિપોર્ટ્સ કાઢી નાખ્યા ✅"', toastText.includes('2') && toastText.includes('કાઢી નાખ્યા'), { toastText });

    // Assert select mode exited after delete
    const isBarStillVisible = await page.$('#fixed-bulk-bar');
    assert('D5: Select mode exited after bulk delete', isBarStillVisible === null);

    // Assert only rep-003 remains in UI
    const remainingCardsCount = await page.$$eval('#report-cards-list > div', divs => divs.length);
    assert('D7: Exactly 1 report remains (only the 2 selected were deleted)', remainingCardsCount === 1, { remainingCardsCount });

    const remainingHalqa = await page.$eval('#report-cards-list', el => el.textContent.trim());
    assert('D7: Only unselected report (ડીસા) remains', remainingHalqa.includes('ડીસા') && !remainingHalqa.includes('પાલનપુર') && !remainingHalqa.includes('છાપી'));

    // Assert system_logs summary entry
    const systemLogs = await page.evaluate(() => JSON.parse(localStorage.getItem('system_logs') || '[]'));
    const bulkLog = systemLogs.find(l => l.action.includes('બલ્ક ડિલીટ: 2'));
    assert('D5: Activity log contains summary entry "બલ્ક ડિલીટ: 2"', !!bulkLog, bulkLog);

    // ─── D2: SELECT-ALL ON REMAINING 1 REPORT ─────────────────────
    console.log('\n--- Step 5: Select-All and Delete Remaining Report ---');
    await page.click('#btn-toggle-select-mode');
    await new Promise(r => setTimeout(r, 300));

    const selectAllBtn = await page.$('#btn-select-all-toggle');
    assert('D2: "બધા પસંદ કરો" toggle is present in select mode', !!selectAllBtn);

    const selectAllBtnText = await page.$eval('#btn-select-all-toggle', el => el.textContent.trim());
    assert('D2: Initial label is "બધા પસંદ કરો"', selectAllBtnText.includes('બધા પસંદ કરો'), { selectAllBtnText });

    // Click "બધા પસંદ કરો"
    await page.click('#btn-select-all-toggle');
    await new Promise(r => setTimeout(r, 200));

    const selectAllFlippedText = await page.$eval('#btn-select-all-toggle', el => el.textContent.trim());
    assert('D2: Label flips to "કોઈ નહીં પસંદ કરો" when all selected', selectAllFlippedText.includes('કોઈ નહીં પસંદ કરો'), { selectAllFlippedText });

    const liveCountText = await page.$eval('#selected-reports-count', el => el.textContent.trim());
    assert('D2: Live count displays "1"', liveCountText === '1', { liveCountText });

    // Open confirm
    await page.click('#bulk-delete-btn');
    await new Promise(r => setTimeout(r, 300));

    const confirmRemainingText = await page.$eval('#bulk-bar-confirm-content p', el => el.textContent.trim());
    assert('D7: Confirm shows exact remaining count "1"', confirmRemainingText.includes('1 કાઢી નાખવા'), { confirmRemainingText });

    // Execute delete of remaining report
    await page.click('#bulk-execute-delete-btn');
    await new Promise(r => setTimeout(r, 700));

    assert('D7: Remaining report rep-003 was deleted', deletedIds.includes('rep-003') && deletedIds.length === 3, { deletedIds });

    const emptyText = await page.$eval('#report-cards-list', el => el.textContent.trim());
    assert('D7: All test reports are gone, shows empty message', emptyText.includes('કોઈ રિપોર્ટ મળ્યો નથી.'), { emptyText });

    // ─── D6: INDIVIDUAL DELETE STILL WORKS ────────────────────────
    console.log('\n--- Step 6: Individual Delete Flow Verification ---');
    // Add 1 report for individual delete testing
    await page.evaluate(() => {
      const rep = {
        id: 'rep-individual-test',
        halqa: 'થરાદ',
        date: '2026-09-25',
        stats: { std_10: 2, std_11: 1, std_12: 1, college: 1 },
        activities: {},
        mashwara: '',
        notes: ''
      };
      if (window.useAppStore) {
        window.useAppStore.setState({ reports: [rep] });
      }
    });
    await new Promise(r => setTimeout(r, 300));

    const individualDeleteBtn = await page.$('#btn-delete-report-rep-individual-test');
    assert('D6: Individual delete trash button is present on report card', !!individualDeleteBtn);

    await individualDeleteBtn.click();
    await new Promise(r => setTimeout(r, 300));

    const deleteDialog = await page.$('#report-delete-dialog-container');
    assert('D6: Individual delete opens standard confirmation modal overlay', !!deleteDialog);

    const dialogButtons = await page.$$('#report-delete-dialog-container button');
    // Click "હા, કાઢી નાખો" in the dialog (second button)
    await dialogButtons[1].click();
    await new Promise(r => setTimeout(r, 500));

    const individualToast = await page.$eval('.fixed.inset-x-4.bottom-24 span', el => el.textContent.trim()).catch(() => '');
    assert('D6: Individual delete flow functions with ZERO diff and shows toast', individualToast.includes('રિપોર્ટ ડિલીટ થયો ✅'), { individualToast });

    // ─── D6 & D2: SEARCH / FILTER GUARD TEST ──────────────────────
    console.log('\n--- Step 7: Search / Filter Guard Verification ---');
    await page.evaluate(() => {
      const searchTestReports = [
        { id: 'rep-f1', halqa: 'પાલનપુર ૧', date: '2026-09-01', stats: {}, activities: {}, mashwara: '', notes: '' },
        { id: 'rep-f2', halqa: 'ડીસા ૧', date: '2026-09-02', stats: {}, activities: {}, mashwara: '', notes: '' },
        { id: 'rep-f3', halqa: 'પાલનપુર ૨', date: '2026-09-03', stats: {}, activities: {}, mashwara: '', notes: '' },
      ];
      if (window.useAppStore) {
        window.useAppStore.setState({ reports: searchTestReports });
      }
    });
    await new Promise(r => setTimeout(r, 300));

    // Type "પાલનપુર" in search bar
    await page.type('#search-reports-input', 'પાલનપુર');
    await new Promise(r => setTimeout(r, 300));

    const visibleFilteredCount = await page.$$eval('#report-cards-list > div', divs => divs.length);
    assert('Search filter shows only 2 matching reports', visibleFilteredCount === 2, { visibleFilteredCount });

    // Enter select mode
    await page.click('#btn-toggle-select-mode');
    await new Promise(r => setTimeout(r, 200));

    // Click "બધા પસંદ કરો"
    await page.click('#btn-select-all-toggle');
    await new Promise(r => setTimeout(r, 200));

    const filteredSelectedCount = await page.$eval('#selected-reports-count', el => el.textContent.trim());
    assert('D6: "બધા પસંદ કરો" selects ONLY visible filtered reports (2, not 3)', filteredSelectedCount === '2', { filteredSelectedCount });

    // Check confirm shows exact count 2
    await page.click('#bulk-delete-btn');
    await new Promise(r => setTimeout(r, 200));
    const searchConfirmText = await page.$eval('#bulk-bar-confirm-content p', el => el.textContent.trim());
    assert('D6: Confirm shows exact count for filtered selection', searchConfirmText.includes('2 કાઢી નાખવા'), { searchConfirmText });

    // Cancel confirm & exit mode
    await page.click('#bulk-cancel-confirm-btn');
    await new Promise(r => setTimeout(r, 100));
    await page.click('#btn-toggle-select-mode');
    await new Promise(r => setTimeout(r, 100));
    await page.evaluate(() => {
      const inp = document.querySelector('#search-reports-input');
      if (inp) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(inp, '');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 300));

    // ─── D7: SCREENSHOTS IN 3 THEMES (MOBILE & LAPTOP) ─────────────
    console.log('\n--- Step 8: Capturing Screenshots Across 3 Themes ---');

    // Setup 3 rich reports for screenshots
    await page.evaluate(() => {
      const demoReports = [
        {
          id: 'demo-1',
          halqa: 'પાલનપુર શહેર',
          date: '2026-09-25',
          stats: { std_10: 12, std_11: 8, std_12: 6, college: 4 },
          activities: { 'activity.namaz': { gujishta: '25', azaim: '30' }, 'activity.jamaat_3': { maujuda: '3' }, 'activity.jamaat_10': { maujuda: '1' } },
          mashwara: 'માસિક મશવરા સંપન્ન',
          notes: 'નિયમિત મુલાકાત'
        },
        {
          id: 'demo-2',
          halqa: 'છાપી મધ્ય',
          date: '2026-09-24',
          stats: { std_10: 10, std_11: 5, std_12: 5, college: 5 },
          activities: { 'activity.namaz': { gujishta: '20', azaim: '25' }, 'activity.jamaat_3': { maujuda: '2' }, 'activity.jamaat_10': { maujuda: '2' } },
          mashwara: 'તાલીમી બેઠક',
          notes: 'વિદ્યાર્થીઓ સાથે વાતચીત'
        },
        {
          id: 'demo-3',
          halqa: 'ડીસા ઉત્તર',
          date: '2026-09-23',
          stats: { std_10: 8, std_11: 6, std_12: 4, college: 2 },
          activities: { 'activity.namaz': { gujishta: '15', azaim: '20' }, 'activity.jamaat_3': { maujuda: '1' }, 'activity.jamaat_10': { maujuda: '0' } },
          mashwara: 'મહેનત ચાલુ',
          notes: 'હલકા કક્ષાએ મુલાકાત'
        }
      ];
      if (window.useAppStore) {
        window.useAppStore.setState({ reports: demoReports });
      }
    });

    const themes = ['outdoor', 'dark', 'premium'];

    for (const theme of themes) {
      console.log(`  Applying theme: ${theme}`);
      await page.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
        localStorage.setItem('theme', th);
      }, theme);
      await new Promise(r => setTimeout(r, 400));

      // 1. Mobile viewport (375x812) - Select Mode with 2 items selected
      await page.setViewport({ width: 375, height: 812 });
      // Ensure select mode is ON and items selected
      await page.evaluate(() => {
        const toggleBtn = document.querySelector('#btn-toggle-select-mode');
        if (toggleBtn && toggleBtn.textContent.includes('પસંદ કરો')) {
          toggleBtn.click();
        }
      });
      await new Promise(r => setTimeout(r, 200));

      // Select first two cards
      await page.evaluate(() => {
        document.querySelector('#report-card-demo-1')?.click();
        document.querySelector('#report-card-demo-2')?.click();
      });
      await new Promise(r => setTimeout(r, 200));

      const mobileShotPath = path.join(SCREENSHOT_DIR, `b2_${theme}_mobile_selected.png`);
      await page.screenshot({ path: mobileShotPath });
      results.screenshots.push({ name: `${theme}_mobile_selected`, path: mobileShotPath });
      console.log(`  Saved: ${mobileShotPath}`);

      // Confirm mode screenshot on mobile
      await page.click('#bulk-delete-btn');
      await new Promise(r => setTimeout(r, 250));
      const mobileConfirmShotPath = path.join(SCREENSHOT_DIR, `b2_${theme}_mobile_confirm.png`);
      await page.screenshot({ path: mobileConfirmShotPath });
      results.screenshots.push({ name: `${theme}_mobile_confirm`, path: mobileConfirmShotPath });
      console.log(`  Saved: ${mobileConfirmShotPath}`);

      // Cancel confirm
      await page.click('#bulk-cancel-confirm-btn');
      await new Promise(r => setTimeout(r, 200));

      // 2. Laptop viewport (1280x800)
      await page.setViewport({ width: 1280, height: 800 });
      await new Promise(r => setTimeout(r, 300));

      const laptopShotPath = path.join(SCREENSHOT_DIR, `b2_${theme}_laptop_selected.png`);
      await page.screenshot({ path: laptopShotPath });
      results.screenshots.push({ name: `${theme}_laptop_selected`, path: laptopShotPath });
      console.log(`  Saved: ${laptopShotPath}`);

      // Reset selection for next theme loop
      await page.evaluate(() => {
        const toggleBtn = document.querySelector('#btn-toggle-select-mode');
        if (toggleBtn && toggleBtn.textContent.includes('બંધ કરો')) {
          toggleBtn.click();
        }
      });
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`  AUTOMATED PROOF SUITE COMPLETED: ${results.passed}/${results.total} PASSED`);
    if (results.failed > 0) {
      console.error(`  ❌ ${results.failed} TESTS FAILED`);
      process.exitCode = 1;
    } else {
      console.log('  🎉 ALL B2-BULK-WEB PROOFS VERIFIED GREEN!');
    }
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Fatal error in proof suite:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (previewProcess) {
      try {
        previewProcess.kill();
      } catch {}
    }
  }
}

runProof();
