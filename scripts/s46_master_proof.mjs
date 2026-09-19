import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/b8e821af-fc57-432a-9b4b-d6fc917731b0';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's46_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runS46MasterProof() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  S46-REV2 PAGE HEADING GLYPH CLIPPING FIX MASTER PROOF SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const suiteResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    pages: [],
    screenshots: []
  };

  function assert(name, condition, details = {}) {
    suiteResults.tests.push({ name, passed: !!condition, details });
    const mark = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${name}`, details);
    if (!condition) {
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

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

    // Initial auth & onboarding setup
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
      localStorage.setItem('mt_session', JSON.stringify({ code: 'ADMIN123', role: 'admin' }));
      if (window.useAppStore) {
        window.useAppStore.getState().setSession('ADMIN123', 'admin');
      }
    });

    const pagesToTest = [
      { name: 'નવો રિપોર્ટ', route: '/new-report', expectedTitle: 'નવો રિપોર્ટ' },
      { name: 'ડેશબોર્ડ', route: '/dashboard', expectedTitle: 'ડેશબોર્ડ' },
      { name: 'પાછલા રિપોર્ટ્સ', route: '/past-reports', expectedTitle: 'પાછલા રિપોર્ટ્સ' },
      { name: 'સેટિંગ્સ', route: '/settings', expectedTitle: 'સેટિંગ્સ' },
      { name: 'એડમિન પેનલ', route: '/admin', expectedTitle: 'એડમિન પેનલ' },
      { name: 'યુઝર્સ મેનેજ કરો', route: '/admin', screen: 'users', cardText: 'પાસવર્ડ મેનેજ', expectedTitle: 'યુઝર્સ મેનેજ કરો' },
      { name: 'હલકા સંચાલન', route: '/admin', screen: 'halqas', cardText: 'હલકા સંચાલન', expectedTitle: 'હલકા સંચાલન' },
      { name: 'સિસ્ટમ લૉગ્સ', route: '/admin', screen: 'logs', cardText: 'સિસ્ટમ લૉગ્સ', expectedTitle: 'સિસ્ટમ લૉગ્સ' },
      { name: 'મદદ', route: '/help', expectedTitle: 'મદદ અને સપોર્ટ' }
    ];

    const themes = ['outdoor', 'dark', 'premium'];
    const viewports = [
      { name: '360px', width: 360, height: 800 },
      { name: '1280px', width: 1280, height: 800 }
    ];

    for (const p of pagesToTest) {
      console.log(`\n─────────────────────────────────────────────────────────────`);
      console.log(`PAGE: ${p.name} (${p.route}${p.screen ? ` [screen: ${p.screen}]` : ''})`);
      console.log(`─────────────────────────────────────────────────────────────`);

      for (const theme of themes) {
        for (const vp of viewports) {
          await page.setViewport({ width: vp.width, height: vp.height });
          await page.goto(`${BASE_URL}${p.route}`, { waitUntil: 'networkidle0' });
          await page.evaluate((t, cardText) => {
            document.documentElement.setAttribute('data-theme', t);
            localStorage.setItem('theme', t);
            document.documentElement.classList.remove('theme-switching');

            if (window.useAppStore && !window.useAppStore.getState().sessionRole) {
              window.useAppStore.getState().setSession('ADMIN123', 'admin');
            }

            if (cardText) {
              const cards = Array.from(document.querySelectorAll('.cursor-pointer'));
              const c = cards.find(el => el.textContent.includes(cardText));
              c?.click();
            }
          }, theme, p.cardText);

          // Wait for render / transition
          await new Promise(r => setTimeout(r, 450));

          const data = await page.evaluate(() => {
            const header = document.querySelector('.app-header');
            const container = document.querySelector('.page-heading-container');
            const title = document.querySelector('.page-heading-title');

            const cStyle = container ? window.getComputedStyle(container) : null;
            const tStyle = title ? window.getComputedStyle(title) : null;

            const hRect = header ? header.getBoundingClientRect() : null;
            const tRect = title ? title.getBoundingClientRect() : null;

            const fontSize = tStyle ? parseFloat(tStyle.fontSize) : 0;
            const lineHeight = tStyle ? parseFloat(tStyle.lineHeight) : 0;
            const paddingTop = cStyle ? parseFloat(cStyle.paddingTop) : 0;

            return {
              hasContainer: !!container,
              hasTitle: !!title,
              titleText: title?.textContent?.trim(),
              fontSize,
              lineHeight,
              lineHeightRatio: fontSize > 0 ? (lineHeight / fontSize) : 0,
              paddingTop,
              containerOverflow: cStyle?.overflow,
              titleOverflow: tStyle?.overflow,
              scrollHeight: title?.scrollHeight,
              clientHeight: title?.clientHeight,
              headerBottom: hRect?.bottom,
              titleTop: tRect?.top
            };
          });

          // Verify container & title exist and match expected
          assert(
            `[${p.name} | ${theme} @ ${vp.name}] Heading matches "${p.expectedTitle}" (found "${data.titleText}")`,
            data.hasContainer && data.hasTitle && data.titleText === p.expectedTitle,
            { expected: p.expectedTitle, actual: data.titleText }
          );

          // 1. Title computed line-height >= 1.3 * font-size
          assert(
            `[${p.name} | ${theme} @ ${vp.name}] line-height >= 1.3 * fontSize (ratio: ${data.lineHeightRatio.toFixed(2)})`,
            data.lineHeight >= 1.3 * data.fontSize,
            { lineHeight: data.lineHeight, fontSize: data.fontSize, ratio: data.lineHeightRatio }
          );

          // 2. Heading container padding-top >= 8px and overflow === 'visible'
          assert(
            `[${p.name} | ${theme} @ ${vp.name}] container paddingTop >= 8px (${data.paddingTop}px) & overflow === 'visible'`,
            data.paddingTop >= 8 && data.containerOverflow === 'visible',
            { paddingTop: data.paddingTop, overflow: data.containerOverflow }
          );

          // 3. Title element scrollHeight === clientHeight (no clip)
          assert(
            `[${p.name} | ${theme} @ ${vp.name}] scrollHeight === clientHeight (${data.scrollHeight} === ${data.clientHeight})`,
            data.scrollHeight === data.clientHeight,
            { scrollHeight: data.scrollHeight, clientHeight: data.clientHeight }
          );

          // 4. Title boundingRect.top >= app-header bottom edge (never tucked under header)
          assert(
            `[${p.name} | ${theme} @ ${vp.name}] titleTop >= headerBottom (${data.titleTop?.toFixed(1)} >= ${data.headerBottom?.toFixed(1)})`,
            data.titleTop >= (data.headerBottom - 0.5),
            { titleTop: data.titleTop, headerBottom: data.headerBottom }
          );

          // Take screenshots for critical proof targets:
          // "screenshots: નવો રિપોર્ટ + સેટિંગ્સ headings in outdoor AND graphite at 360px showing FULL uncut matras"
          if (
            (p.name === 'નવો રિપોર્ટ' || p.name === 'સેટિંગ્સ') &&
            (theme === 'outdoor' || theme === 'dark') &&
            vp.name === '360px'
          ) {
            const headingEl = await page.$('.page-heading-container');
            const shotName = `s46_proof_${p.name === 'નવો રિપોર્ટ' ? 'new_report' : 'settings'}_${theme}_360px.png`;
            if (headingEl) {
              await headingEl.screenshot({ path: path.join(SCREENSHOT_DIR, shotName) });
              suiteResults.screenshots.push({ name: shotName, page: p.name, theme });
              console.log(`📸 Saved proof screenshot: ${shotName}`);
            }
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  ALL ${suiteResults.tests.length} S46 ASSERTIONS PASSED WITH ZERO ERRORS!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 's46_master_summary.json'),
      JSON.stringify(suiteResults, null, 2)
    );

  } catch (err) {
    console.error('Test suite failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runS46MasterProof();
