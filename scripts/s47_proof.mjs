import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'C:/Users/DELL/.gemini/antigravity-ide/brain/b8e821af-fc57-432a-9b4b-d6fc917731b0';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 's47_proof_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runS47Proof() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  S47 HELP PAGE EMAIL VISIBILITY PROOF SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const suiteResults = {
    timestamp: new Date().toISOString(),
    tests: [],
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

    // Set initial session & onboarding
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('mt_onboarded', '1');
      sessionStorage.setItem('mt_greeted', '1');
    });

    const themes = ['dark', 'outdoor', 'premium'];
    const viewports = [
      { name: '360px', width: 360, height: 800 },
      { name: '768px', width: 768, height: 800 },
      { name: '1280px', width: 1280, height: 800 }
    ];

    const EXPECTED_EMAIL = 'banaskantha.mehnat.support@gmail.com';

    for (const theme of themes) {
      for (const vp of viewports) {
        console.log(`\n─────────────────────────────────────────────────────────────`);
        console.log(`THEME: ${theme} | VIEWPORT: ${vp.name}`);
        console.log(`─────────────────────────────────────────────────────────────`);

        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/help`, { waitUntil: 'networkidle0' });
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          localStorage.setItem('theme', t);
          document.documentElement.classList.remove('theme-switching');
        }, theme);

        await new Promise(r => setTimeout(r, 400));

        const cardData = await page.evaluate((expectedEmail) => {
          const anchor = document.querySelector('a[href^="mailto:"]');
          const emailP = anchor ? anchor.querySelector('.help-email-text, p.font-num') : null;
          const textCol = emailP ? emailP.parentElement : null;
          const iconDisc = anchor ? anchor.querySelector('.rounded-full') : null;
          const cardEl = anchor ? anchor.querySelector('.p-4') : null;

          const pStyle = emailP ? window.getComputedStyle(emailP) : null;
          const colStyle = textCol ? window.getComputedStyle(textCol) : null;

          return {
            hasAnchor: !!anchor,
            href: anchor?.getAttribute('href'),
            emailText: emailP?.textContent?.trim(),
            textExactMatch: emailP?.textContent?.trim() === expectedEmail,
            scrollWidth: emailP?.scrollWidth,
            clientWidth: emailP?.clientWidth,
            scrollHeight: emailP?.scrollHeight,
            clientHeight: emailP?.clientHeight,
            fontSize: pStyle ? parseFloat(pStyle.fontSize) : 0,
            overflowWrap: pStyle?.overflowWrap,
            wordBreak: pStyle?.wordBreak,
            textColMinWidth: colStyle?.minWidth,
            hasIconDisc: !!iconDisc,
            cardWidth: cardEl?.clientWidth
          };
        }, EXPECTED_EMAIL);

        // 1. Working mailto: link verbatim
        assert(
          `[${theme} @ ${vp.name}] Anchor has verbatim mailto: href`,
          cardData.href === `mailto:${EXPECTED_EMAIL}`,
          { href: cardData.href }
        );

        // 2. Email string byte-identical
        assert(
          `[${theme} @ ${vp.name}] Email text is byte-identical`,
          cardData.textExactMatch,
          { text: cardData.emailText }
        );

        // 3. Text column has min-width 0
        assert(
          `[${theme} @ ${vp.name}] Text column has min-width: 0px`,
          cardData.textColMinWidth === '0px',
          { minWidth: cardData.textColMinWidth }
        );

        // 4. Zero clipping: scrollWidth <= clientWidth
        assert(
          `[${theme} @ ${vp.name}] Zero clipping: scrollWidth (${cardData.scrollWidth}px) <= clientWidth (${cardData.clientWidth}px)`,
          cardData.scrollWidth <= cardData.clientWidth,
          { scrollWidth: cardData.scrollWidth, clientWidth: cardData.clientWidth }
        );

        // 5. Overflow-wrap / word-break configured
        assert(
          `[${theme} @ ${vp.name}] overflow-wrap is anywhere or word-break break-all`,
          cardData.overflowWrap === 'anywhere' || cardData.wordBreak === 'break-all',
          { overflowWrap: cardData.overflowWrap, wordBreak: cardData.wordBreak }
        );

        // 6. Font size: 14sp mobile (360px), 16sp desktop/tablet (768px / 1280px)
        const expectedFontSize = vp.name === '360px' ? 14 : 16;
        assert(
          `[${theme} @ ${vp.name}] Font size matches expected ${expectedFontSize}px (actual: ${cardData.fontSize}px)`,
          Math.abs(cardData.fontSize - expectedFontSize) <= 1,
          { fontSize: cardData.fontSize, expected: expectedFontSize }
        );

        // 7. Screenshots at 360px for all three themes (graphite/dark, outdoor, premium)
        if (vp.name === '360px') {
          const cardEl = await page.$('a[href^="mailto:"]');
          const shotName = `s47_proof_email_${theme}_360px.png`;
          const shotPath = path.join(SCREENSHOT_DIR, shotName);
          if (cardEl) {
            await cardEl.screenshot({ path: shotPath });
            // Also copy to artifact root for easy linking
            fs.copyFileSync(shotPath, path.join(ARTIFACT_DIR, shotName));
            if (theme === 'dark') {
              fs.copyFileSync(shotPath, path.join(ARTIFACT_DIR, 'after_email_support_dark_360px.png'));
            }
            suiteResults.screenshots.push({ name: shotName, theme, path: shotPath });
            console.log(`📸 Saved screenshot: ${shotName}`);
          }
        }
      }
    }

    // Regression check: verify clicking or focusing mailto link triggers hover underline decoration
    console.log(`\n─────────────────────────────────────────────────────────────`);
    console.log(`REGRESSION CHECK: Hover / Focus underline on mailto link`);
    console.log(`─────────────────────────────────────────────────────────────`);

    await page.setViewport({ width: 360, height: 800 });
    await page.goto(`${BASE_URL}/help`, { waitUntil: 'networkidle0' });
    await page.hover('a[href^="mailto:"]');
    await new Promise(r => setTimeout(r, 200));

    const hoverStyle = await page.evaluate(() => {
      const emailP = document.querySelector('.help-email-text');
      const style = window.getComputedStyle(emailP);
      return {
        textDecorationLine: style.textDecorationLine,
        textDecorationColor: style.textDecorationColor
      };
    });

    assert(
      `Hover state produces underline decoration`,
      hoverStyle.textDecorationLine.includes('underline'),
      hoverStyle
    );

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  ALL ${suiteResults.tests.length} S47 ASSERTIONS PASSED WITH ZERO ERRORS!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 's47_proof_summary.json'),
      JSON.stringify(suiteResults, null, 2)
    );

  } catch (err) {
    console.error('Test suite failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runS47Proof();
