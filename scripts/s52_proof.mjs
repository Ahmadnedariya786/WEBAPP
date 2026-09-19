import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROOF_DIR = path.join(__dirname, '../s52_proof');

if (!fs.existsSync(PROOF_DIR)) {
  fs.mkdirSync(PROOF_DIR);
}

const runCmd = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

// Start Vite server
console.log('Starting preview server...');
runCmd('npm run build');

let server;
const isWindows = process.platform === 'win32';
const spawnOptions = isWindows ? { shell: true } : { detached: true };

server = import('child_process').then(cp => {
  const child = cp.spawn('npm', ['run', 'preview', '--', '--port', '4173'], spawnOptions);
  return child;
});

// Wait for server to be ready
await new Promise(resolve => setTimeout(resolve, 3000));

try {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });

  // 1. D1: Settings Spacing & Pill grid
  console.log('\n--- Checking Settings Spacing ---');
  await page.goto('http://localhost:4173');
  await new Promise(r => setTimeout(r, 500));
  
  // Click through onboarding
  await page.evaluate(() => window.__setTheme('outdoor'));
  
  for (let i = 0; i < 3; i++) {
    const btn = await page.$('button');
    if (btn) await btn.click();
    await new Promise(r => setTimeout(r, 400));
  }
  
  // Now we should be on NewReport. Let's go to settings
  await page.goto('http://localhost:4173/settings');
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: path.join(PROOF_DIR, 'settings_outdoor.png') });
  
  const themeCardEval = await page.evaluate(() => {
    // We look for the "થીમ" text to find the card
    const card = Array.from(document.querySelectorAll('.glass-panel')).find(c => c.textContent.includes('થીમ'));
    if (!card) return null;
    const computedStyle = window.getComputedStyle(card);
    
    const pills = card.querySelectorAll('button');
    const pillsInfo = Array.from(pills).map(p => ({
      text: p.textContent,
      minHeight: window.getComputedStyle(p).minHeight,
      height: p.getBoundingClientRect().height
    }));

    return {
      padding: computedStyle.padding,
      pills: pillsInfo
    };
  });
  
  console.log('Theme Card Layout:', themeCardEval);
  if (themeCardEval.padding !== '20px') throw new Error('Padding is not 20px!');
  if (!themeCardEval.pills.every(p => p.height >= 48)) throw new Error('Pills are not min 48px height!');
  
  // Screenshots of other themes
  await page.evaluate(() => window.__setTheme('dark'));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(PROOF_DIR, 'settings_dark.png') });

  await page.evaluate(() => window.__setTheme('premium'));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(PROOF_DIR, 'settings_premium.png') });

  // 2. D2: Halqa Double-Plus Fix
  console.log('\n--- Checking Halqa Button Text ---');
  await page.goto('http://localhost:4173');
  await page.waitForSelector('button[aria-label="+ હલકો ઉમેરો"]', { timeout: 5000 });
  
  // We are already on NewReport page because '/' routes there
  const halqaBtnEval = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="+ હલકો ઉમેરો"]');
    if (!btn) return null;
    return btn.textContent.trim();
  });
  console.log('Halqa Add Button textContent:', halqaBtnEval);
  if (halqaBtnEval !== '+ હલકો ઉમેરો') throw new Error(`Halqa Add button text is incorrect: "${halqaBtnEval}"`);

  await browser.close();

  // 3. D3: XML validation
  console.log('\n--- Checking themes.xml ---');
  const themesXml = fs.readFileSync(path.join(__dirname, '../android/app/src/main/res/values/themes.xml'), 'utf8');
  if (!themesXml.includes('<item name="android:windowSplashScreenBackground">#20242B</item>')) {
    throw new Error('themes.xml missing splash screen background color');
  } else {
    console.log('themes.xml OK');
  }

  console.log('\n--- Checking create_android.cjs template sync ---');
  const createAndroidCjs = fs.readFileSync(path.join(__dirname, '../create_android.cjs'), 'utf8');
  if (!createAndroidCjs.includes('<item name="android:windowSplashScreenBackground">#20242B</item>')) {
    throw new Error('create_android.cjs missing splash screen background color in themes.xml template');
  } else {
    console.log('create_android.cjs template OK');
  }

  console.log('\n=== ALL PROOFS PASSED ===');

} catch (e) {
  console.error('\n❌ PROOF FAILED:', e.message);
  process.exit(1);
} finally {
  server.then(cp => {
    if (isWindows) {
      execSync('taskkill /pid ' + cp.pid + ' /T /F');
    } else {
      process.kill(-cp.pid);
    }
  });
}
