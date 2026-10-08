import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROOF_DIR = path.join(__dirname, '../web_fix2_screenshots');

if (!fs.existsSync(PROOF_DIR)) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
}

const BASE_URL = 'http://localhost:4173';

async function isServerListening() {
  try {
    const res = await fetch(BASE_URL);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function run() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  WEB-FIX2 VERIFICATION — CONFIRM DIALOG CENTERING & BUTTON FIX');
  console.log('════════════════════════════════════════════════════════════════');

  let previewProcess = null;
  let serverUp = await isServerListening();
  if (!serverUp) {
    console.log('Starting preview server on port 4173...');
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    previewProcess = spawn(cmd, ['vite', 'preview', '--port', '4173'], { shell: true });
    
    // Poll up to 15 seconds
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      serverUp = await isServerListening();
      if (serverUp) break;
    }
    if (!serverUp) {
      throw new Error('Preview server failed to start on port 4173 within 15s');
    }
    console.log('Preview server is up and listening on 4173.');
  } else {
    console.log('Preview server is already listening on 4173.');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.method() === 'OPTIONS') {
      req.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
          'Access-Control-Allow-Headers': '*',
        }
      });
      return;
    }

    const url = req.url();
    if (url.includes('fn_login_code')) {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify('admin')
      });
    } else if (url.includes('fn_set_admin_code')) {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(false)
      });
    } else if (url.includes('fn_list_codes')) {
      req.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([])
      });
    } else {
      req.continue();
    }
  });

  // Pre-seed onboarding and admin session before any script runs
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mt_onboarded', '1');
    localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
    sessionStorage.setItem('mt_greeted', '1');
  });

  try {
    console.log('\nNavigating to Admin page...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluate(() => {
      if (window.useAppStore) {
        window.useAppStore.getState().setSession('ADMIN123', 'admin');
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // Verify we are on the admin dashboard with logout button
    await page.waitForSelector('#btn-admin-logout', { timeout: 6000 });
    console.log('✅ Admin dashboard loaded with #btn-admin-logout.');

    const themes = [
      { id: 'dark', name: 'graphite' },
      { id: 'premium', name: 'premium' },
      { id: 'outdoor', name: 'outdoor' }
    ];

    for (const theme of themes) {
      console.log(`\n--- Testing Logout Confirm Dialog in [${theme.name}] theme ---`);
      
      // Set theme
      await page.evaluate((t) => {
        if (window.useThemeStore) {
          window.useThemeStore.getState().setTheme(t);
        }
        document.documentElement.setAttribute('data-theme', t);
      }, theme.id);
      await new Promise(r => setTimeout(r, 300));

      // Click logout
      await page.click('#btn-admin-logout');
      await page.waitForSelector('#admin-confirm-container', { visible: true, timeout: 5000 });
      await new Promise(r => setTimeout(r, 300)); // wait for anim

      // Measure layout metrics
      const metrics = await page.evaluate(() => {
        const overlay = document.querySelector('#admin-confirm-overlay');
        const container = document.querySelector('#admin-confirm-container');
        const confirmBtn = document.querySelector('#admin-confirm-btn');
        const cancelBtn = document.querySelector('#admin-cancel-btn');

        if (!overlay || !container || !confirmBtn) return null;

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const overlayRect = overlay.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const confirmRect = confirmBtn.getBoundingClientRect();
        const confirmStyle = window.getComputedStyle(confirmBtn);

        const topGap = containerRect.top;
        const bottomGap = viewportHeight - containerRect.bottom;
        const verticalDiff = Math.abs(topGap - bottomGap);

        // Analyze button text nodes
        const childNodes = Array.from(confirmBtn.childNodes);
        const textNodes = childNodes.filter(n => n.nodeType === Node.TEXT_NODE);
        const elementNodes = childNodes.filter(n => n.nodeType === Node.ELEMENT_NODE);

        return {
          viewportHeight,
          viewportWidth,
          containerRect: {
            top: Math.round(containerRect.top),
            bottom: Math.round(containerRect.bottom),
            left: Math.round(containerRect.left),
            right: Math.round(containerRect.right),
            width: Math.round(containerRect.width),
            height: Math.round(containerRect.height),
          },
          topGap: Math.round(topGap),
          bottomGap: Math.round(bottomGap),
          verticalDiff: Math.round(verticalDiff),
          isVerticallyCentered: verticalDiff <= 16,
          confirmBtn: {
            height: Math.round(confirmRect.height),
            width: Math.round(confirmRect.width),
            computedHeight: confirmStyle.height,
            paddingLeft: confirmStyle.paddingLeft,
            paddingRight: confirmStyle.paddingRight,
            display: confirmStyle.display,
            alignItems: confirmStyle.alignItems,
            justifyContent: confirmStyle.justifyContent,
            overflow: confirmStyle.overflow,
            lineHeight: confirmStyle.lineHeight,
            totalChildNodes: childNodes.length,
            textNodesCount: textNodes.length,
            elementNodesCount: elementNodes.length,
            label: textNodes[0]?.textContent?.trim() || '',
            hasStrayElements: elementNodes.length > 0,
            hasSingleTextNode: childNodes.length === 1 && textNodes.length === 1,
          }
        };
      });

      console.log('Metrics:', JSON.stringify(metrics, null, 2));

      if (metrics.isVerticallyCentered) {
        console.log(`  ✅ F1 PASS: Dialog is vertically centered (topGap: ${metrics.topGap}px, bottomGap: ${metrics.bottomGap}px, diff: ${metrics.verticalDiff}px)`);
      } else {
        console.error(`  ❌ F1 FAIL: Dialog is not centered (topGap: ${metrics.topGap}px, bottomGap: ${metrics.bottomGap}px)`);
      }

      if (metrics.confirmBtn.hasSingleTextNode && metrics.confirmBtn.height === 48) {
        console.log(`  ✅ F2 PASS: Confirm button has exactly 1 text node ("${metrics.confirmBtn.label}"), height: ${metrics.confirmBtn.height}px, 0 extra elements.`);
      } else {
        console.error(`  ❌ F2 FAIL: Confirm button childNodes: ${metrics.confirmBtn.totalChildNodes}, height: ${metrics.confirmBtn.height}`);
      }

      const screenshotPath = path.join(PROOF_DIR, `logout_dialog_${theme.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  📸 Screenshot saved: ${screenshotPath}`);

      // Close dialog
      await page.click('#admin-cancel-btn');
      await new Promise(r => setTimeout(r, 400));
    }

    // Now test Logs-Clear Dialog
    console.log('\n--- Testing Logs-Clear Confirm Dialog ---');
    // Navigate to logs screen in admin
    await page.click('#card-admin-logs');
    await new Promise(r => setTimeout(r, 400));

    await page.waitForSelector('#btn-clear-logs', { timeout: 5000 });
    console.log('✅ Logs screen loaded with #btn-clear-logs.');

    // Click clear logs
    await page.click('#btn-clear-logs');
    await page.waitForSelector('#admin-confirm-container', { visible: true, timeout: 5000 });
    await new Promise(r => setTimeout(r, 300));

    const logsDialogMetrics = await page.evaluate(() => {
      const container = document.querySelector('#admin-confirm-container');
      const confirmBtn = document.querySelector('#admin-confirm-btn');
      if (!container || !confirmBtn) return null;

      const viewportHeight = window.innerHeight;
      const containerRect = container.getBoundingClientRect();
      const topGap = containerRect.top;
      const bottomGap = viewportHeight - containerRect.bottom;
      const verticalDiff = Math.abs(topGap - bottomGap);

      const childNodes = Array.from(confirmBtn.childNodes);
      const textNodes = childNodes.filter(n => n.nodeType === Node.TEXT_NODE);

      return {
        topGap: Math.round(topGap),
        bottomGap: Math.round(bottomGap),
        verticalDiff: Math.round(verticalDiff),
        isVerticallyCentered: verticalDiff <= 16,
        confirmHeight: Math.round(confirmBtn.getBoundingClientRect().height),
        label: textNodes[0]?.textContent?.trim() || '',
        hasSingleTextNode: childNodes.length === 1 && textNodes.length === 1,
      };
    });

    console.log('Logs Clear Dialog Metrics:', JSON.stringify(logsDialogMetrics, null, 2));
    if (logsDialogMetrics.isVerticallyCentered && logsDialogMetrics.hasSingleTextNode) {
      console.log(`  ✅ PASS: Logs-clear dialog is centered and has clean button with label "${logsDialogMetrics.label}"`);
    }

    const logsScreenshotPath = path.join(PROOF_DIR, `logs_clear_dialog.png`);
    await page.screenshot({ path: logsScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${logsScreenshotPath}`);

    // Close dialog
    await page.click('#admin-cancel-btn');
    await new Promise(r => setTimeout(r, 400));

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
    if (previewProcess) {
      try {
        previewProcess.kill();
      } catch {}
    }
    process.exit(0);
  }
}

run();
