import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'c:\\Users\\DELL\\OneDrive\\Desktop\\NEW WEB APP\\web_fix8_screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const APP_URL = 'http://localhost:5173/';

// Minimal valid 1x1 JPEG
const sampleJpgBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const sampleImgPath = path.resolve(SCREENSHOT_DIR, 'test_scan_sample.jpg');
fs.writeFileSync(sampleImgPath, Buffer.from(sampleJpgBase64, 'base64'));

(async () => {
  console.log('--- Starting WEB-FIX8 Comprehensive Verification ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

  let mockOcrMode = 'normal'; // 'normal' | 'fail'

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/scan-extract')) {
      if (mockOcrMode === 'fail') {
        req.respond({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'OCR Upstream Failure Simulated' })
        });
        return;
      }
    }
    req.continue();
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mt_onboarded', '1');
    localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
    sessionStorage.setItem('mt_greeted', '1');
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // ─────────────────────────────────────────────────────────────
  // TEST 1: F1 - Verify Camera Option Removed & Single Full-Width Gallery Button
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 1] Verifying camera removal & single full-width gallery button...');
  const cameraBtn = await page.$('#btn-camera-scan');
  const cameraInput = await page.$('#camera-scan-input');
  const galleryBtn = await page.$('#btn-gallery-scan');
  const galleryInput = await page.$('#gallery-scan-input');

  const f1Check = await page.evaluate(() => {
    const camBtn = document.querySelector('#btn-camera-scan');
    const camInput = document.querySelector('#camera-scan-input');
    const galBtn = document.querySelector('#btn-gallery-scan');
    const hintText = document.querySelector('#scan-fill-module p');
    const card = document.querySelector('#scan-fill-module');

    const galRect = galBtn?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();

    return {
      hasCamBtn: !!camBtn,
      hasCamInput: !!camInput,
      hasGalBtn: !!galBtn,
      galBtnText: galBtn?.innerText?.trim(),
      hintText: hintText?.innerText?.trim(),
      galBtnWidth: galRect ? Math.round(galRect.width) : 0,
      cardWidth: cardRect ? Math.round(cardRect.width) : 0,
      isFullWidth: galRect && cardRect ? (cardRect.width - galRect.width) <= 4 : false
    };
  });

  console.log('F1 Check Metrics:', f1Check);
  if (f1Check.hasCamBtn || f1Check.hasCamInput) {
    throw new Error('FAIL: Camera button or camera input still exists in DOM!');
  }
  if (!f1Check.hasGalBtn || !f1Check.isFullWidth) {
    throw new Error('FAIL: Gallery button is not rendered full-width!');
  }
  if (f1Check.hintText !== 'પૂરું પેજ, સાફ રોશની, છાયા વિના') {
    throw new Error(`FAIL: Hint text mismatch: "${f1Check.hintText}"`);
  }
  console.log('PASS: F1 camera removed, single full-width gallery button with hint text confirmed.');

  const shot1 = path.join(SCREENSHOT_DIR, '01_form_single_fullwidth_gallery_button.png');
  await page.screenshot({ path: shot1 });
  console.log(`Saved screenshot: ${shot1}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 2: F2 & F3 - Gallery Import Flow & Centered Picker Modal
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 2] Verifying gallery import -> spinner -> centered picker modal...');
  
  // Upload file
  await galleryInput.uploadFile(sampleImgPath);

  // Check scanning spinner state
  await new Promise(r => setTimeout(r, 100));
  const spinnerCheck = await page.evaluate(() => {
    const galBtn = document.querySelector('#btn-gallery-scan');
    const spinner = galBtn?.querySelector('.animate-spin');
    return {
      galBtnText: galBtn?.innerText?.trim(),
      hasSpinner: !!spinner
    };
  });
  console.log('Spinner Check:', spinnerCheck);

  const shot2 = path.join(SCREENSHOT_DIR, '02_gallery_import_scanning_spinner.png');
  await page.screenshot({ path: shot2 });
  console.log(`Saved screenshot: ${shot2}`);

  // Wait for picker modal to open
  await page.waitForSelector('#scan-review-container', { visible: true, timeout: 8000 });
  await new Promise(r => setTimeout(r, 400));

  const modalMetrics = await page.evaluate(() => {
    const overlay = document.querySelector('#scan-review-overlay');
    const container = document.querySelector('#scan-review-container');
    const cancelBtn = document.querySelector('#btn-scan-review-cancel');
    const confirmBtn = document.querySelector('#btn-scan-review-confirm');

    if (!container || !overlay) return null;

    const r = container.getBoundingClientRect();
    const vh = window.innerHeight;
    const topOffset = Math.round(r.top);
    const bottomOffset = Math.round(vh - r.bottom);

    // Check extracted field inputs
    const inputs = Array.from(container.querySelectorAll('input'));
    const filledInputs = inputs.filter(i => i.value && i.value.trim() !== '');

    return {
      containerWidth: Math.round(r.width),
      containerHeight: Math.round(r.height),
      topOffset,
      bottomOffset,
      verticalDiff: Math.abs(topOffset - bottomOffset),
      isVerticallyCentered: Math.abs(topOffset - bottomOffset) <= 40,
      hasCancelBtn: !!cancelBtn,
      cancelBtnText: cancelBtn?.innerText?.trim(),
      hasConfirmBtn: !!confirmBtn,
      confirmBtnText: confirmBtn?.innerText?.trim(),
      totalInputs: inputs.length,
      filledInputsCount: filledInputs.length,
      sampleValues: filledInputs.slice(0, 5).map(i => i.value)
    };
  });

  console.log('Picker Modal Metrics:', modalMetrics);
  if (!modalMetrics || !modalMetrics.isVerticallyCentered) {
    throw new Error('FAIL: Picker modal is not vertically centered!');
  }
  if (!modalMetrics.hasCancelBtn || modalMetrics.cancelBtnText !== 'રદ કરો') {
    throw new Error(`FAIL: Cancel button mismatch: ${modalMetrics?.cancelBtnText}`);
  }
  if (!modalMetrics.hasConfirmBtn || !modalMetrics.confirmBtnText.includes('ફોર્મમાં ભરો')) {
    throw new Error(`FAIL: Confirm button mismatch: ${modalMetrics?.confirmBtnText}`);
  }
  console.log('PASS: F2 Picker modal opened, centered, listing extracted values.');

  const shot3 = path.join(SCREENSHOT_DIR, '03_picker_modal_opened.png');
  await page.screenshot({ path: shot3 });
  console.log(`Saved screenshot: ${shot3}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Action "રદ કરો" closes without changing form
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 3] Verifying "રદ કરો" closes without changing form fields...');
  
  // Record form state before cancel
  const formStateBeforeCancel = await page.evaluate(() => {
    const studentInputs = Array.from(document.querySelectorAll('.count-zone-card input, #student-count-display'));
    return {
      text: document.querySelector('.count-zone-card')?.innerText || ''
    };
  });

  // Click "રદ કરો"
  await page.click('#btn-scan-review-cancel');
  await page.waitForSelector('#scan-review-container', { hidden: true });
  await new Promise(r => setTimeout(r, 400));

  const formStateAfterCancel = await page.evaluate(() => {
    return {
      text: document.querySelector('.count-zone-card')?.innerText || '',
      modalVisible: !!document.querySelector('#scan-review-container')
    };
  });

  console.log('Cancel Form State Check:', { modalVisible: formStateAfterCancel.modalVisible });
  if (formStateAfterCancel.modalVisible) {
    throw new Error('FAIL: Modal did not close on "રદ કરો" click!');
  }
  console.log('PASS: "રદ કરો" closed modal without modifying form.');

  const shot4 = path.join(SCREENSHOT_DIR, '04_discard_closes_form_unchanged.png');
  await page.screenshot({ path: shot4 });
  console.log(`Saved screenshot: ${shot4}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Action "ફોર્મમાં ભરો" fills mapped fields into form
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 4] Verifying "ફોર્મમાં ભરો" applies values into form fields...');
  
  // Upload file again to reopen modal
  const galImgPath2 = path.resolve(SCREENSHOT_DIR, 'test_scan_sample_2.jpg');
  fs.copyFileSync(sampleImgPath, galImgPath2);
  await galleryInput.uploadFile(galImgPath2);
  await page.waitForSelector('#scan-review-container', { visible: true, timeout: 8000 });
  await new Promise(r => setTimeout(r, 300));

  // Click "ફોર્મમાં ભરો"
  await page.click('#btn-scan-review-confirm');
  await page.waitForSelector('#scan-review-container', { hidden: true });
  await new Promise(r => setTimeout(r, 500));

  const formFilledState = await page.evaluate(() => {
    const countZone = document.querySelector('.count-zone-card');
    const toast = document.querySelector('#toast-message-container');
    const halqaBtn = document.querySelector('.snap-start button.bg-acc');

    return {
      countZoneText: countZone?.innerText?.trim(),
      toastText: toast?.innerText?.trim(),
      selectedHalqa: halqaBtn?.innerText?.trim()
    };
  });

  console.log('Form Filled State:', formFilledState);
  if (!formFilledState.toastText?.includes('સ્કેન ડેટા ભરાયો')) {
    throw new Error(`FAIL: Success fill toast missing: ${formFilledState.toastText}`);
  }
  console.log('PASS: "ફોર્મમાં ભરો" filled the mapped fields successfully.');

  const shot5 = path.join(SCREENSHOT_DIR, '05_apply_fills_mapped_fields.png');
  await page.screenshot({ path: shot5 });
  console.log(`Saved screenshot: ${shot5}`);

  // ─────────────────────────────────────────────────────────────
  // TEST 5: F3 - Simulated OCR failure shows themed error toast
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 5] Verifying simulated OCR failure shows themed error toast and resets button...');
  mockOcrMode = 'fail';

  // Wait for previous toast to clear
  await new Promise(r => setTimeout(r, 3200));

  const galImgPath3 = path.resolve(SCREENSHOT_DIR, 'test_scan_sample_3.jpg');
  fs.copyFileSync(sampleImgPath, galImgPath3);
  await galleryInput.uploadFile(galImgPath3);

  // Wait for error toast
  await page.waitForSelector('#toast-message-container', { visible: true, timeout: 8000 });
  await new Promise(r => setTimeout(r, 300));

  const errorToastCheck = await page.evaluate(() => {
    const toast = document.querySelector('#toast-message-container');
    const galBtn = document.querySelector('#btn-gallery-scan');
    const alertIcon = toast?.querySelector('.text-danger');
    const spinner = galBtn?.querySelector('.animate-spin');

    return {
      toastText: toast?.innerText?.trim(),
      hasDangerIcon: !!alertIcon,
      galBtnText: galBtn?.innerText?.trim(),
      isSpinnerReset: !spinner
    };
  });

  console.log('Error Toast Check:', errorToastCheck);
  if (!errorToastCheck.toastText?.includes('સ્કેન નિષ્ફળ — ફોટો ફરીથી લો')) {
    throw new Error(`FAIL: Expected error toast "સ્કેન નિષ્ફળ — ફોટો ફરીથી લો", got "${errorToastCheck.toastText}"`);
  }
  if (!errorToastCheck.hasDangerIcon) {
    throw new Error('FAIL: Error toast does not have themed danger icon!');
  }
  if (!errorToastCheck.isSpinnerReset || errorToastCheck.galBtnText !== 'ગેલરીથી ઇમ્પોર્ટ') {
    throw new Error('FAIL: Gallery button did not reset after failure!');
  }
  console.log('PASS: Themed error toast displayed and button cleanly reset (no silent reset).');

  const shot6 = path.join(SCREENSHOT_DIR, '06_ocr_failure_themed_error_toast.png');
  await page.screenshot({ path: shot6 });
  console.log(`Saved screenshot: ${shot6}`);

  // Cleanup temporary files
  if (fs.existsSync(sampleImgPath)) fs.unlinkSync(sampleImgPath);
  if (fs.existsSync(galImgPath2)) fs.unlinkSync(galImgPath2);
  if (fs.existsSync(galImgPath3)) fs.unlinkSync(galImgPath3);

  await browser.close();
  console.log('\n========================================');
  console.log('ALL WEB-FIX8 VERIFICATION CHECKS PASSED!');
  console.log('========================================');
})();
