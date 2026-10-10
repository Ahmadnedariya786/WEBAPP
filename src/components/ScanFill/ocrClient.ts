import Tesseract from 'tesseract.js';
import type { ExtractedReport, ExtractedActivity, LeafField } from './types';

let cachedWorker: any = null;
let workerInitPromise: Promise<any> | null = null;

/**
 * Initializes and returns the self-contained local Tesseract OCR worker.
 * Uses local bundled worker, core wasm, and language assets from /tesseract/.
 * Zero external CDN runtime fetches. Precached in Service Worker for full PWA offline operation.
 */
export async function getOcrWorker() {
  if (cachedWorker) {
    return cachedWorker;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  workerInitPromise = (async () => {
    const createWorkerFn = (Tesseract as any).createWorker || (Tesseract as any).default?.createWorker;
    if (typeof createWorkerFn !== 'function') {
      throw new Error('Tesseract createWorker not available');
    }

    const worker = await createWorkerFn('guj+eng', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-lstm.wasm.js',
      langPath: '/tesseract/lang-data',
      gzip: false
    });

    cachedWorker = worker;
    workerInitPromise = null;
    return worker;
  })().catch((err) => {
    workerInitPromise = null;
    cachedWorker = null;
    throw err;
  });

  return workerInitPromise;
}

/**
 * Resets and terminates the OCR worker so next call creates a fresh worker.
 */
export async function resetOcrWorker() {
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch {
      // ignore termination errors
    }
    cachedWorker = null;
  }
  workerInitPromise = null;
}

const KNOWN_BANASKANTHA_HALQAS = [
  'પાલનપુર', 'ડીસા', 'વડગામ', 'દાંતા', 'ભાભર', 'થરાદ',
  'ધાનેરા', 'વાવ', 'દિયોદર', 'કાંકરેજ', 'અમીરગઢ', 'સુઈગામ',
  'દાંતીવાડા', 'લાખાણી'
];

/**
 * Parses raw OCR extracted text into structured ExtractedReport
 */
export function parseOcrText(text: string, currentHalqas: string[] = []): ExtractedReport {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const allHalqas = Array.from(new Set([...currentHalqas, ...KNOWN_BANASKANTHA_HALQAS]));

  // 1. Detect Halqa name
  let matchedHalqa: string | null = null;
  for (const line of lines) {
    const norm = line.replace(/\s+/g, '');
    for (const h of allHalqas) {
      if (h && norm.includes(h)) {
        matchedHalqa = h;
        break;
      }
    }
    if (matchedHalqa) break;
  }

  // 2. Extract Numbers & Stats
  // Match both Gujarati numerals (૦-૯) and Arabic numerals (0-9)
  const numRegex = /([0-9૦-૯]+(?:\/[0-9૦-૯]+|\+[0-9૦-૯]+)?)/g;
  const numbersFound: string[] = [];
  lines.forEach((line) => {
    const matches = line.match(numRegex);
    if (matches) {
      numbersFound.push(...matches);
    }
  });

  const getStat = (idx: number, fallbackKey?: string): LeafField => {
    if (fallbackKey) {
      for (const line of lines) {
        if (line.includes(fallbackKey)) {
          const m = line.match(numRegex);
          if (m && m[0]) return { v: m[0], ok: true };
        }
      }
    }
    const val = numbersFound[idx] || null;
    return { v: val, ok: true };
  };

  const student_count = getStat(0, 'વિદ્યાર્થી');
  const std10 = getStat(1, '૧૦');
  const std11 = getStat(2, '૧૧');
  const std12 = getStat(3, '૧૨');
  const college = getStat(4, 'કોલેજ');
  const engineer = getStat(5, 'એન્જિનિયર');
  const medical = getStat(6, 'મેડિકલ');
  const muslim_teachers = getStat(7, 'શિક્ષક');

  // 3. Extract 13 Activities
  const ACTIVITY_KEYWORDS: Record<number, string[]> = {
    1: ['નમાઝ', 'નમાઝો', '1.', '૧.'],
    2: ['મશવરા', 'મશવરો', '2.', '૨.'],
    3: ['તાલીમ', '3.', '૩.'],
    4: ['ગશત', 'ગશ્ત', '4.', '૪.'],
    5: ['પંચકોસા', 'પંચ', '5.', '૫.'],
    6: ['શબગુજારી', 'શબ', '6.', '૬.'],
    7: ['મુલાકાત', '7.', '૭.'],
    8: ['સ્કૂલ', 'કોલેજ', '8.', '૮.'],
    9: ['૩ દિન', '3 દિન', '9.', '૯.'],
    10: ['૧૦ દિન', '10 દિન', '10.', '૧૦.'],
    11: ['૪૦ દિન', '40 દિન', '11.', '૧૧.'],
    12: ['૪ માહ', '4 માહ', '12.', '૧૨.'],
    13: ['ક્યારે', 'ક્યાં', '13.', '૧૩.']
  };

  const activities: ExtractedActivity[] = [];
  let numOffset = 8; // start assigning remaining numbers to activities if keyword search doesn't find line numbers

  for (let no = 1; no <= 13; no++) {
    const kws = ACTIVITY_KEYWORDS[no] || [];
    let actLine = lines.find((l) => kws.some((kw) => l.includes(kw)));
    let colValues: string[] = [];

    if (actLine) {
      const m = actLine.match(numRegex);
      if (m && m.length > 0) {
        colValues = m;
      }
    }

    if (colValues.length === 0 && numbersFound.length > numOffset) {
      // Best-effort sequential filling for available values
      colValues = [numbersFound[numOffset] || ''];
      numOffset++;
    }

    activities.push({
      no,
      gujishata: { v: colValues[0] || null, ok: true },
      agraaham: { v: colValues[1] || null, ok: true },
      mojuda: { v: colValues[2] || (no === 13 && actLine ? actLine : null), ok: true }
    });
  }

  return {
    halqa_name: {
      v: matchedHalqa || (currentHalqas.length > 0 ? currentHalqas[0] : null),
      ok: true
    },
    student_count,
    std10,
    std11,
    std12,
    college,
    engineer,
    medical,
    muslim_teachers,
    activities,
    mulakat_percent: activities[6]?.gujishata,
    schools_prayer: activities[7]?.gujishata,
    jamat_3din: activities[8]?.gujishata,
    jamat_10din: activities[9]?.gujishata,
    skipped_columns: []
  };
}

/**
 * Runs self-contained OCR on the given preprocessed downscaled canvas.
 */
export async function runSelfContainedOcr(
  canvas: HTMLCanvasElement,
  currentHalqas: string[] = []
): Promise<ExtractedReport> {
  if (typeof window !== 'undefined' && (window as any).__simulateOcrFail) {
    const customReason = (window as any).__simulateOcrFailReason || 'Engine allocation failed';
    throw new Error(customReason);
  }

  const worker = await getOcrWorker();
  const result = await worker.recognize(canvas);
  const text = result?.data?.text || '';
  return parseOcrText(text, currentHalqas);
}
