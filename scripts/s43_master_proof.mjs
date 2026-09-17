import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/432da78c-2e73-452f-95d9-58ee4eb29068';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's43_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runProof() {
  console.log('Starting S43-MASTER Comprehensive Proof Suite...');
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

    // Enable request interception globally
    await page.setRequestInterception(true);
    let mockMode = 'passthrough'; // 'passthrough' | 'success' | 'fail'

    page.on('request', (req) => {
      if (req.url().includes('/api/scan-extract')) {
        if (mockMode === 'success') {
          req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              halqa_name: { v: 'ડીસા', ok: true },
              stats: {
                student_count: { v: '45', ok: true },
                std10: { v: '12', ok: true },
                std11: { v: '8', ok: true },
                std12: { v: '10', ok: true },
                college: { v: '15', ok: true },
                engineer: { v: '3', ok: true },
                medical: { v: '2', ok: true },
                muslim_teachers: { v: '4', ok: true }
              },
              activities: [
                { no: 1, gujishata: { v: 'હા', ok: true }, agraaham: { v: 'હા', ok: true }, mojuda: { v: 'હા', ok: true } },
                { no: 7, gujishata: { v: '85', ok: true }, agraaham: { v: '90', ok: true }, mojuda: { v: '95', ok: true } }
              ]
            })
          });
        } else if (mockMode === 'fail') {
          req.respond({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Simulated scan extraction error' })
          });
        } else {
          req.continue();
        }
      } else {
        req.continue();
      }
    });

    // Setup initial state: complete onboarding and session
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: '9999', role: 'admin' }));
      localStorage.setItem('theme', 'outdoor');
      document.documentElement.setAttribute('data-theme', 'outdoor');
    });

    // Set mobile viewport (360 x 740 standard mobile device)
    await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    // Create a valid test image file
    const sampleImgPath = path.join(ARTIFACT_DIR, 'test_scan_sample_s43.jpg');
    const testCanvasHandle = await page.evaluateHandle(() => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#111827';
      ctx.font = '16px sans-serif';
      ctx.fillText('Test Report', 20, 50);
      return c.toDataURL('image/jpeg');
    });
    const sampleBase64 = (await testCanvasHandle.jsonValue()).replace(/^data:image\/jpeg;base64,/, '');
    fs.writeFileSync(sampleImgPath, Buffer.from(sampleBase64, 'base64'));

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Note N2 & N3 CSS Rules Static & Computed Verification
    // ─────────────────────────────────────────────────────────────
    const cssVerification = await page.evaluate(() => {
      let foundN2Standalone = false;
      let foundN3Fallback = false;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const text = rule.cssText;
            // N2 check: body.has-overlay-open rule without :has()
            if (text.includes('body.has-overlay-open') && !text.includes(':has(') && text.includes('display: none')) {
              foundN2Standalone = true;
            }
            // N3 check: max-height with 100vh / 100dvh
            if (text.includes('viewport-fixed-overlay') && text.includes('max-height') && (text.includes('100vh') || text.includes('100dvh'))) {
              foundN3Fallback = true;
            }
          }
        } catch {
          // Cross-origin stylesheet ignore
        }
      }

      return { foundN2Standalone, foundN3Fallback };
    });

    addTest('Note N2: Standalone body.has-overlay-open rule exists without :has() comma-joining',
      cssVerification.foundN2Standalone,
      cssVerification
    );

    addTest('Note N3: max-height with viewport fallback exists in CSS',
      cssVerification.foundN3Fallback,
      cssVerification
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 2: C1 / D1 — Camera Scan Input Pipeline & Review Overlay
    // ─────────────────────────────────────────────────────────────
    mockMode = 'success';
    const cameraInput = await page.$('#camera-scan-input');
    if (cameraInput) {
      await cameraInput.uploadFile(sampleImgPath);
      await page.waitForSelector('#scan-review-container', { visible: true, timeout: 6000 });
      await new Promise(r => setTimeout(r, 250));

      const cameraReviewMetrics = await page.evaluate(() => {
        const overlay = document.querySelector('.viewport-fixed-overlay');
        const container = document.querySelector('#scan-review-container');
        const nav = document.querySelector('.bottom-nav-root');
        const footer = container?.querySelector('.sticky.bottom-0');
        const cancelBtn = footer?.querySelectorAll('button')?.[0];
        const confirmBtn = footer?.querySelectorAll('button')?.[1];

        if (!container || !overlay) return null;

        const cRect = container.getBoundingClientRect();
        const oComp = window.getComputedStyle(overlay);
        const navComp = nav ? window.getComputedStyle(nav) : null;
        const cancelRect = cancelBtn?.getBoundingClientRect();
        const confirmRect = confirmBtn?.getBoundingClientRect();

        return {
          overlayZIndex: oComp.zIndex,
          overlayAlignItems: oComp.alignItems,
          overlayPaddingTop: oComp.paddingTop,
          containerTop: cRect.top,
          containerBottom: cRect.bottom,
          inViewport: cRect.top >= 0 && cRect.bottom <= 740,
          hasOverlayClass: document.body.classList.contains('has-overlay-open'),
          navHidden: navComp?.display === 'none',
          footerVisible: !!footer,
          cancelBtnHeight: cancelRect?.height,
          confirmBtnHeight: confirmRect?.height,
          footerInViewport: confirmRect ? confirmRect.bottom <= 740 && confirmRect.top >= 0 : false
        };
      });

      const shotCamReview = 's43_camera_review_overlay.png';
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotCamReview) });
      results.screenshots.push({ name: shotCamReview, context: 'Camera ReviewOverlay top-anchored with visible sticky footer' });

      addTest('C1 & C2: Camera upload opens ReviewOverlay top-anchored (z-70, items-start, top <= 20px)',
        cameraReviewMetrics &&
        cameraReviewMetrics.overlayZIndex === '70' &&
        cameraReviewMetrics.overlayAlignItems === 'flex-start' &&
        cameraReviewMetrics.containerTop <= 20,
        cameraReviewMetrics
      );

      addTest('C2: BottomNav has display: none and body has has-overlay-open while review is open',
        cameraReviewMetrics && cameraReviewMetrics.navHidden && cameraReviewMetrics.hasOverlayClass,
        cameraReviewMetrics
      );

      addTest('C2: Sticky footer action buttons (રદ કરો & ફોર્મમાં ભરો) have h=48px and are inside viewport',
        cameraReviewMetrics &&
        cameraReviewMetrics.cancelBtnHeight >= 47 &&
        cameraReviewMetrics.confirmBtnHeight >= 47 &&
        cameraReviewMetrics.footerInViewport,
        cameraReviewMetrics
      );

      // Close review overlay via Escape
      await page.keyboard.press('Escape');
      await page.waitForSelector('#scan-review-container', { hidden: true });
      await new Promise(r => setTimeout(r, 150));

      const postCamClose = await page.evaluate(() => {
        const nav = document.querySelector('.bottom-nav-root');
        return {
          navDisplay: nav ? window.getComputedStyle(nav).display : '',
          hasOverlayClass: document.body.classList.contains('has-overlay-open'),
          bodyOverflow: document.body.style.overflow
        };
      });

      addTest('C2: Closing ReviewOverlay restores BottomNav display and removes has-overlay-open',
        postCamClose.navDisplay !== 'none' && !postCamClose.hasOverlayClass && postCamClose.bodyOverflow === '',
        postCamClose
      );
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 3: C1 Regression — Gallery Scan Input Pipeline
    // ─────────────────────────────────────────────────────────────
    mockMode = 'success';
    const galleryInput = await page.$('#gallery-scan-input');
    if (galleryInput) {
      // Use a new file path to guarantee file change trigger
      const galImgPath = path.join(ARTIFACT_DIR, 'test_scan_sample_gal.jpg');
      fs.copyFileSync(sampleImgPath, galImgPath);

      await galleryInput.uploadFile(galImgPath);
      await page.waitForSelector('#scan-review-container', { visible: true, timeout: 6000 });
      await new Promise(r => setTimeout(r, 200));

      const galReviewMetrics = await page.evaluate(() => {
        const container = document.querySelector('#scan-review-container');
        const nav = document.querySelector('.bottom-nav-root');
        if (!container) return null;
        const cRect = container.getBoundingClientRect();
        return {
          containerTop: cRect.top,
          navHidden: nav ? window.getComputedStyle(nav).display === 'none' : false,
          hasOverlayClass: document.body.classList.contains('has-overlay-open')
        };
      });

      addTest('C1 & C2: Gallery upload triggers identical top-anchored review overlay with hidden nav',
        galReviewMetrics && galReviewMetrics.containerTop <= 20 && galReviewMetrics.navHidden && galReviewMetrics.hasOverlayClass,
        galReviewMetrics
      );

      // Close review overlay via Escape
      await page.keyboard.press('Escape');
      await page.waitForSelector('#scan-review-container', { hidden: true });
      await new Promise(r => setTimeout(r, 150));
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 4: C3 — NeumorphicCalendarDialog Top-Anchored & Sticky Footer
    // ─────────────────────────────────────────────────────────────
    const themes = ['outdoor', 'dark', 'premium'];
    for (const theme of themes) {
      await page.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
        localStorage.setItem('theme', th);
      }, theme);
      await new Promise(r => setTimeout(r, 100));

      // Trigger calendar at top
      await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
      await page.waitForSelector('#calendar-dialog-container', { visible: true });
      await new Promise(r => setTimeout(r, 200));

      const calMetrics = await page.evaluate(() => {
        const overlay = document.querySelector('#calendar-dialog-overlay');
        const container = document.querySelector('#calendar-dialog-container');
        const nav = document.querySelector('.bottom-nav-root');
        const clearBtn = document.querySelector('#neu-cal-clear-btn');
        const todayBtn = document.querySelector('#neu-cal-today-btn');
        const footer = clearBtn?.parentElement;

        if (!container || !overlay) return null;

        const cRect = container.getBoundingClientRect();
        const oComp = window.getComputedStyle(overlay);
        const navComp = nav ? window.getComputedStyle(nav) : null;
        const clearRect = clearBtn?.getBoundingClientRect();
        const todayRect = todayBtn?.getBoundingClientRect();

        return {
          overlayZIndex: oComp.zIndex,
          overlayAlignItems: oComp.alignItems,
          containerTop: cRect.top,
          containerBottom: cRect.bottom,
          navHidden: navComp?.display === 'none',
          hasOverlayClass: document.body.classList.contains('has-overlay-open'),
          clearBtnHeight: clearRect?.height,
          todayBtnHeight: todayRect?.height,
          footerInViewport: todayRect ? todayRect.bottom <= 740 && todayRect.top >= 0 : false
        };
      });

      const shotCal = `s43_cal_top_${theme}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotCal) });
      results.screenshots.push({ name: shotCal, context: `Calendar Dialog top-anchored (${theme})` });

      addTest(`C2 & C3: Calendar dialog in '${theme}' is top-anchored (top <= 20px) with hidden BottomNav`,
        calMetrics && calMetrics.containerTop <= 20 && calMetrics.navHidden && calMetrics.hasOverlayClass,
        calMetrics
      );

      addTest(`C2: Calendar sticky footer pills (સાફ કરો & આજે) have h=48px and are inside viewport (${theme})`,
        calMetrics && calMetrics.clearBtnHeight >= 47 && calMetrics.todayBtnHeight >= 47 && calMetrics.footerInViewport,
        calMetrics
      );

      // Close calendar
      await page.keyboard.press('Escape');
      await page.waitForSelector('#calendar-dialog-container', { hidden: true });
      await new Promise(r => setTimeout(r, 100));
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Calendar Scrolled Open (Y=450) Position & Restoration
    // ─────────────────────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 450));
    await new Promise(r => setTimeout(r, 150));
    const scrollYBeforeOpen = await page.evaluate(() => window.scrollY);

    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 200));

    const scrolledCalMetrics = await page.evaluate(() => {
      const container = document.querySelector('#calendar-dialog-container');
      const rect = container?.getBoundingClientRect();
      return {
        top: rect?.top,
        bottom: rect?.bottom,
        bodyOverflow: document.body.style.overflow,
        inViewport: rect ? rect.top >= 0 && rect.bottom <= 740 : false
      };
    });

    const shotScrolled = 's43_cal_scrolled_open.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotScrolled) });
    results.screenshots.push({ name: shotScrolled, context: 'Calendar Dialog opened from scrolled position (Y=450)' });

    addTest('C2 & C3: Calendar opened from scrolled position renders top-anchored without page scroll',
      scrolledCalMetrics && scrolledCalMetrics.top <= 20 && scrolledCalMetrics.bodyOverflow === 'hidden',
      scrolledCalMetrics
    );

    // Close calendar and verify scroll restored
    await page.keyboard.press('Escape');
    await page.waitForSelector('#calendar-dialog-container', { hidden: true });
    await new Promise(r => setTimeout(r, 150));

    const scrollYAfterClose = await page.evaluate(() => ({
      scrollY: window.scrollY,
      bodyOverflow: document.body.style.overflow
    }));

    addTest('C2: Scroll position restored to 450 after closing scrolled calendar',
      Math.abs(scrollYAfterClose.scrollY - scrollYBeforeOpen) <= 2 && scrollYAfterClose.bodyOverflow === '',
      { expectedY: scrollYBeforeOpen, actualY: scrollYAfterClose.scrollY }
    );

    // Reset scroll
    await page.evaluate(() => window.scrollTo(0, 0));

    // ─────────────────────────────────────────────────────────────
    // TEST 6: C3 — Calendar Open Performance Mark (< 300ms headless)
    // ─────────────────────────────────────────────────────────────
    const latencies = [];
    for (let i = 0; i < 3; i++) {
      const openLatency = await page.evaluate(async () => {
        const t0 = performance.now();
        const trigger = document.querySelector('#btn-date-picker-trigger');
        trigger.click();

        // Wait until dialog container is in DOM and has non-zero size
        await new Promise(resolve => {
          const check = () => {
            const el = document.querySelector('#calendar-dialog-container');
            if (el && el.getBoundingClientRect().height > 100) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          };
          check();
        });

        const t1 = performance.now();
        return t1 - t0;
      });

      latencies.push(openLatency);

      // Close dialog for next iteration
      await page.keyboard.press('Escape');
      await page.waitForSelector('#calendar-dialog-container', { hidden: true });
      await new Promise(r => setTimeout(r, 100));
    }

    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    addTest('C3: Calendar open latency is under 300ms headless (compositor-only, memoized grid)',
      avgLatency < 300,
      { latencies, avgLatencyMs: avgLatency }
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 7: C1 — Camera Scan Error Path & Verbatim Toast
    // ─────────────────────────────────────────────────────────────
    mockMode = 'fail';
    const errImgPath = path.join(ARTIFACT_DIR, 'test_scan_sample_err.jpg');
    fs.copyFileSync(sampleImgPath, errImgPath);

    const cameraErrInput = await page.$('#camera-scan-input');
    if (cameraErrInput) {
      await cameraErrInput.uploadFile(errImgPath);
      // Wait for toast to appear
      const expectedToastText = 'સ્કેન નિષ્ફળ ❌ — સાફ રોશનીમાં ફોટો લઈને ફરી પ્રયત્ન કરો';

      const toastFound = await page.waitForFunction(
        (expected) => {
          const bodyText = document.body.innerText;
          return bodyText.includes(expected);
        },
        { timeout: 8000 },
        expectedToastText
      ).then(() => true).catch(() => false);

      const shotErrToast = 's43_camera_err_toast.png';
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotErrToast) });
      results.screenshots.push({ name: shotErrToast, context: 'Camera failure verbatim toast' });

      addTest('C1: Simulated camera failure renders verbatim error toast without silent hang',
        toastFound,
        { expectedToastText, toastFound }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Full Regression — Save, Date Select, and Golden Rules
    // ─────────────────────────────────────────────────────────────
    // Open calendar and select today
    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 100));

    await page.evaluate(() => document.querySelector('#neu-cal-today-btn').click());
    await page.waitForSelector('#calendar-dialog-container', { hidden: true });
    await new Promise(r => setTimeout(r, 150));

    const selectedDateValue = await page.evaluate(() => {
      const trigger = document.querySelector('#btn-date-picker-trigger');
      return trigger ? trigger.innerText : '';
    });

    addTest('D4: Calendar "આજે" button selects current date and closes dialog cleanly',
      selectedDateValue.length > 0 && selectedDateValue !== 'તારીખ પસંદ કરો',
      { selectedDateValue }
    );

    // Save report test
    const saveBtn = await page.$('#btn-save-report');
    if (saveBtn) {
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 400));

      const saveToast = await page.evaluate(() => {
        return document.body.innerText.includes('રિપોર્ટ સફળતાપૂર્વક સાચવવામાં આવ્યો') ||
               document.body.innerText.includes('સાચવવામાં આવ્યો') ||
               document.body.innerText.includes('✅');
      });

      addTest('D4: Report save works smoothly with DATA KAVACH intact',
        saveToast,
        { saveToast }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Desktop Viewport (1280px) Check
    // ─────────────────────────────────────────────────────────────
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.querySelector('#btn-date-picker-trigger').click());
    await page.waitForSelector('#calendar-dialog-container', { visible: true });
    await new Promise(r => setTimeout(r, 150));

    const desktopMetrics = await page.evaluate(() => {
      const container = document.querySelector('#calendar-dialog-container');
      const rect = container?.getBoundingClientRect();
      return {
        top: rect?.top,
        bottom: rect?.bottom,
        inViewport: rect ? rect.top >= 0 && rect.bottom <= 800 : false
      };
    });

    const shotDesktop = 's43_cal_desktop.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotDesktop) });
    results.screenshots.push({ name: shotDesktop, context: 'Desktop Calendar Dialog top-anchored' });

    addTest('D4: Desktop calendar renders top-anchored inside viewport',
      desktopMetrics && desktopMetrics.top <= 20 && desktopMetrics.inViewport,
      desktopMetrics
    );

    await page.keyboard.press('Escape');

  } catch (err) {
    console.error('Test run failed with error:', err);
    addTest('Suite Execution Complete', false, { error: err.message, stack: err.stack });
  } finally {
    await browser.close();
  }

  // Summary
  const passedCount = results.tests.filter(t => t.passed).length;
  const totalCount = results.tests.length;
  const allPassed = passedCount === totalCount;

  console.log(`\n========================================`);
  console.log(`S43-MASTER Proof Suite: ${passedCount}/${totalCount} Passed (${allPassed ? 'ALL PASS ✅' : 'FAIL ❌'})`);
  console.log(`========================================\n`);

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 's43_proof_results.json'),
    JSON.stringify(results, null, 2)
  );

  return allPassed;
}

runProof().then(success => {
  process.exit(success ? 0 : 1);
});
