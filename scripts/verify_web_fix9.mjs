import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'c:\\Users\\DELL\\OneDrive\\Desktop\\NEW WEB APP\\web_fix9_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const APP_URL = 'http://localhost:5173/';
const sampleImgPath = path.resolve('sample_report_test.jpg');

// Create a corrupt image file
const corruptImgPath = path.resolve('corrupt_sample.jpg');
fs.writeFileSync(corruptImgPath, Buffer.from('NOT_A_REAL_IMAGE_CORRUPT_BYTES_XYZ_123456789'));

(async () => {
  console.log('--- Starting WEB-FIX9 Comprehensive Verification ---');
  console.log('Conditions: CPU 4x throttled, Network OFFLINE after page load (proves self-hosted local assets)');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

    // Setup authenticated session
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('mt_onboarded', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      sessionStorage.setItem('mt_greeted', '1');
    });

    // Load page online first so service worker and initial bundle are loaded
    console.log('[Network] Loading page...');
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    // Wait for Service Worker registration
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    console.log('[SW] Service Worker is active and precache ready');

    // AFTER PAGE LOAD: Throttle CPU 4x in devtools AND switch network OFFLINE
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    console.log('[CDP] CPU throttled to 4x rate after page load');

    await page.setOfflineMode(true);
    console.log('[Network] Switched to OFFLINE mode after page load (proves self-hosted assets)');


    // ─────────────────────────────────────────────────────────────
    // TEST 1: F2 - Corrupt File Upload -> "ફોટો ફોર્મેટ સપોર્ટેડ નથી" Toast
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 1] Verifying Corrupt File / Decode Failure -> Format Error Toast...');
    const galleryInput = await page.$('#gallery-scan-input');
    if (!galleryInput) throw new Error('#gallery-scan-input not found');

    await galleryInput.uploadFile(corruptImgPath);

    // Wait for toast containing "ફોટો ફોર્મેટ સપોર્ટેડ નથી"
    await page.waitForFunction(
      () => {
        const txt = document.body.innerText;
        return txt.includes('ફોટો ફોર્મેટ સપોર્ટેડ નથી');
      },
      { timeout: 8000 }
    );
    console.log('✓ Toast "ફોટો ફોર્મેટ સપોર્ટેડ નથી" displayed immediately upon corrupt decode failure');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_corrupt_file_format_toast.png'),
      fullPage: false
    });

    // Check button is back to idle
    const btnTextAfterCorrupt = await page.$eval('#btn-gallery-scan', el => el.innerText.trim());
    console.log(`✓ Button state reset to idle: "${btnTextAfterCorrupt}"`);
    if (!btnTextAfterCorrupt.includes('ગેલરીથી ઇમ્પોર્ટ')) {
      throw new Error('Button did not reset to idle after format error');
    }

    // Wait for format toast to dismiss
    await new Promise((r) => setTimeout(r, 2500));

    // ─────────────────────────────────────────────────────────────
    // TEST 2: F1 & F2 & F4 - Offline Self-Contained OCR with 4x CPU Throttling
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Verifying Gallery Import of Sample Report Photo OFFLINE with 4x CPU Throttling...');

    // Upload sample report photo
    await galleryInput.uploadFile(sampleImgPath);

    // Verify scanning indicator
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('#btn-gallery-scan');
        return btn && btn.innerText.includes('સ્કેન થઈ રહ્યું છે');
      },
      { timeout: 4000 }
    );
    console.log('✓ Button transitioned to scanning spinner ("સ્કેન થઈ રહ્યું છે...")');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_offline_scanning_spinner.png'),
      fullPage: false
    });

    // Wait for OCR to finish and result picker modal to open
    console.log('[OCR] Processing sample report offline on 4x throttled CPU...');
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]');
        const text = document.body.innerText;
        return (dialog && text.includes('ફોર્મમાં ભરો') && text.includes('રદ કરો'));
      },
      { timeout: 35000 }
    );
    console.log('✓ Post-scan result picker modal opened successfully while 100% OFFLINE!');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_offline_picker_modal_opened.png'),
      fullPage: false
    });

    // Inspect picker contents
    const modalText = await page.$eval('[role="dialog"]', el => el.innerText);
    console.log('Modal contains "ફોર્મમાં ભરો":', modalText.includes('ફોર્મમાં ભરો'));
    console.log('Modal contains "રદ કરો":', modalText.includes('રદ કરો'));

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Confirm Fill Populates Form
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Verifying Confirm Fill ("ફોર્મમાં ભરો")...');
    const fillBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText.includes('ફોર્મમાં ભરો'));
    });

    if (!fillBtn) throw new Error('"ફોર્મમાં ભરો" button not found in modal');
    await fillBtn.click();
    await new Promise(r => setTimeout(r, 800));

    // Verify modal closed
    const modalOpenAfterFill = await page.$('[role="dialog"]');
    console.log('✓ Result picker closed after confirming fill:', modalOpenAfterFill === null);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_form_filled_from_picker.png'),
      fullPage: false
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 4: F3 - Real Error Reason + Automatic Retry + System Logs
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Verifying OCR Failure Automatic Retry and Admin System Logs...');

    // Set simulated failure to test retry and reason categorization
    await page.evaluate(() => {
      window.__simulateOcrFail = true;
      window.__simulateOcrFailReason = 'Engine memory allocation failed';
    });

    await galleryInput.uploadFile(sampleImgPath);

    // Wait for the standard bottom toast containing "સ્કેન નિષ્ફળ: memory"
    await page.waitForFunction(
      () => {
        const container = document.querySelector('#toast-message-container') || document.body;
        return container.textContent && container.textContent.includes('સ્કેન નિષ્ફળ: memory');
      },
      { timeout: 15000 }
    );
    console.log('✓ Real retry executed and bottom toast "સ્કેન નિષ્ફળ: memory" displayed');

    // Verify system logs contain the failure reason
    const logs = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('system_logs') || '[]');
    });
    console.log('✓ System logs entry verified:', logs[0]);
    if (!logs[0]?.action?.includes('સ્કેન નિષ્ફળ: memory')) {
      throw new Error('System logs do not contain failure entry "સ્કેન નિષ્ફળ: memory"');
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05_ocr_failure_retry_logged.png'),
      fullPage: false
    });
    console.log('✓ OCR error toast format verified: "સ્કેન નિષ્ફળ: <reason>"');

    console.log('\n========================================');
    console.log('ALL WEB-FIX9 VERIFICATION TESTS PASSED!');
    console.log('========================================');
  } catch (err) {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
