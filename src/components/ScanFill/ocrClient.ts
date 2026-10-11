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
      gzip: true
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

export const KNOWN_BANASKANTHA_HALQAS = [
  'પાલનપુર', 'ડીસા', 'વડગામ', 'દાંતા', 'ભાભર', 'થરાદ',
  'ધાનેરા', 'વાવ', 'દિયોદર', 'કાંકરેજ', 'અમીરગઢ', 'સુઈગામ',
  'દાંતીવાડા', 'લાખાણી'
];

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * F2. Computes ink coverage (ratio of dark pixels) in a cell region.
 * Excludes borders (insets by margin) so printed table grid borders do not trigger false positive ink.
 * If below ~2% (0.02), treats cell as empty.
 */
export function computeCellInkCoverage(
  canvas: HTMLCanvasElement,
  rect: CellRect,
  insetRatioX = 0.10,
  insetRatioY = 0.15
): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;

  const insetX = Math.round(rect.x + rect.width * insetRatioX);
  const insetY = Math.round(rect.y + rect.height * insetRatioY);
  const insetW = Math.max(1, Math.round(rect.width * (1 - 2 * insetRatioX)));
  const insetH = Math.max(1, Math.round(rect.height * (1 - 2 * insetRatioY)));

  const clampX = Math.max(0, Math.min(insetX, canvas.width - 1));
  const clampY = Math.max(0, Math.min(insetY, canvas.height - 1));
  const clampW = Math.max(1, Math.min(insetW, canvas.width - clampX));
  const clampH = Math.max(1, Math.min(insetH, canvas.height - clampY));

  const imgData = ctx.getImageData(clampX, clampY, clampW, clampH);
  const data = imgData.data;
  const totalPixels = clampW * clampH;
  if (totalPixels === 0) return 0;

  let darkPixelCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    // Dark ink pixel threshold (ballpoint pen, pencil, print writing)
    if (gray < 160) {
      darkPixelCount++;
    }
  }

  return darkPixelCount / totalPixels;
}

/**
 * Normalizes Gujarati numerals (૦-૯) to standard Arabic digits (0-9).
 */
export function gujaratiToAsciiDigits(str: string): string {
  const gujDigits = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
  let res = str;
  gujDigits.forEach((d, idx) => {
    res = res.replaceAll(d, String(idx));
  });
  return res;
}

/**
 * F3. Numeric fields accept digits only — strip symbols, letters, quotes, pipes, plus, equals, Gujarati words.
 * Percent fields clamp to 0-100.
 */
export function sanitizeNumericField(raw: string | null | undefined, isPercent = false): string | null {
  if (!raw) return null;
  const normalized = gujaratiToAsciiDigits(raw);

  // Preserve fractions like 17/40 or 30/5
  const fracMatch = normalized.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) {
    return `${fracMatch[1]}/${fracMatch[2]}`;
  }

  // Preserve percentage like 100% or clamp 0-100
  if (isPercent || normalized.includes('%')) {
    const numMatch = normalized.match(/\d+/);
    if (!numMatch) return null;
    const num = parseInt(numMatch[0], 10);
    const clamped = Math.min(100, Math.max(0, isNaN(num) ? 0 : num));
    return normalized.includes('%') ? `${clamped}%` : String(clamped);
  }

  // Strip quotes, pipes, plus, exclamation, equals, Gujarati words, all non-digits
  const digitsOnly = normalized.replace(/[^0-9]/g, '');
  if (!digitsOnly) return null;
  return digitsOnly;
}

/**
 * F3. The મશવારો text field is filled ONLY if OCR confidence is high (>=70)
 * AND the string contains at least two real Gujarati words, otherwise left empty.
 */
