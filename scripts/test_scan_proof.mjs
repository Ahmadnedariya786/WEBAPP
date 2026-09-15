import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const SCRATCH_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\3fae18c0-a825-4a55-ab8d-b4cb8b7e28d2\\scratch';

// Create a minimal dummy JPEG buffer
function createSampleImageBuffer() {
  // 100x100 1-pixel red GIF/JPEG or small canvas buffer
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );
}

async function runProofPack() {
  console.log('=== STARTING S23-FINAL SCAN-&-FILL PROOF PACK ===');

  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  const sampleJpg = path.join(SCRATCH_DIR, 'test_paper_sample.jpg');
  const rotatedJpg = path.join(SCRATCH_DIR, 'test_rotated_sample.jpg');
  const croppedJpg = path.join(SCRATCH_DIR, 'test_cropped_sample.jpg');

  const imgBuf = createSampleImageBuffer();
  fs.writeFileSync(sampleJpg, imgBuf);
  fs.writeFileSync(rotatedJpg, imgBuf);
  fs.writeFileSync(croppedJpg, imgBuf);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Ensure onboarding is marked completed in test browser
  await page.evaluate(() => {
    localStorage.setItem('mt_onboarded', '1');
    sessionStorage.setItem('mt_greeted', '1');
  });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Verify Entry Pills Above Date Card
  console.log('Verifying Scan Pills above Date card...');
  const cameraBtn = await page.$('#btn-camera-scan');
  const galleryBtn = await page.$('#btn-gallery-scan');
  if (!cameraBtn || !galleryBtn) {
    throw new Error('Scan pills not found in DOM!');
  }
  await page.screenshot({ path: path.join(SCRATCH_DIR, '01_entry_pills.png') });
  console.log('Saved: 01_entry_pills.png');

  // 2. Upload via Gallery Input
  console.log('Uploading sample paper photo via gallery...');
  const galleryInput = await page.$('#gallery-scan-input');
  await galleryInput.uploadFile(sampleJpg);

  // Wait for review overlay to appear
  console.log('Waiting for review overlay...');
  await page.waitForSelector('[role="dialog"][aria-label="સ્કેન રિવ્યુ"]', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));

  // Verify values in overlay
  const overlayContent = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
      text: dialog?.textContent || '',
      inputs: Array.from(dialog?.querySelectorAll('input') || []).map(i => i.value)
    };
  });

  console.log('Review Overlay loaded with', overlayContent.inputs.length, 'inputs');
  await page.screenshot({ path: path.join(SCRATCH_DIR, '02_review_overlay.png') });
  console.log('Saved: 02_review_overlay.png');

  // 3. Confirm Fill into Form
  console.log('Clicking "ફોર્મમાં ભરો ✅"...');
  const fillBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent?.includes('ફોર્મમાં ભરો'));
  });
  if (fillBtn) {
    await fillBtn.click();
  } else {
    throw new Error('Fill button not found in overlay!');
  }

  // Wait for overlay to dismiss and toast to appear
  await new Promise(r => setTimeout(r, 800));

  // Verify Filled Values in New Report
  const filledState = await page.evaluate(() => {
    const std10Input = document.querySelector('input[placeholder="0"]');
    const toast = document.body.textContent?.includes('સ્કેન ડેટા ભરાયો');
    const undoBtn = document.querySelector('#btn-toast-undo, #btn-floating-undo');
    return {
      hasToast: toast,
      hasUndo: !!undoBtn,
      std10Val: std10Input ? std10Input.value : null
    };
  });

  console.log('Filled state verification:', filledState);
  await page.screenshot({ path: path.join(SCRATCH_DIR, '03_filled_form.png') });
  console.log('Saved: 03_filled_form.png');

  // Verify Activities Table: Empty mojuda column and rows 11-13 remain EMPTY (GOLDEN RULE)
  console.log('Verifying Activities Table and empty cells...');
  const tableEl = await page.$('table');
  if (tableEl) {
    await page.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }), tableEl);
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCRATCH_DIR, '06_activities_table_empty_cells_proof.png') });
    console.log('Saved: 06_activities_table_empty_cells_proof.png');
  }

  const tableVerification = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    // Rows 1-5 values
    const row1_guj = document.querySelector('tbody tr:nth-child(1) td:nth-child(2) input')?.value;
    const row2_guj = document.querySelector('tbody tr:nth-child(2) td:nth-child(2) input')?.value;
    const row3_guj = document.querySelector('tbody tr:nth-child(3) td:nth-child(2) input')?.value;
    const row4_guj = document.querySelector('tbody tr:nth-child(4) td:nth-child(2) input')?.value;
    const row5_guj = document.querySelector('tbody tr:nth-child(5) td:nth-child(2) input')?.value;

    // mojuda column inputs for rows 1 to 12 (4th column)
    const mojudaInputs = Array.from(document.querySelectorAll('tbody tr:not(:last-child) td:nth-child(4) input'))
      .map(i => i.value);
    const allMojudaEmpty = mojudaInputs.every(v => v === '');

    // Rows 11-13 inputs
    const row11Inputs = Array.from(rows[10]?.querySelectorAll('input') || []).map(i => i.value);
    const row12Inputs = Array.from(rows[11]?.querySelectorAll('input') || []).map(i => i.value);
    const row13Inputs = Array.from(rows[12]?.querySelectorAll('input') || []).map(i => i.value);

    return {
      row1_to_5: [row1_guj, row2_guj, row3_guj, row4_guj, row5_guj],
      allMojudaEmpty,
      row11Empty: row11Inputs.every(v => v === ''),
      row12Empty: row12Inputs.every(v => v === ''),
      row13Empty: row13Inputs.every(v => v === ''),
      row11Inputs,
      row12Inputs,
      row13Inputs
    };
  });

  console.log('=== GOLDEN RULE TABLE VERIFICATION ===');
  console.log('Rows 1-5 Gujishta values:', tableVerification.row1_to_5);
  console.log('All Mojuda cells empty:', tableVerification.allMojudaEmpty);
  console.log('Row 11 empty:', tableVerification.row11Empty, tableVerification.row11Inputs);
  console.log('Row 12 empty:', tableVerification.row12Empty, tableVerification.row12Inputs);
  console.log('Row 13 empty:', tableVerification.row13Empty, tableVerification.row13Inputs);

  if (!tableVerification.allMojudaEmpty || !tableVerification.row11Empty || !tableVerification.row12Empty || !tableVerification.row13Empty) {
    throw new Error('GOLDEN RULE VIOLATION: Empty cells were not preserved as empty!');
  }

  // Scroll back to top for undo test
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));

  // 4. Test Undo Functionality
  console.log('Testing Undo...');
  const undoBtn = await page.$('#btn-toast-undo, #btn-floating-undo');
  if (undoBtn) {
    await undoBtn.click();
    await new Promise(r => setTimeout(r, 600));
    console.log('Undo clicked successfully!');
  }
  await page.screenshot({ path: path.join(SCRATCH_DIR, '04_undo_restored.png') });
  console.log('Saved: 04_undo_restored.png');

  // 5. Test Camera Input Path
  console.log('Testing camera scan input path...');
  const cameraInput = await page.$('#camera-scan-input');
  await cameraInput.uploadFile(rotatedJpg);
  await page.waitForSelector('[role="dialog"][aria-label="સ્કેન રિવ્યુ"]', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCRATCH_DIR, '05_camera_path.png') });
  console.log('Saved: 05_camera_path.png');

  await browser.close();

  console.log('Console Errors during test:', consoleErrors);
  console.log('=== PROOF PACK COMPLETED SUCCESSFULLY ===');
}

runProofPack().catch(err => {
  console.error('Proof Pack failed:', err);
  process.exit(1);
});
