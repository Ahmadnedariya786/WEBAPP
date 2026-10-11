import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

/**
 * F2. Node-side Pre-Seed:
 * Before launching any browser in verify scripts, check with fs that both lang files
 * exist locally in public/tesseract/lang-data/; if missing, download them using Node fetch
 * (not the browser) and save them into public/tesseract/lang-data/.
 */
export async function preseedTesseractLangData() {
  const langDir = path.resolve(process.cwd(), 'public/tesseract/lang-data');
  if (!fs.existsSync(langDir)) {
    fs.mkdirSync(langDir, { recursive: true });
  }

  const langFiles = [
    {
      name: 'eng.traineddata.gz',
      uncompressedName: 'eng.traineddata',
      url: 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/eng.traineddata.gz'
    },
    {
      name: 'guj.traineddata.gz',
      uncompressedName: 'guj.traineddata',
      url: 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/guj.traineddata.gz'
    }
  ];

  for (const item of langFiles) {
    const gzPath = path.join(langDir, item.name);
    const rawPath = path.join(langDir, item.uncompressedName);

    // 1. Ensure .traineddata.gz exists
    if (!fs.existsSync(gzPath) || fs.statSync(gzPath).size < 1000) {
      console.log(`[Pre-seed] Downloading missing language asset via Node fetch: ${item.name}...`);
      const resp = await fetch(item.url);
      if (!resp.ok) {
        throw new Error(`Failed to download ${item.name} from ${item.url}: ${resp.status} ${resp.statusText}`);
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(gzPath, buffer);
      console.log(`[Pre-seed] Saved ${item.name} (${buffer.length} bytes) to ${gzPath}`);
    } else {
      console.log(`[Pre-seed] Verified local lang file exists: ${item.name} (${fs.statSync(gzPath).size} bytes)`);
    }

    // 2. Ensure uncompressed .traineddata exists by unzipping if needed
    if (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 1000) {
      try {
        const gzBuffer = fs.readFileSync(gzPath);
        const uncompressed = zlib.gunzipSync(gzBuffer);
        fs.writeFileSync(rawPath, uncompressed);
        console.log(`[Pre-seed] Extracted ${item.uncompressedName} (${uncompressed.length} bytes)`);
      } catch (err) {
        console.warn(`[Pre-seed] Could not gunzip ${item.name} to ${item.uncompressedName}:`, err.message);
      }
    }
  }
}

/**
 * F3. Headless-Only Verification:
 * Launches Puppeteer strictly headless with --disable-extensions and no visible window,
 * so no OS download manager (IDM, Free Download Manager, etc.) can ever intercept requests;
 * creates an isolated temp download dir and returns { browser, tempDownloadDir }.
 */
export async function launchHeadlessBrowser(puppeteer, customLaunchOptions = {}) {
  // Always pre-seed locally via Node before launching browser
  await preseedTesseractLangData();

  const tempDownloadDir = path.join(
    os.tmpdir(),
    `puppeteer_downloads_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  if (!fs.existsSync(tempDownloadDir)) {
    fs.mkdirSync(tempDownloadDir, { recursive: true });
  }

  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--mute-audio',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--headless=new'
  ];

  const args = Array.from(new Set([...defaultArgs, ...(customLaunchOptions.args || [])]));

  const browser = await puppeteer.launch({
    ...customLaunchOptions,
    headless: true, // strictly headless
    args
  });

  return { browser, tempDownloadDir };
}

/**
 * F3 Safety Net: Calls CDP Browser.setDownloadBehavior to redirect any downloads
 * to a temp dir with default handling so dialogs are prevented.
 * Also pre-populates IndexedDB with the traineddata to ensure zero network requests,
 * and sets up CDP request interception for local fulfillment.
 */
export async function configureDownloadSafety(page, downloadDir) {
  let downloadAttempts = 0;
  try {
    const client = await page.createCDPSession();
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'deny',
      downloadPath: downloadDir || os.tmpdir(),
      eventsEnabled: true
    });
    client.on('Browser.downloadWillBegin', (evt) => {
      downloadAttempts++;
      console.warn('[CDP Download Event Detected!]', evt);
    });
  } catch (err) {
    try {
      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'deny',
        downloadPath: downloadDir || os.tmpdir()
      });
    } catch {}
  }
  page._getDownloadAttempts = () => downloadAttempts;

  // Intercept and serve Tesseract lang-data assets directly to prevent OS download managers from intercepting
  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/tesseract/lang-data/')) {
        const fileName = url.split('/tesseract/lang-data/')[1].split('?')[0];
        const distPath = path.resolve(process.cwd(), 'dist', 'tesseract', 'lang-data', fileName);
        const publicPath = path.resolve(process.cwd(), 'public', 'tesseract', 'lang-data', fileName);
        const filePath = fs.existsSync(distPath) ? distPath : publicPath;

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const contentType = fileName.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream';
          req.respond({
            status: 200,
            contentType,
            headers: {
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Content-Disposition': 'inline',
              'Access-Control-Allow-Origin': '*'
            },
            body: fs.readFileSync(filePath)
          });
          return;
        }
      }
      try {
        req.continue();
      } catch {}
    });
  } catch {}

  // Pre-seed IndexedDB in browser so Tesseract.js never needs to make any network fetch for lang-data
  try {
    const gujGzPath = path.resolve(process.cwd(), 'public', 'tesseract', 'lang-data', 'guj.traineddata.gz');
    const engGzPath = path.resolve(process.cwd(), 'public', 'tesseract', 'lang-data', 'eng.traineddata.gz');
    if (fs.existsSync(gujGzPath) && fs.existsSync(engGzPath)) {
      const gujRaw = zlib.gunzipSync(fs.readFileSync(gujGzPath));
      const engRaw = zlib.gunzipSync(fs.readFileSync(engGzPath));
      const gujB64 = gujRaw.toString('base64');
      const engB64 = engRaw.toString('base64');

      const seedScript = `
        (() => {
          function seedTessIDB() {
            try {
              function b64ToU8(b64) {
                const bin = atob(b64);
                const u8 = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                return u8;
              }
              const gBytes = b64ToU8('${gujB64}');
              const eBytes = b64ToU8('${engB64}');
              const req = indexedDB.open('keyval-store');
              req.onupgradeneeded = () => {
                req.result.createObjectStore('keyval');
              };
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction('keyval', 'readwrite');
                const store = tx.objectStore('keyval');
                store.put(gBytes, './guj.traineddata');
                store.put(eBytes, './eng.traineddata');
                store.put(gBytes, 'guj.traineddata');
                store.put(eBytes, 'eng.traineddata');
                tx.oncomplete = () => db.close();
              };
            } catch (e) {
              console.warn('[Preseed IDB] failed:', e);
            }
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', seedTessIDB);
          } else {
            seedTessIDB();
          }
        })();
      `;

      await page.evaluateOnNewDocument(seedScript);
    }
  } catch (err) {
    console.warn('[configureDownloadSafety] IndexedDB pre-seed warning:', err.message);
  }
}