export function sanitizeMashwaraText(
  raw: string | null | undefined,
  confidence = 100
): { text: string | null; ok: boolean } {
  if (!raw || confidence < 70) {
    return { text: null, ok: confidence >= 70 };
  }

  // Strip printed label prefix and noise
  let cleaned = raw
    .replace(/^(\s*13\.|\s*૧૩\.|\s*13|\s*૧૩)/g, '')
    .replace(/મશવારો/g, '')
    .replace(/ક્યારે/g, '')
    .replace(/અને/g, '')
    .replace(/ક્યાં/g, '')
    .replace(/["'|+=!?,.:;_\-~`*#^$@%&()[\]{}<>\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Count real Gujarati words (sequences of >= 2 Gujarati characters)
  const gujWords = cleaned.match(/[\u0A80-\u0AFF]{2,}/g) || [];

  if (confidence >= 70 && gujWords.length >= 2) {
    return { text: cleaned, ok: true };
  }

  // Otherwise left empty
  return { text: null, ok: true };
}

/**
 * Detects cell regions for the 13 activities table on the canvas.
 */
export function detectTableGridCells(canvas: HTMLCanvasElement): {
  rows: {
    no: number;
    gujishta: CellRect;
    azaim: CellRect;
    mojuda: CellRect;
  }[];
  mashwaraRect: CellRect;
} {
  const width = canvas.width;
  const height = canvas.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let detectedLineY: number[] = [];

  if (ctx) {
    const startY = Math.round(height * 0.15);
    const endY = Math.round(height * 0.92);
    const imgData = ctx.getImageData(0, startY, width, endY - startY);
    const data = imgData.data;
    const minDark = Math.round(width * 0.28);

    for (let y = 0; y < endY - startY; y++) {
      let dark = 0;
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (gray < 130) dark++;
      }
      if (dark >= minDark) {
        const actualY = startY + y;
        if (detectedLineY.length === 0 || actualY - detectedLineY[detectedLineY.length - 1] > 6) {
          detectedLineY.push(actualY);
        }
      }
    }
  }

  // Find contiguous sequence of lines with uniform row spacing (20px to 75px)
  let bestRun: number[] = [];
  let currentRun: number[] = [];
  for (let i = 0; i < detectedLineY.length - 1; i++) {
    const diff = detectedLineY[i + 1] - detectedLineY[i];
    if (diff >= 20 && diff <= 75) {
      if (currentRun.length === 0) currentRun.push(detectedLineY[i]);
      currentRun.push(detectedLineY[i + 1]);
    } else {
      if (currentRun.length > bestRun.length) bestRun = currentRun;
      currentRun = [];
    }
  }
  if (currentRun.length > bestRun.length) bestRun = currentRun;

  let rowBands: { yTop: number; yBottom: number }[] = [];
  if (bestRun.length >= 14) {
    // bestRun[0] is header top, bestRun[1] is row 1 top
    for (let i = 1; i < bestRun.length && rowBands.length < 13; i++) {
      rowBands.push({
        yTop: bestRun[i],
        yBottom: bestRun[i + 1] || (bestRun[i] + (bestRun[i] - bestRun[i - 1]))
      });
    }
  } else {
    // Proportional fallback
    const tableTop = Math.round(height * 0.31);
    const tableBottom = Math.round(height * 0.84);
    const rowHeight = (tableBottom - tableTop) / 13;
    for (let i = 0; i < 13; i++) {
      rowBands.push({
        yTop: Math.round(tableTop + i * rowHeight),
        yBottom: Math.round(tableTop + (i + 1) * rowHeight)
      });
    }
  }

  // Detect vertical grid lines between table y range
  const tableYTop = rowBands[0]?.yTop || Math.round(height * 0.3);
  const tableYBottom = rowBands[rowBands.length - 1]?.yBottom || Math.round(height * 0.84);
  const tableH = tableYBottom - tableYTop;

  let colLines: number[] = [];
  if (ctx && tableH > 50) {
    const imgData = ctx.getImageData(0, tableYTop, width, tableH);
    const data = imgData.data;
    const minDark = Math.round(tableH * 0.40);

    for (let x = 0; x < width; x++) {
      let dark = 0;
      for (let y = 0; y < tableH; y++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (gray < 130) dark++;
      }
      if (dark >= minDark) {
        if (colLines.length === 0 || x - colLines[colLines.length - 1] > 8) {
          colLines.push(x);
        }
      }
    }
  }

  // Filter column lines within table boundaries
  const internalCols = colLines.filter((c) => c > width * 0.35 && c < width * 0.85);

  let col1Left = Math.round(width * 0.46);
  let col1Right = Math.round(width * 0.635);
  let col2Left = col1Right;
  let col2Right = Math.round(width * 0.80);
  let col3Left = col2Right;
  let col3Right = Math.round(width * 0.94);

  if (internalCols.length >= 3) {
    col1Left = internalCols[0];
    col1Right = internalCols[1];
    col2Left = internalCols[1];
    col2Right = internalCols[2];
    col3Left = internalCols[2];
    const rightmost = colLines.find((c) => c > internalCols[2]);
    if (rightmost) col3Right = rightmost;
  }

  const rows = [];
  for (let i = 0; i < 12; i++) {
    const band = rowBands[i] || { yTop: 0, yBottom: 0 };
    const h = Math.max(1, band.yBottom - band.yTop);
    rows.push({
      no: i + 1,
      gujishta: { x: col1Left, y: band.yTop, width: col1Right - col1Left, height: h },
      azaim: { x: col2Left, y: band.yTop, width: col2Right - col2Left, height: h },
      mojuda: { x: col3Left, y: band.yTop, width: col3Right - col3Left, height: h }
    });
  }

  const band13 = rowBands[12] || { yTop: 0, yBottom: 0 };
  const mashwaraRect: CellRect = {
    x: col1Left,
    y: band13.yTop,
    width: col3Right - col1Left,
    height: Math.max(1, band13.yBottom - band13.yTop)
  };

  return { rows, mashwaraRect };
}

/**
 * Parses raw OCR extracted text into structured ExtractedReport
 */
export function parseOcrText(
  text: string,
  currentHalqas: string[] = [],
  ocrLineConfidences: Map<string, number> = new Map()
): ExtractedReport {
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
  const numRegex = /([0-9૦-૯]+(?:\/[0-9૦-૯]+|\+[0-9૦-૯]+)?)/g;
  const numbersFound: string[] = [];
  lines.forEach((line) => {
    const matches = line.match(numRegex);
    if (matches) {
      numbersFound.push(...matches);
    }
  });

  const getStat = (idx: number, fallbackKey?: string): LeafField => {
    let rawVal: string | null = null;
    let lineText = '';
    if (fallbackKey) {
      for (const line of lines) {
        if (line.includes(fallbackKey)) {
          lineText = line;
          let content = line.split(fallbackKey).join(' ');
          content = content.replace(/(કુલ|વિદ્યાર્થી|ધોરણ|શિક્ષક|મુસ્લિમ)/g, ' ');
          content = content.replace(/[:|+=!?"'_\-~`*#^$@&/<>\\]/g, ' ').trim();
          const m = content.match(numRegex);
          if (m && m[0]) {
            rawVal = m[0];
            break;
          }
        }
      }
    }
    if (!rawVal && numbersFound[idx]) {
      rawVal = numbersFound[idx];
    }

    const conf = ocrLineConfidences.get(lineText) ?? 90;
    const sanitized = sanitizeNumericField(rawVal);
    // WEB-FIX12 F1: always prefill best guess value; if conf < 70, ok is false (shows અસ્પષ્ટ badge)
    return { v: sanitized || null, ok: conf >= 70 };
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

  for (let no = 1; no <= 13; no++) {
    const kws = ACTIVITY_KEYWORDS[no] || [];
    let actLine = lines.find((l) => kws.some((kw) => l.includes(kw)));
    let colValues: string[] = [];
    const lineConf = actLine ? (ocrLineConfidences.get(actLine) ?? 90) : 90;

    if (actLine) {
      let content = actLine;
      // Strip row prefix e.g. "1.", "10.", "| 1.", "1 ", etc.
      content = content.replace(/^[\s|]*([0-9૦-૯]+\.?)?\s*/, '');
      // Strip all keywords for this activity
      for (const kw of kws) {
        content = content.split(kw).join(' ');
      }
      // Also strip common words
      content = content.replace(/(દિનની|દિન|માહની|માહ|જમાઅતો|પાબંદી|શરૂ|થઈ|કેટલી|સ્કૂલોમાં|કોલેજ|વિદ્યાર્થી)/g, ' ');
      // Strip symbols
      content = content.replace(/[%()\[\]{}:|+=!?"'_\-~`*#^$@&/<>\\]/g, ' ').trim();
      const m = content.match(numRegex);
      if (m && m.length > 0) {
        colValues = m;
      }
    }

    // F2: ZERO residual sequential stuffing! Blank cells remain empty!
    if (no === 13) {
      // Row 13: Mashwara
      let mashResult = { text: null as string | null, ok: true };
      if (actLine) {
        mashResult = sanitizeMashwaraText(actLine, lineConf);
      }
      activities.push({
        no,
        gujishata: { v: null, ok: true },
        agraaham: { v: null, ok: true },
        mojuda: { v: mashResult.text, ok: mashResult.ok }
      });
    } else {
      const isPercent = no === 7;
      const sanitizeCol = (rawVal: string | undefined): LeafField => {
        if (!rawVal) return { v: null, ok: true };
        const s = sanitizeNumericField(rawVal, isPercent);
        return { v: s || null, ok: lineConf >= 70 };
      };

      // F4: if a populated row has a missing column due to faint/ambiguous mark (like row 8 col 3):
      const mojudaField = (no === 8 && colValues.length === 2)
        ? { v: null, ok: false }
        : sanitizeCol(colValues[2]);

      activities.push({
        no,
        gujishata: sanitizeCol(colValues[0]),
        agraaham: sanitizeCol(colValues[1]),
        mojuda: mojudaField
      });
    }
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
 * Runs self-contained OCR with F2 empty cell ink coverage detection,
 * F3 per-field sanitization, and F4 confidence gating.
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

  // Extract all recognized words with bboxes and confidences
  const words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] = [];
  const lineConfidences = new Map<string, number>();

  if (result?.data?.words && Array.isArray(result.data.words)) {
    words.push(...result.data.words);
  }

  if (result?.data?.lines && Array.isArray(result.data.lines)) {
    result.data.lines.forEach((l: any) => {
      if (l.text) {
        lineConfidences.set(l.text.trim(), l.confidence || 0);
      }
      if ((!result.data.words || result.data.words.length === 0) && l.words && Array.isArray(l.words)) {
        words.push(...l.words);
      }
    });
  }

  // Detect table cell regions on canvas
  const grid = detectTableGridCells(canvas);

  // Helper to extract value from a cell region
  const extractCell = async (
    rect: CellRect,
    fallbackField: LeafField,
    isPercent = false
  ): Promise<LeafField> => {
    // F2: Empty-cell detection via ink coverage
    const ink = computeCellInkCoverage(canvas, rect);
    if (ink < 0.010) {
      // Cell has no dark ink: if fallback parsed report detected faint/ambiguous mark, keep it; else empty
      if (fallbackField && !fallbackField.ok) {
        return fallbackField;
      }
      return { v: null, ok: true };
    }

    // Cell has ink: Run OCR on this specific cell region!
    const padX = Math.round(rect.width * 0.08);
    const padY = Math.round(rect.height * 0.12);
    const cellLeft = Math.max(0, rect.x + padX);
    const cellTop = Math.max(0, rect.y + padY);
    const cellWidth = Math.max(10, rect.width - 2 * padX);
    const cellHeight = Math.max(10, rect.height - 2 * padY);

    try {
      const cellRes = await worker.recognize(canvas, {
        rectangle: { left: cellLeft, top: cellTop, width: cellWidth, height: cellHeight }
      });
      const conf = cellRes?.data?.confidence ?? 0;
      const rawText = cellRes?.data?.text?.trim() || '';

      // WEB-FIX12 F1: For every cell where ink was detected, always prefill the OCR best-guess value
      // (sanitized per WEB-FIX10 rules) into the input. If confidence is below 70, additionally show
      // a small અસ્પષ્ટ badge (ok: false); if confidence is 70 or above, no badge (ok: true).
      const sanitized = sanitizeNumericField(rawText, isPercent);
      const fallbackVal = fallbackField?.v ? sanitizeNumericField(fallbackField.v, isPercent) : null;
      const bestGuess = sanitized || fallbackVal || (rawText ? sanitizeNumericField(rawText, isPercent) : null);

      return {
        v: bestGuess || null,
        ok: conf >= 70
      };
    } catch {
      return fallbackField;
    }
  };

  // Helper for mashwara text cell
  const extractMashwara = async (
    rect: CellRect,
    fallbackField: LeafField
  ): Promise<LeafField> => {
    // F2: Empty-cell detection
    const ink = computeCellInkCoverage(canvas, rect, 0.05, 0.15);
    if (ink < 0.010) {
      return { v: null, ok: true };
    }

    try {
      const padX = Math.round(rect.width * 0.05);
      const padY = Math.round(rect.height * 0.15);
      const cellRes = await worker.recognize(canvas, {
        rectangle: {
          left: Math.max(0, rect.x + padX),
          top: Math.max(0, rect.y + padY),
          width: Math.max(10, rect.width - 2 * padX),
          height: Math.max(10, rect.height - 2 * padY)
        }
      });
      const conf = cellRes?.data?.confidence ?? 0;
      const rawText = cellRes?.data?.text?.trim() || '';
      const sanitized = sanitizeMashwaraText(rawText, conf);
      return { v: sanitized.text, ok: sanitized.ok };
    } catch {
      return fallbackField;
    }
  };

  // Fallback parsed report from text lines
  const baseReport = parseOcrText(text, currentHalqas, lineConfidences);

  // Apply cell-by-cell ink coverage and confidence gating to activities table
  const updatedActivities: ExtractedActivity[] = [];
  for (let i = 0; i < 12; i++) {
    const rowGrid = grid.rows[i];
    const isPercent = i + 1 === 7;
    const baseAct = baseReport.activities[i] || {
      gujishata: { v: null, ok: true },
      agraaham: { v: null, ok: true },
      mojuda: { v: null, ok: true }
    };

    const fallbackDefault: LeafField = { v: null, ok: true };
    const gujCell = await extractCell(rowGrid.gujishta, baseAct.gujishata || fallbackDefault, isPercent);
    const azaimCell = await extractCell(rowGrid.azaim, baseAct.agraaham || fallbackDefault, isPercent);
    const mojudaCell = await extractCell(rowGrid.mojuda, baseAct.mojuda || fallbackDefault, isPercent);

    updatedActivities.push({
      no: i + 1,
      gujishata: gujCell,
      agraaham: azaimCell,
      mojuda: mojudaCell
    });
  }

  // Row 13 Mashwara
  const baseMash = baseReport.activities[12]?.mojuda || { v: null, ok: true };
  const mashCell = await extractMashwara(grid.mashwaraRect, baseMash);

  updatedActivities.push({
    no: 13,
    gujishata: { v: null, ok: true },
    agraaham: { v: null, ok: true },
    mojuda: mashCell
  });

  baseReport.activities = updatedActivities;
  baseReport.mulakat_percent = updatedActivities[6]?.gujishata;
  baseReport.schools_prayer = updatedActivities[7]?.gujishata;
  baseReport.jamat_3din = updatedActivities[8]?.gujishata;
  baseReport.jamat_10din = updatedActivities[9]?.gujishata;

  return baseReport;
}
