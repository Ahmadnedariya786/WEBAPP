import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939/s36_proof_screenshots';
const RESULTS_FILE = 'C:/Users/DELL/.gemini/antigravity-ide/brain/972e17f8-da5d-4036-ba6d-4c1cb9acb939/s36_proof_results.json';
const BASE_URL = 'http://127.0.0.1:4173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runProof() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    commitHash: 'b06666d',
    tests: [],
    screenshots: []
  };

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setViewport({ width: 360, height: 740 });

    // Ensure onboarding is complete
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });
    await page.reload({ waitUntil: 'networkidle0' });

    const themes = ['outdoor', 'dark', 'premium'];
    const routes = [
      { path: '/dashboard', slot: 0, name: 'dashboard', expectedLabel: 'ડેશબોર્ડ' },
      { path: '/', slot: 1, name: 'new_report', expectedLabel: 'નવો રિપોર્ટ' },
      { path: '/past-reports', slot: 2, name: 'past_reports', expectedLabel: 'પાછલા રિપોર્ટ્સ' }
    ];

    for (const theme of themes) {
      console.log(`Testing theme: ${theme}`);

      // 1. Capture all three active states (slots 0, 1, 2)
      for (const route of routes) {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0' });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('theme', t);
          document.documentElement.classList.remove('theme-switching');
        }, theme);
        await new Promise(r => setTimeout(r, 450)); // Allow 400ms transition to settle

        const metrics = await page.evaluate((expectedSlot) => {
          const root = document.querySelector('.bottom-nav-root');
          const circle = document.querySelector('.bottom-nav-circle');
          const bar = document.querySelector('.bottom-nav-bar');
          const slots = Array.from(document.querySelectorAll('.bottom-nav-slot'));
          const activeSlot = document.querySelector('.bottom-nav-slot-active');
          const activeLabel = activeSlot?.querySelector('.bottom-nav-slot-label')?.textContent?.trim();

          if (!root || !circle || !bar) return null;

          const rootRect = root.getBoundingClientRect();
          const circleRect = circle.getBoundingClientRect();
          const barRect = bar.getBoundingClientRect();

          // Horizontal center of circle relative to root
          const circleCenterX = circleRect.left - rootRect.left + circleRect.width / 2;

          return {
            rootWidth: rootRect.width,
            circleWidth: circleRect.width,
            circleHeight: circleRect.height,
            circleTop: circleRect.top,
            barTop: barRect.top,
            // Should be 0: center of circle is at bar's top edge
            circleCenterOffsetFromBarTop: (circleRect.top + circleRect.height / 2) - barRect.top,
            circleCenterX,
            activeSlotIndex: slots.indexOf(activeSlot),
            activeLabel,
            slotsCount: slots.length,
            hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
          };
        }, route.slot);

        const screenshotName = `s36_${theme}_slot${route.slot}_${route.name}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
        await page.screenshot({ path: screenshotPath });

        results.screenshots.push({
          name: screenshotName,
          theme,
          route: route.path,
          slot: route.slot,
          metrics
        });
        console.log(`Captured ${screenshotName}`);
      }

      // 2. Capture mid-slide frame proving the spring transition
      // Navigate from slot 0 to slot 2, capturing at ~160ms
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      }, theme);
      await new Promise(r => setTimeout(r, 450));

      // Click slot 2 (Past Reports)
      const pastBtn = await page.$('.bottom-nav-slot:last-of-type');
      await pastBtn?.click();

      // Wait ~120ms into the 400ms transition
      await new Promise(r => setTimeout(r, 120));

      const midSlideMetrics = await page.evaluate(() => {
        const root = document.querySelector('.bottom-nav-root');
        const circle = document.querySelector('.bottom-nav-circle');
        if (!root || !circle) return null;
        const rootRect = root.getBoundingClientRect();
        const circleRect = circle.getBoundingClientRect();
        const transform = window.getComputedStyle(circle).transform;
        const match = transform.match(/matrix\(([^)]+)\)/);
        let midCenterX = circleRect.left - rootRect.left + circleRect.width / 2;
        if (match) {
          const parts = match[1].split(',').map(s => parseFloat(s.trim()));
          if (parts.length >= 6 && !isNaN(parts[4])) {
            midCenterX = parts[4] + circleRect.width / 2;
          }
        }
        return {
          midCenterX,
          transform,
          rootWidth: rootRect.width
        };
      });

      const midSlideName = `s36_${theme}_midslide_transition.png`;
      const midSlidePath = path.join(SCREENSHOT_DIR, midSlideName);
      await page.screenshot({ path: midSlidePath });

      results.screenshots.push({
        name: midSlideName,
        type: 'mid_slide',
        theme,
        metrics: midSlideMetrics
      });
      console.log(`Captured mid-slide frame: ${midSlideName}`);
    }

    // 3. Automated Regression Tests
    console.log('Running automated regression tests...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 450));

    // Test A: Initial route is /dashboard and circle is on slot 0
    let state = await page.evaluate(() => {
      const activeSlot = document.querySelector('.bottom-nav-slot-active');
      const slots = Array.from(document.querySelectorAll('.bottom-nav-slot'));
      return {
        path: window.location.pathname,
        slotIndex: slots.indexOf(activeSlot)
      };
    });
    results.tests.push({
      name: 'Initial route is /dashboard with circle at Slot 0',
      passed: state.path === '/dashboard' && state.slotIndex === 0
    });

    // Test B: Click Past Reports -> circle slides to Slot 2
    const pastBtn = await page.$('.bottom-nav-slot:last-of-type');
    await pastBtn?.click();
    await new Promise(r => setTimeout(r, 500));
    state = await page.evaluate(() => {
      const activeSlot = document.querySelector('.bottom-nav-slot-active');
      const slots = Array.from(document.querySelectorAll('.bottom-nav-slot'));
      return {
        path: window.location.pathname,
        slotIndex: slots.indexOf(activeSlot)
      };
    });
    results.tests.push({
      name: 'Clicking Past Reports slides circle to Slot 2 and navigates to /past-reports',
      passed: state.path === '/past-reports' && state.slotIndex === 2
    });

    // Test C: Click Center Slot (New Report) -> circle slides to Slot 1
    const centerBtn = await page.$('.bottom-nav-slot:nth-of-type(2)');
    await centerBtn?.click();
    await new Promise(r => setTimeout(r, 500));
    state = await page.evaluate(() => {
      const activeSlot = document.querySelector('.bottom-nav-slot-active');
      const slots = Array.from(document.querySelectorAll('.bottom-nav-slot'));
      return {
        path: window.location.pathname,
        slotIndex: slots.indexOf(activeSlot)
      };
    });
    results.tests.push({
      name: 'Clicking Center Slot slides circle to Slot 1 and navigates to /',
      passed: state.path === '/' && state.slotIndex === 1
    });

    // Test D: Click Dashboard -> circle slides back to Slot 0
    const dashBtn = await page.$('.bottom-nav-slot:first-of-type');
    await dashBtn?.click();
    await new Promise(r => setTimeout(r, 500));
    state = await page.evaluate(() => {
      const activeSlot = document.querySelector('.bottom-nav-slot-active');
      const slots = Array.from(document.querySelectorAll('.bottom-nav-slot'));
      return {
        path: window.location.pathname,
        slotIndex: slots.indexOf(activeSlot)
      };
    });
    results.tests.push({
      name: 'Clicking Dashboard slides circle back to Slot 0 and navigates to /dashboard',
      passed: state.path === '/dashboard' && state.slotIndex === 0
    });

    // Write results JSON
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log('Proof results saved successfully to:', RESULTS_FILE);

  } catch (err) {
    console.error('Error during proof execution:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runProof();
