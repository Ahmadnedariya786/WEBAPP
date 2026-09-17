import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's41_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runProof() {
  console.log('Launching browser for S41-MASTER Proof Suite...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: []
  };

  function addTest(name, passed, details = {}) {
    results.tests.push({ name, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`, details);
  }

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    // Setup initial state: complete onboarding and session
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: '9999', role: 'admin' }));
    });
    // Reload at root / which is NewReport
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const themes = ['outdoor', 'dark', 'premium'];
    const expectedHeaderBg = {
      outdoor: 'rgb(251, 247, 236)', // #FBF7EC
      dark: 'rgb(32, 36, 43)',        // #20242B
      premium: 'rgb(36, 22, 64)'      // #241640
    };

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Check Zero Duplicate IDs in DOM (Note N1)
    // ─────────────────────────────────────────────────────────────
    const duplicateIds = await page.evaluate(() => {
      const allElements = document.querySelectorAll('[id]');
      const ids = Array.from(allElements).map(el => el.id).filter(Boolean);
      const seen = new Set();
      const duplicates = new Set();
      for (const id of ids) {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
      }
      return Array.from(duplicates);
    });
    addTest('Note N1: Zero duplicate IDs in entire DOM', duplicateIds.length === 0, { duplicateIds });

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Check Zero `title` attributes in interactive elements (D10)
    // ─────────────────────────────────────────────────────────────
    const elementsWithTitle = await page.evaluate(() => {
      const els = document.querySelectorAll('[title]');
      return Array.from(els).map(el => el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''));
    });
    addTest('D10: Zero HTML title attributes (aria-label only)', elementsWithTitle.length === 0, { elementsWithTitle });

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Page Heading Transparency (D7)
    // ─────────────────────────────────────────────────────────────
    const headingBg = await page.evaluate(() => {
      const heading = document.querySelector('.page-heading-container');
      if (!heading) return null;
      return window.getComputedStyle(heading).backgroundColor;
    });
    addTest('D7: Page Heading container background is transparent', 
      headingBg === 'rgba(0, 0, 0, 0)' || headingBg === 'transparent', 
      { headingBg }
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 4: App Header Solid Colors across Themes (RC2 FIX / D2)
    // ─────────────────────────────────────────────────────────────
    for (const th of themes) {
      await page.evaluate((theme) => {
        if (window.__setTheme) {
          window.__setTheme(theme);
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('theme', theme);
        }
      }, th);
      await new Promise(r => setTimeout(r, 450)); // Allow 200ms CSS background transition to settle

      const headerColor = await page.evaluate(() => {
        const h = document.querySelector('.app-header');
        return h ? window.getComputedStyle(h).backgroundColor : null;
      });

      addTest(`RC2/D2: App Header opaque in ${th} theme`, 
        headerColor === expectedHeaderBg[th], 
        { theme: th, headerColor, expected: expectedHeaderBg[th] }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Mobile 360px Viewport Verification (RC1 / D1, D3, D6, D8)
    // ─────────────────────────────────────────────────────────────
    await page.setViewport({ width: 360, height: 800 });
    await page.evaluate(() => {
      if (window.__setTheme) {
        window.__setTheme('outdoor');
      } else {
        document.documentElement.setAttribute('data-theme', 'outdoor');
        localStorage.setItem('theme', 'outdoor');
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // D1: Check 13 stacked cards on mobile
    const mobileCardsInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('.activity-mobile-card');
      const container = document.querySelector('.space-y-3.lg\\:hidden');
      const table = document.querySelector('table');
      const tableVisible = table ? window.getComputedStyle(table.closest('.hidden.lg\\:block') || table).display !== 'none' : false;

      // Check card 13 input
      const row13Input = cards.length === 13 ? cards[12].querySelector('input') : null;
      const row13Placeholder = row13Input ? row13Input.placeholder : '';

      // Check column labels
      const colLabels = cards.length > 0 ? Array.from(cards[0].querySelectorAll('span.text-\\[10px\\]')).map(s => s.textContent?.trim()) : [];

      return {
        count: cards.length,
        containerScrollWidth: container ? container.scrollWidth : 0,
        containerClientWidth: container ? container.clientWidth : 0,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        desktopTableVisible: tableVisible,
        row13Placeholder,
        colLabels
      };
    });

    addTest('RC1/D1: Exactly 13 mobile activity cards on 360px', mobileCardsInfo.count === 13, { count: mobileCardsInfo.count });
    addTest('RC1/D1: Zero horizontal scroll on mobile container (scrollWidth === clientWidth)', 
      mobileCardsInfo.containerScrollWidth <= mobileCardsInfo.containerClientWidth + 1, 
      { scrollWidth: mobileCardsInfo.containerScrollWidth, clientWidth: mobileCardsInfo.containerClientWidth }
    );
    addTest('RC1/D1: Zero document horizontal overflow on 360px', 
      mobileCardsInfo.bodyScrollWidth <= mobileCardsInfo.bodyClientWidth, 
      { scrollWidth: mobileCardsInfo.bodyScrollWidth, clientWidth: mobileCardsInfo.bodyClientWidth }
    );
    addTest('RC1/D1: Desktop table hidden on mobile', !mobileCardsInfo.desktopTableVisible);
    addTest('RC1/D1: Activity 13 has placeholder "કિંમત લખો..."', mobileCardsInfo.row13Placeholder === 'કિંમત લખો...', { row13Placeholder: mobileCardsInfo.row13Placeholder });
    addTest('RC1/D1: Verbatim Gujarati micro-labels (ગુજિશતા, અઝાઇમ, મોજૂદા)', 
      mobileCardsInfo.colLabels[0] === 'ગુજિશતા' && mobileCardsInfo.colLabels[1] === 'અઝાઇમ' && mobileCardsInfo.colLabels[2] === 'મોજૂદા',
      { colLabels: mobileCardsInfo.colLabels }
    );

    // D3: Block Order on Mobile (BlockA -> BlockB -> BlockC)
    const mobileBlockOrder = await page.evaluate(() => {
      // Find elements
      const stepper = document.querySelector('.flow-stepper-container');
      const cardsB = document.querySelector('.space-y-3.lg\\:hidden'); // BlockB
      const mobileBlockC = document.querySelector('.lg\\:hidden > .space-y-5'); // Mobile BlockC

      if (!stepper || !cardsB || !mobileBlockC) return { valid: false };

      const stepperTop = stepper.getBoundingClientRect().top;
      const cardsBTop = cardsB.getBoundingClientRect().top;
      const blockCTop = mobileBlockC.getBoundingClientRect().top;

      return {
        valid: stepperTop < cardsBTop && cardsBTop < blockCTop,
        stepperTop,
        cardsBTop,
        blockCTop
      };
    });
    addTest('RC3/D3: Block Order on mobile is BlockA -> BlockB -> BlockC', mobileBlockOrder.valid, mobileBlockOrder);

    // D6: Scan Pills min-height >= 56px & items-stretch
    const scanPillsHeight = await page.evaluate(() => {
      const p1 = document.querySelector('#btn-camera-scan');
      const p2 = document.querySelector('#btn-gallery-scan');
      if (!p1 || !p2) return null;
      const h1 = p1.getBoundingClientRect().height;
      const h2 = p2.getBoundingClientRect().height;
      return { h1, h2, equal: Math.abs(h1 - h2) < 2, minHeightMet: h1 >= 56 && h2 >= 56 };
    });
    addTest('D6: Scan Pills equal height and min-height >= 56px at 360px', 
      scanPillsHeight ? (scanPillsHeight.equal && scanPillsHeight.minHeightMet) : false, 
      scanPillsHeight
    );

    // D8: Bottom clearance (pb-36)
    const bottomClearance = await page.evaluate(() => {
      const container = document.querySelector('.new-report-container');
      if (!container) return 0;
      const style = window.getComputedStyle(container);
      return parseInt(style.paddingBottom, 10);
    });
    addTest('D8: Bottom clearance >= 144px (pb-36) for bottom nav clearance', bottomClearance >= 144, { bottomClearance });

    // Capture 360px screenshots in all 3 themes
    for (const th of themes) {
      await page.evaluate((theme) => {
        if (window.__setTheme) {
          window.__setTheme(theme);
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('theme', theme);
        }
      }, th);
      await new Promise(r => setTimeout(r, 450));

      const shotName = `s41_mobile_360px_${th}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotName), fullPage: true });
      results.screenshots.push({ name: shotName, theme: th, viewport: '360px' });
      console.log(`Saved screenshot: ${shotName}`);
    }

    // Capture mobile card close-up screenshot
    const mobileCardEl = await page.$('.activity-mobile-card');
    if (mobileCardEl) {
      const cardShot = 's41_mobile_card_closeup.png';
      await mobileCardEl.screenshot({ path: path.join(SCREENSHOT_DIR, cardShot) });
      results.screenshots.push({ name: cardShot, note: 'Card 1 closeup showing rank chip, title, 3-col input grid' });
      console.log(`Saved screenshot: ${cardShot}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Single Source of Truth for State between Mobile & Desktop (Note N1)
    // ─────────────────────────────────────────────────────────────
    const testNotesContent = 'પરીક્ષણ ખાસ નોંધ - સિંગલ સોર્સ ઓફ ટ્રુથ ચકાસણી';
    // Type into mobile notes textarea using native prototype setter to update React state
    await page.evaluate((text) => {
      const mobileTextarea = document.querySelector('.lg\\:hidden textarea[aria-label="ખાસ નોંધ"]');
      if (mobileTextarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(mobileTextarea, text);
        mobileTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        mobileTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, testNotesContent);

    // Switch to desktop 1280px
    await page.setViewport({ width: 1280, height: 900 });
    await new Promise(r => setTimeout(r, 500));

    // Verify desktop notes textarea has the exact text
    const desktopNotesValue = await page.evaluate(() => {
      const dt = document.querySelector('.hidden.lg\\:block textarea[aria-label="ખાસ નોંધ"]');
      return dt ? dt.value : null;
    });
    addTest('Note N1: Single Source of Truth (mobile input reflected in desktop instance)', 
      desktopNotesValue === testNotesContent, 
      { mobileValue: testNotesContent, desktopValue: desktopNotesValue }
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Desktop 1280px Viewport Verification (D3, D4, Zero Regression)
    // ─────────────────────────────────────────────────────────────
    const desktopLayoutInfo = await page.evaluate(() => {
      const table = document.querySelector('.report-table-scroll table');
      const mobileCardsContainer = document.querySelector('.space-y-3.lg\\:hidden');
      const allLgHidden = document.querySelectorAll('.lg\\:hidden');
      const mobileBlockCContainer = allLgHidden.length > 1 ? allLgHidden[1] : allLgHidden[0];
      const desktopBlockCContainer = document.querySelector('.hidden.lg\\:block');

      const mobileCardsVisible = mobileCardsContainer ? window.getComputedStyle(mobileCardsContainer).display !== 'none' : false;
      const mobileBlockCVisible = mobileBlockCContainer ? window.getComputedStyle(mobileBlockCContainer).display !== 'none' : false;
      const desktopBlockCVisible = desktopBlockCContainer ? window.getComputedStyle(desktopBlockCContainer).display !== 'none' : false;
      const tableVisible = table ? window.getComputedStyle(table.closest('.hidden.lg\\:block') || table).display !== 'none' : false;

      // Check table rows count
      const rows = table ? table.querySelectorAll('tbody tr') : [];

      return {
        tableVisible,
        mobileCardsVisible,
        mobileBlockCVisible,
        desktopBlockCVisible,
        tableRowsCount: rows.length
      };
    });

    addTest('RC3/D3: Desktop Table visible on 1280px (13 rows)', 
      desktopLayoutInfo.tableVisible && desktopLayoutInfo.tableRowsCount === 13, 
      desktopLayoutInfo
    );
    addTest('RC3/D3: Mobile cards and mobile BlockC hidden on desktop (display: none)', 
      !desktopLayoutInfo.mobileCardsVisible && !desktopLayoutInfo.mobileBlockCVisible,
      desktopLayoutInfo
    );
    addTest('RC3/D3: Desktop BlockC visible on desktop (left col 5/12)', 
      desktopLayoutInfo.desktopBlockCVisible, 
      desktopLayoutInfo
    );

    // Capture 1280px screenshots in all 3 themes
    for (const th of themes) {
      await page.evaluate((theme) => {
        if (window.__setTheme) {
          window.__setTheme(theme);
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('theme', theme);
        }
      }, th);
      await new Promise(r => setTimeout(r, 450));

      const shotName = `s41_desktop_1280px_${th}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotName), fullPage: true });
      results.screenshots.push({ name: shotName, theme: th, viewport: '1280px' });
      console.log(`Saved screenshot: ${shotName}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Ultra-wide 2560px Viewport
    // ─────────────────────────────────────────────────────────────
    await page.setViewport({ width: 2560, height: 1200 });
    await new Promise(r => setTimeout(r, 300));
    const shot2560 = 's41_desktop_2560px_outdoor.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot2560), fullPage: true });
    results.screenshots.push({ name: shot2560, theme: 'outdoor', viewport: '2560px' });
    console.log(`Saved screenshot: ${shot2560}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Scrolled Header Overlay Test (RC2 / D2)
    // ─────────────────────────────────────────────────────────────
    await page.setViewport({ width: 360, height: 700 });
    await page.evaluate(() => {
      window.scrollTo(0, 400);
    });
    await new Promise(r => setTimeout(r, 300));
    const scrolledHeaderShot = 's41_scrolled_header_overlay.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, scrolledHeaderShot) });
    results.screenshots.push({ name: scrolledHeaderShot, note: 'Header opaque over scrolled content' });
    console.log(`Saved screenshot: ${scrolledHeaderShot}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Route Transition Test (D5)
    // ─────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    // Click New Report in nav
    await page.evaluate(() => {
      const newReportLink = document.querySelector('a[href="/"]');
      if (newReportLink) newReportLink.click();
    });
    await new Promise(r => setTimeout(r, 60)); // capture during transition
    const transitionClassPresent = await page.evaluate(() => {
      return !!document.querySelector('.route-transition-enter');
    });
    addTest('D5: Route Transition class .route-transition-enter present on page navigation', transitionClassPresent);

    // Save final report JSON
    const resultsPath = path.join(ARTIFACT_DIR, 's41_proof_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nProof results saved to: ${resultsPath}`);

  } catch (err) {
    console.error('Error during proof execution:', err);
    results.tests.push({ name: 'Execution Error', passed: false, error: err.message });
  } finally {
    await browser.close();
  }

  const allPassed = results.tests.every(t => t.passed);
  console.log(`\n========================================`);
  console.log(`S41-MASTER PROOF SUITE: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  console.log(`Total tests: ${results.tests.length}`);
  console.log(`Passed: ${results.tests.filter(t => t.passed).length}`);
  console.log(`Failed: ${results.tests.filter(t => !t.passed).length}`);
  console.log(`========================================\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runProof();
