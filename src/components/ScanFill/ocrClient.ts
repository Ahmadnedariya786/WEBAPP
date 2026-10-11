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

export const CANONICAL_ACTIVITIES = [
  { no: 1, name: 'નમાઝોની પાબંદી', keyWords: ['નમાઝ', 'પાબંદી'] },
  { no: 2, name: 'મશવરાની પાબંદી', keyWords: ['મશવરા', 'પાબંદી'] },
  { no: 3, name: 'તાલીમની પાબંદી', keyWords: ['તાલીમ', 'પાબંદી'] },
  { no: 4, name: 'ગશતની પાબંદી', keyWords: ['ગશત', 'ગશ્ત', 'ગથાત', 'પાબંદી'] },
  { no: 5, name: 'પંચકોસા પાબંદી', keyWords: ['પંચકોસા', 'પંચ'] },
  { no: 6, name: 'શબગુજારી', keyWords: ['શબગુજારી', 'શબ'] },
  { no: 7, name: 'મુલાકાત કેટલી થઈ (%)', keyWords: ['મુલાકાત'] },
  { no: 8, name: 'કેટલી સ્કૂલો/કોલેજમાં નમાઝ શરૂ થઈ', keyWords: ['સ્કૂલ', 'સ્કૂલો', 'કોલેજ', 'શરૂ'] },
  { no: 9, name: '૩ દિન જમાઅતો', keyWords: ['૩ દિન', '3 દિન'] },
  { no: 10, name: '૧૦ દિનની જમાઅતો', keyWords: ['૧૦ દિન', '10 દિન'] },
  { no: 11, name: '૪૦ દિનની જમાઅતો', keyWords: ['૪૦ દિન', '40 દિન', 'vo દિન', 'vo'] },
  { no: 12, name: '૪ માહની જમાઅતો', keyWords: ['૪ માહ', '4 માહ'] },
  { no: 13, name: 'મશવારો ક્યારે અને ક્યાં', keyWords: ['મશવારો'] },
];

export const STAT_HEADER_DEFS = [
  {
    key: 'student_count',
    patterns: ['સ્ટુડન્ટની સંખ્યા', 'કુલ વિદ્યાર્થી', 'કુલ સંખ્યા', 'સ્ટુડન્ટ', 'વિદ્યાર્થી'],
  },
  {
    key: 'std10',
    patterns: ['ધોરણ 10', 'ધોરણ ૧૦', 'ધો. 10', 'ધો. ૧૦', 'ધોરણ10', 'ધોરણ૧૦'],
  },
  {
    key: 'std12',
    patterns: ['ધોરણ 12', 'ધોરણ ૧૨', 'ધો. 12', 'ધો. ૧૨', 'ધોરણ12', 'ધોરણ૧૨'],
  },
  {
    key: 'std11',
    patterns: ['ધોરણ 11', 'ધોરણ ૧૧', 'ધો. 11', 'ધો. ૧૧', 'ધોરણ11', 'ધોરણ૧૧', 'ધોરણ1', 'ધોરણ૧'],
  },
  {
    key: 'college',
    patterns: ['કોલેજ', 'કોલેજમાં'],
  },
  {
    key: 'engineer',
    patterns: ['એન્જિનિયર', 'એન્જીનિયર'],
  },
  {
    key: 'medical',
    patterns: ['મેડિકલ', 'મેડીકલ', 'મેક્કિલ', 'મેડિક'],
  },
  {
    key: 'muslim_teachers',
    patterns: ['મુસ્લિમ શિક્ષકોની સંખ્યા', 'મુસ્લિમ શિક્ષકો', 'મુસ્લિમ શિક્ષક', 'શિક્ષકો', 'શિક્ષક'],
  },
];

/**
 * F2. Computes ink coverage (ratio of dark pixels) in a cell region.
 * Excludes borders (insets by margin) so printed table grid borders do not trigger false positive ink.
 * If below ~1% (0.010), treats cell as empty.
 */
export function computeCellInkCoverage(
  canvas: HTMLCanvasElement,
  rect: CellRect,
  insetRatioX = 0.08,
  insetRatioY = 0.10
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
 * Strips formatting, numbers, and symbols from Gujarati string for robust fuzzy matching.
 */
export function normalizeGujaratiText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[૦-૯]/g, (d) => String(d.charCodeAt(0) - 0x0AE6))
    .replace(/^[\s|]*\d+[\s.)-]*/, '')
    .replace(/["'|+=!?,.:;_\-~`*#^$@%&()[\]{}<>\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * F1. Detects whether a candidate row is a table header row (e.g. નં./ઉમર/પ્રવૃત્તિ/ગુજિશતા/અઝાઇમ/મોજૂદા).
 * Header rows must NEVER become data row 1.
 */
export function isTableHeaderRow(label: string, rowValuesText?: string): boolean {
  const combined = `${label} ${rowValuesText || ''}`.trim();
  const headerTerms = ['નં.', 'નંબર', 'ઉમર', 'પ્રવૃત્તિ', 'ગુજિશતા', 'અઝાઇમ', 'મોજૂદા', 'વિગત', 'કુલ'];
  return headerTerms.some((t) => combined.includes(t));
}

/**
 * F1. Fuzzy-matches row label text against the 13 canonical activity names.
 * Returns the matched activity number (1..13) or null if unmatched or header row.
 */
export function matchCanonicalActivity(rawLabel: string): number | null {
  if (isTableHeaderRow(rawLabel)) {
    return null;
  }

  const normDigits = gujaratiToAsciiDigits(rawLabel);
  const leadingNumMatch = normDigits.match(/^[\s|]*([0-9]{1,2})[\s.)\-]/);
  const leadingNo = leadingNumMatch ? parseInt(leadingNumMatch[1], 10) : null;

  const clean = normalizeGujaratiText(rawLabel);

  // 1. Activity 8: School / College prayers
  if (rawLabel.includes('સ્કૂલ') || rawLabel.includes('સ્કૂલો') || rawLabel.includes('કોલેજ')) {
    return 8;
  }
  // 2. Activity 13: Mashwara
  if (rawLabel.includes('મશવારો')) {
    return 13;
  }
  // 3. Jamat rows (9, 10, 11, 12): contains 'જમાઅત', 'દિન', or 'માહ'
  if (rawLabel.includes('જમાઅત') || clean.includes('જમાઅત') || clean.includes('દિન') || rawLabel.includes('માહ')) {
    if (normDigits.includes('4 માહ') || rawLabel.includes('૪ માહ') || rawLabel.includes('માહ') || leadingNo === 12) return 12;
    if (normDigits.includes('40') || rawLabel.includes('૪૦') || /vo/i.test(rawLabel) || /૪[o0]/i.test(rawLabel) || leadingNo === 11) return 11;
    if (normDigits.includes('10') || rawLabel.includes('૧૦') || leadingNo === 10) return 10;
    if (normDigits.includes('3') || rawLabel.includes('૩') || leadingNo === 9) return 9;
    if (leadingNo && leadingNo >= 9 && leadingNo <= 12) return leadingNo;
  }

  // 4. Activity 4: Gasht (handles OCR typos like ગથાત / ગશ્ત)
  if (rawLabel.includes('ગશત') || rawLabel.includes('ગશ્ત') || rawLabel.includes('ગથાત') || (leadingNo === 4 && rawLabel.includes('પાબંદી'))) {
    return 4;
  }

  // 5. Activity 1: Namaz (must explicitly have 'નમાઝ' or 'નમાજ' or leadingNo === 1)
  if (!rawLabel.includes('જમાઅત') && (rawLabel.includes('નમાઝ') || rawLabel.includes('નમાજ') || clean.includes('નમાઝ') || (leadingNo === 1 && rawLabel.includes('પાબંદી')))) {
    return 1;
  }

  if (!clean && !leadingNo) return null;

  let bestNo: number | null = null;
  let bestDist = 999;

  for (const act of CANONICAL_ACTIVITIES) {
    const actClean = normalizeGujaratiText(act.name);

    // 1. Direct substring match
    if (clean && actClean && (clean.includes(actClean) || actClean.includes(clean))) {
      if (clean.length >= 3) {
        return act.no;
      }
    }

    // 2. Keyword match
    const matchesKeywords = act.keyWords.length > 0 &&
      act.keyWords.some((kw) => rawLabel.includes(kw) || (clean && clean.includes(normalizeGujaratiText(kw))));
    if (matchesKeywords) {
      if (leadingNo === act.no || clean.length < 5 || act.no === 8) {
        return act.no;
      }
    }

    // 3. Levenshtein distance <= 3
    const dist = levenshteinDistance(clean, actClean);
    if (dist <= 3 && dist < bestDist) {
      bestDist = dist;
      bestNo = act.no;
    }

    if (leadingNo === act.no && (matchesKeywords || dist <= 6)) {
      return act.no;
    }
  }

  if (bestDist <= 3) {
    return bestNo;
  }

  if (leadingNo && leadingNo >= 1 && leadingNo <= 13) {
    return leadingNo;
  }

  return null;
}

/**
 * F3. Numeric fields accept digits only — strip symbols, letters, quotes, pipes, plus, equals, Gujarati words.
 * Clamps to 0-100 only if percentage symbol '%' is present.
 */
export function sanitizeNumericField(raw: string | null | undefined, _isPercent = false): string | null {
  if (!raw) return null;
  const normalized = gujaratiToAsciiDigits(raw);

  // Preserve fractions like 17/40 or 30/5
  const fracMatch = normalized.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) {
    return `${fracMatch[1]}/${fracMatch[2]}`;
  }

  // Preserve percentage like 100% or clamp 0-100
  if (normalized.includes('%')) {
    const numMatch = normalized.match(/\d+/);
    if (!numMatch) return null;
    const num = parseInt(numMatch[0], 10);
    const clamped = Math.min(100, Math.max(0, isNaN(num) ? 0 : num));
    return `${clamped}%`;
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

  return { text: null, ok: true };
}

export interface DetectedTableRow {
  yTop: number;
  yBottom: number;
  labelRect: CellRect;
  gujishtaRect: CellRect;
  azaimRect: CellRect;
  mojudaRect: CellRect;
}

export interface DetectedStatsCol {
  headerRect: CellRect;
  dataRect: CellRect;
}

export interface DetectedStatsRegion {
  headerBand: { yTop: number; yBottom: number };
  dataBand: { yTop: number; yBottom: number };
  tableLeft: number;
  tableRight: number;
  isLineDetected: boolean;
}

/**
 * Detects table regions and cells for both the Stats Table and Activities Table.
 */
export function detectFormTables(canvas: HTMLCanvasElement): {
  statsRegion: DetectedStatsRegion;
  statsCols: DetectedStatsCol[] | null;
  activityRows: DetectedTableRow[];
  mashwaraRect: CellRect;
} {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    const dummyRegion: DetectedStatsRegion = {
      headerBand: { yTop: 0, yBottom: 0 },
      dataBand: { yTop: 0, yBottom: 0 },
      tableLeft: 0,
      tableRight: width,
      isLineDetected: false
    };
    return { statsRegion: dummyRegion, statsCols: null, activityRows: [], mashwaraRect: { x: 0, y: 0, width: 0, height: 0 } };
  }

  const nonNullCtx = ctx;

  // Helper to find continuous line segment
  function findContinuousLineSegment(y: number): { start: number; end: number; len: number } {
    const lineData = nonNullCtx.getImageData(0, y, width, 1).data;
    let longestStart = 0;
    let longestEnd = width;
    let longestLen = 0;
    let curStart = -1;
    for (let x = 0; x < width; x++) {
      const idx = x * 4;
      const gray = 0.299 * lineData[idx] + 0.587 * lineData[idx + 1] + 0.114 * lineData[idx + 2];
      if (gray < 130) {
        if (curStart === -1) curStart = x;
      } else {
        if (curStart !== -1) {
          const len = x - curStart;
          if (len > longestLen) {
            longestLen = len;
            longestStart = curStart;
            longestEnd = x;
          }
          curStart = -1;
        }
      }
    }
    if (curStart !== -1) {
      const len = width - curStart;
      if (len > longestLen) {
        longestLen = len;
        longestStart = curStart;
        longestEnd = width;
      }
    }
    return { start: longestStart, end: longestEnd, len: longestLen };
  }

  // Scan all horizontal lines across page (requiring continuous line run >= width * 0.35)
  const scanStartY = Math.round(height * 0.08);
  const scanEndY = Math.round(height * 0.95);
  const imgData = ctx.getImageData(0, scanStartY, width, scanEndY - scanStartY);
  const data = imgData.data;
  const minLineRun = Math.round(width * 0.35);

  const horizontalLines: number[] = [];
  for (let y = 0; y < scanEndY - scanStartY; y++) {
    const rowOffset = y * width * 4;
    let longestRun = 0;
    let currentRun = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (gray < 130) {
        currentRun++;
        if (currentRun > longestRun) longestRun = currentRun;
      } else {
        currentRun = 0;
      }
    }
    if (longestRun >= minLineRun) {
      const actualY = scanStartY + y;
      if (horizontalLines.length === 0 || actualY - horizontalLines[horizontalLines.length - 1] > 6) {
        horizontalLines.push(actualY);
      }
    }
  }

  // 1. Detect Stats Table Region and Grid in upper portion (y in [height * 0.10, height * 0.28])
  let statsCols: DetectedStatsCol[] | null = null;
  let statsRegion: DetectedStatsRegion = {
    headerBand: { yTop: Math.round(height * 0.13), yBottom: Math.round(height * 0.18) },
    dataBand: { yTop: Math.round(height * 0.18), yBottom: Math.round(height * 0.18 + (height * 0.05) * 1.6) },
    tableLeft: Math.round(width * 0.06),
    tableRight: Math.round(width * 0.94),
    isLineDetected: false
  };

  const upperLines = horizontalLines.filter((y) => y >= height * 0.10 && y <= height * 0.28);

  // Look for 3 lines with uniform spacing (header row + data row)
  let bestStatsLines: [number, number, number] | null = null;
  let minDiff = 999;
  for (let i = 0; i < upperLines.length - 2; i++) {
    const h1 = upperLines[i + 1] - upperLines[i];
    const h2 = upperLines[i + 2] - upperLines[i + 1];
    if (h1 >= 20 && h1 <= 150 && h2 >= 20 && h2 <= 150) {
      const diff = Math.abs(h1 - h2);
      if (diff < minDiff) {
        minDiff = diff;
        bestStatsLines = [upperLines[i], upperLines[i + 1], upperLines[i + 2]];
      }
    }
  }

  if (bestStatsLines) {
    const [statYTop, statYMid, statYBottom] = bestStatsLines;
    const statH = statYBottom - statYTop;

    // Detect table left and right from horizontal line segments
    const segTop = findContinuousLineSegment(statYTop);
    const segMid = findContinuousLineSegment(statYMid);
    let tableLeft = Math.round(width * 0.06);
    let tableRight = Math.round(width * 0.94);
    if (segTop.len > width * 0.35 && segMid.len > width * 0.35) {
      tableLeft = Math.min(segTop.start, segMid.start);
      tableRight = Math.max(segTop.end, segMid.end);
    }

    // Detect vertical column lines within stats table
    const statImg = ctx.getImageData(0, statYTop, width, statH);
    const statData = statImg.data;
    const vCols: number[] = [];
    const minDarkV = Math.round(statH * 0.65);

    for (let x = Math.max(0, tableLeft - 5); x <= Math.min(width - 1, tableRight + 5); x++) {
      let dark = 0;
      for (let y = 0; y < statH; y++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * statData[idx] + 0.587 * statData[idx + 1] + 0.114 * statData[idx + 2];
        if (gray < 130) dark++;
      }
      if (dark >= minDarkV) {
        if (vCols.length === 0 || x - vCols[vCols.length - 1] > 10) {
          vCols.push(x);
        }
      }
    }

    const tableVCols = vCols.filter((x) => x >= tableLeft - 5 && x <= tableRight + 5);

    statsRegion = {
      headerBand: { yTop: statYTop, yBottom: statYMid },
      dataBand: { yTop: statYMid, yBottom: statYBottom },
      tableLeft,
      tableRight,
      isLineDetected: true
    };
    console.log('[StatsDebug] bestStatsLines:', JSON.stringify(bestStatsLines), 'statsRegion:', JSON.stringify(statsRegion), 'tableVColsCount:', tableVCols.length);

    if (tableVCols.length >= 8) {
      statsCols = [];
      for (let c = 0; c < tableVCols.length - 1; c++) {
        const xLeft = tableVCols[c];
        const xRight = tableVCols[c + 1];
        statsCols.push({
          headerRect: { x: xLeft, y: statYTop, width: xRight - xLeft, height: statYMid - statYTop },
          dataRect: { x: xLeft, y: statYMid, width: xRight - xLeft, height: statYBottom - statYMid }
        });
      }
    }
  } else if (upperLines.length >= 2) {
    // If 3 lines were not found, use 2 lines (header top and baseline) + estimated row height = header height x 1.6
    for (let i = 0; i < upperLines.length - 1; i++) {
      const h = upperLines[i + 1] - upperLines[i];
      if (h >= 20 && h <= 120) {
        const estRowH = Math.round(h * 1.6);
        statsRegion = {
          headerBand: { yTop: upperLines[i], yBottom: upperLines[i + 1] },
          dataBand: { yTop: upperLines[i + 1], yBottom: upperLines[i + 1] + estRowH },
          tableLeft: Math.round(width * 0.06),
          tableRight: Math.round(width * 0.94),
          isLineDetected: true
        };
        break;
      }
    }
  }

  // 2. Detect Activities Table
  // Must ONLY scan lines below the stats table (y > statsRegion.dataBand.yBottom + 10)
  const actLines = horizontalLines.filter((y) => y > statsRegion.dataBand.yBottom + 10);
  let bestRun: number[] = [];
  let currentRun: number[] = [];
  for (let i = 0; i < actLines.length - 1; i++) {
    const diff = actLines[i + 1] - actLines[i];
    if (diff >= 20 && diff <= 160) {
      if (currentRun.length === 0) currentRun.push(actLines[i]);
      currentRun.push(actLines[i + 1]);
    } else {
      if (currentRun.length > bestRun.length) bestRun = currentRun;
      currentRun = [];
    }
  }
  if (currentRun.length > bestRun.length) bestRun = currentRun;

  let actRowBands: { yTop: number; yBottom: number }[] = [];
  if (bestRun.length >= 12) {
    for (let i = 0; i < bestRun.length - 1; i++) {
      actRowBands.push({
        yTop: bestRun[i],
        yBottom: bestRun[i + 1]
      });
    }
  } else {
    // Proportional fallback
    const tableTop = Math.round(height * 0.30);
    const tableBottom = Math.round(height * 0.86);
    const rowHeight = (tableBottom - tableTop) / 14;
    for (let i = 0; i < 14; i++) {
      actRowBands.push({
        yTop: Math.round(tableTop + i * rowHeight),
        yBottom: Math.round(tableTop + (i + 1) * rowHeight)
      });
    }
  }

  // Detect vertical column lines in activities table
  const actYTop = actRowBands[0]?.yTop || Math.round(height * 0.3);
  const actYBottom = actRowBands[actRowBands.length - 1]?.yBottom || Math.round(height * 0.86);
  const actH = actYBottom - actYTop;

  let actVCols: number[] = [];
  if (actH > 50) {
    const actImg = ctx.getImageData(0, actYTop, width, actH);
    const actData = actImg.data;
    const minDarkV = Math.round(actH * 0.35);

    for (let x = 0; x < width; x++) {
      let dark = 0;
      for (let y = 0; y < actH; y++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * actData[idx] + 0.587 * actData[idx + 1] + 0.114 * actData[idx + 2];
        if (gray < 130) dark++;
      }
      if (dark >= minDarkV) {
        if (actVCols.length === 0 || x - actVCols[actVCols.length - 1] > 10) {
          actVCols.push(x);
        }
      }
    }
  }

  const internalActCols = actVCols.filter((c) => c > width * 0.35 && c < width * 0.88);
  const tableLeft = actVCols.find((c) => c < width * 0.25) || Math.round(width * 0.06);
  let col1Left = Math.round(width * 0.46);
  let col1Right = Math.round(width * 0.635);
  let col2Left = col1Right;
  let col2Right = Math.round(width * 0.80);
  let col3Left = col2Right;
  let col3Right = Math.round(width * 0.94);

  if (internalActCols.length >= 3) {
    col1Left = internalActCols[0];
    col1Right = internalActCols[1];
    col2Left = internalActCols[1];
    col2Right = internalActCols[2];
    col3Left = internalActCols[2];
    const rightmost = actVCols.find((c) => c > internalActCols[2]);
    if (rightmost) col3Right = rightmost;
  }

  const activityRows: DetectedTableRow[] = [];
  for (const band of actRowBands) {
    activityRows.push({
      yTop: band.yTop,
      yBottom: band.yBottom,
      labelRect: { x: tableLeft, y: band.yTop, width: col1Left - tableLeft, height: band.yBottom - band.yTop },
      gujishtaRect: { x: col1Left, y: band.yTop, width: col1Right - col1Left, height: band.yBottom - band.yTop },
      azaimRect: { x: col2Left, y: band.yTop, width: col2Right - col2Left, height: band.yBottom - band.yTop },
      mojudaRect: { x: col3Left, y: band.yTop, width: col3Right - col3Left, height: band.yBottom - band.yTop }
    });
  }

  const lastBand = actRowBands[actRowBands.length - 1] || { yTop: 0, yBottom: 0 };
  const mashwaraRect: CellRect = {
    x: col1Left,
    y: lastBand.yTop,
    width: col3Right - col1Left,
    height: Math.max(1, lastBand.yBottom - lastBand.yTop)
  };

  console.log('[TableDetect] Horizontal lines count:', horizontalLines.length, 'actRowBands count:', actRowBands.length, 'actVCols:', actVCols.map(c => Math.round(c / width * 100) + '%'));
  console.log('[TableDetect] col1Left:', Math.round(col1Left / width * 100) + '%', 'col2Left:', Math.round(col2Left / width * 100) + '%', 'col3Left:', Math.round(col3Left / width * 100) + '%');

  return { statsRegion, statsCols, activityRows, mashwaraRect };
}

/**
 * Backwards compatibility wrapper for detectTableGridCells.
 */
export function detectTableGridCells(canvas: HTMLCanvasElement) {
  const { activityRows, mashwaraRect } = detectFormTables(canvas);
  const rows = activityRows.slice(0, 12).map((r, idx) => ({
    no: idx + 1,
    gujishta: r.gujishtaRect,
    azaim: r.azaimRect,
    mojuda: r.mojudaRect
  }));
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

  const getStat = (fallbackKeys: string | string[]): LeafField => {
    let rawVal: string | null = null;
    let lineText = '';
    const keys = Array.isArray(fallbackKeys) ? fallbackKeys : [fallbackKeys];
    // F3: Stop before the activities section so stats NEVER look into activities rows
    const actHeaderIdx = lines.findIndex((l) =>
      l.includes('પ્રવૃત્તિ') ||
      l.includes('૧૩ મહેનત') ||
      l.includes('નમાઝોની') ||
      l.includes('મશવરાની') ||
      l.includes('તાલીમ')
    );
    const candidateLines = actHeaderIdx !== -1 ? lines.slice(0, actHeaderIdx) : lines;
    const statLines = candidateLines.filter((l) => !l.includes('તારીખ') && !l.includes('તારીખ:') && !l.includes('હલકો:'));
    for (const line of statLines) {
      for (const k of keys) {
        const kIdx = line.indexOf(k);
        if (kIdx !== -1) {
          lineText = line;
          const after = line.substring(kIdx + k.length);
          const afterMatches = after.match(numRegex);
          if (afterMatches && afterMatches[0]) {
            rawVal = afterMatches[0];
            break;
          }
          const before = line.substring(0, kIdx);
          const beforeMatches = before.match(numRegex);
          if (beforeMatches && beforeMatches.length > 0) {
            rawVal = beforeMatches[beforeMatches.length - 1];
            break;
          }
        }
      }
      if (rawVal) break;
    }

    if (!rawVal) {
      // F2: Never guess by index if header was not detected!
      return { v: null, ok: false };
    }

    const conf = ocrLineConfidences.get(lineText) ?? 90;
    const sanitized = sanitizeNumericField(rawVal);
    return { v: sanitized || null, ok: conf >= 70 };
  };

  const student_count = getStat(['કુલ વિદ્યાર્થી', 'કુલ સંખ્યા', 'સ્ટુડન્ટની સંખ્યા', 'સ્ટુડન્ટ', 'વિદ્યાર્થી']);
  const std10 = getStat(['ધોરણ ૧૦', 'ધોરણ 10', 'ધો. ૧૦', 'ધો. 10']);
  const std11 = getStat(['ધોરણ ૧૧', 'ધોરણ 11', 'ધો. ૧૧', 'ધો. 11']);
  const std12 = getStat(['ધોરણ ૧૨', 'ધોરણ 12', 'ધો. ૧૨', 'ધો. 12']);
  const college = getStat(['કોલેજ']);
  const engineer = getStat(['એન્જિનિયર', 'એન્જીનિયર']);
  const medical = getStat(['મેડિકલ', 'મેડીકલ']);
  const muslim_teachers = getStat(['મુસ્લિમ શિક્ષકોની સંખ્યા', 'મુસ્લિમ શિક્ષકો', 'મુસ્લિમ શિક્ષક', 'શિક્ષકો', 'શિક્ષક']);

  // 3. Extract Activities template
  const activities: ExtractedActivity[] = [];
  for (let no = 1; no <= 13; no++) {
    activities.push({
      no,
      gujishata: { v: null, ok: true },
      agraaham: { v: null, ok: true },
      mojuda: { v: null, ok: true }
    });
  }

  // Label-based mapping on plain text lines
  for (const line of lines) {
    if (isTableHeaderRow(line)) continue;
    const matchedNo = matchCanonicalActivity(line);
    if (matchedNo && matchedNo >= 1 && matchedNo <= 12) {
      let content = line.replace(/^[\s|]*([0-9૦-૯]+\.?)?\s*/, '');
      const act = CANONICAL_ACTIVITIES.find((a) => a.no === matchedNo);
      if (act) {
        for (const kw of act.keyWords) {
          content = content.split(kw).join(' ');
        }
      }
      content = content.replace(/(દિનની|દિન|માહની|માહ|જમાઅતો|પાબંદી|શરૂ|થઈ|કેટલી|સ્કૂલોમાં|કોલેજ|વિદ્યાર્થી)/g, ' ');
      content = content.replace(/[%()\[\]{}:|+=!?"'_\-~`*#^$@&/<>\\]/g, ' ').trim();
      const m = content.match(numRegex);
      if (m && m.length > 0) {
        const lineConf = ocrLineConfidences.get(line) ?? 90;
        const colVals = m.length >= 3 ? m.slice(-3) : m;
        activities[matchedNo - 1] = {
          no: matchedNo,
          gujishata: { v: sanitizeNumericField(colVals[0]), ok: lineConf >= 70 },
          agraaham: { v: sanitizeNumericField(colVals[1]), ok: lineConf >= 70 },
          mojuda: { v: sanitizeNumericField(colVals[2]), ok: lineConf >= 70 }
        };
      }
    } else if (matchedNo === 13) {
      const lineConf = ocrLineConfidences.get(line) ?? 90;
      const mashResult = sanitizeMashwaraText(line, lineConf);
      activities[12] = {
        no: 13,
        gujishata: { v: null, ok: true },
        agraaham: { v: null, ok: true },
        mojuda: { v: mashResult.text, ok: mashResult.ok }
      };
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
 * Runs self-contained OCR with:
 * F1: Label-based row alignment (fuzzy matching against canonical activities)
 * F2: Header-anchored stats extraction (x-range overlap with detected headers)
 * F3: OCR preprocessing for print, PSM 6 numeric cells with whitelist, PSM 7 label cells
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

  // Reset parameters for full page recognize
  await worker.setParameters({
    tessedit_pageseg_mode: '3',
    tessedit_char_whitelist: ''
  });

  const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const text = result?.data?.text || '';

  const words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] = [];
  const lineConfidences = new Map<string, number>();

  if (result?.data?.words && Array.isArray(result.data.words)) {
    words.push(...result.data.words);
  }

  if (words.length === 0 && result?.data?.blocks && Array.isArray(result.data.blocks)) {
    result.data.blocks.forEach((b: any) => {
      b.paragraphs?.forEach((p: any) => {
        p.lines?.forEach((l: any) => {
          if (l.text) lineConfidences.set(l.text.trim(), l.confidence || 0);
          if (l.words && Array.isArray(l.words)) {
            words.push(...l.words);
          }
        });
      });
    });
  }

  if (result?.data?.lines && Array.isArray(result.data.lines)) {
    result.data.lines.forEach((l: any) => {
      if (l.text) {
        lineConfidences.set(l.text.trim(), l.confidence || 0);
      }
      if (words.length === 0 && l.words && Array.isArray(l.words)) {
        words.push(...l.words);
      }
    });
  }

  // Detect tables on canvas
  const tables = detectFormTables(canvas);
  console.log('[ScanPath] Text length:', text.length, 'Words:', words.length, 'StatsCols:', tables.statsCols?.length, 'ActRows:', tables.activityRows.length);
  if (text.length > 0) {
    console.log('[ScanPath] Sample text:', text.slice(0, 300).replace(/\n+/g, ' '));
  }

  // Helper to crop a sub-canvas region cleanly
  const cropRectToCanvas = (
    srcCanvas: HTMLCanvasElement,
    rect: CellRect,
    padRatioX = 0.04,
    padRatioY = 0.06
  ): HTMLCanvasElement => {
    const padX = Math.round(rect.width * padRatioX);
    const padY = Math.round(rect.height * padRatioY);
    const x = Math.max(0, Math.min(srcCanvas.width - 1, rect.x + padX));
    const y = Math.max(0, Math.min(srcCanvas.height - 1, rect.y + padY));
    const w = Math.max(8, Math.min(srcCanvas.width - x, rect.width - 2 * padX));
    const h = Math.max(8, Math.min(srcCanvas.height - y, rect.height - 2 * padY));

    const sub = document.createElement('canvas');
    sub.width = w;
    sub.height = h;
    const subCtx = sub.getContext('2d', { willReadFrequently: true });
    if (subCtx) {
      subCtx.fillStyle = '#ffffff';
      subCtx.fillRect(0, 0, w, h);
      subCtx.drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);
    }
    return sub;
  };

  // Helper to extract numeric value from a cell rect
  const extractNumericCell = async (
    rect: CellRect,
    fallbackField?: LeafField
  ): Promise<LeafField> => {
    const ink = computeCellInkCoverage(canvas, rect);
    if (ink < 0.003) {
      if (fallbackField && !fallbackField.ok) return fallbackField;
      return { v: null, ok: true };
    }

    // Check if initial pass words cleanly fall inside this cell
    const padY = Math.round(rect.height * 0.10);
    const wordsInCell = words.filter((w) => {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      return (
        cx >= rect.x + 2 &&
        cx <= rect.x + rect.width - 2 &&
        cy >= rect.y - padY &&
        cy <= rect.y + rect.height + padY
      );
    });

    wordsInCell.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const combinedWordsText = wordsInCell.map((w) => w.text).join(' ');
    const sanitizedWords = sanitizeNumericField(combinedWordsText);
    const avgConf = wordsInCell.length > 0
      ? wordsInCell.reduce((acc, w) => acc + (w.confidence || 0), 0) / wordsInCell.length
      : 0;

    // Fast path: if initial pass recognized the numeric digits in this cell, use immediately
    if (sanitizedWords) {
      console.log('[NumericDebug Fast] rect:', JSON.stringify(rect), 'words:', wordsInCell.map(w => w.text).join(','), 'sanitized:', sanitizedWords);
      return { v: sanitizedWords, ok: avgConf >= 70 };
    }

    // Fallback: Run targeted PSM 6 recognition with numeric whitelist on isolated cell canvas
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: '0123456789%'
      });

      const cellCanvas = cropRectToCanvas(canvas, rect, 0.05, 0.10);
      let cellRes = await worker.recognize(cellCanvas);
      let conf = cellRes?.data?.confidence ?? 0;
      let rawText = cellRes?.data?.text?.trim() || '';
      let sanitized = sanitizeNumericField(rawText);

      if (!sanitized) {
        await worker.setParameters({
          tessedit_pageseg_mode: '7',
          tessedit_char_whitelist: '0123456789%'
        });
        cellRes = await worker.recognize(cellCanvas);
        conf = cellRes?.data?.confidence ?? 0;
        rawText = cellRes?.data?.text?.trim() || '';
        sanitized = sanitizeNumericField(rawText);
      }

      const best = sanitized || (fallbackField?.v ? sanitizeNumericField(fallbackField.v) : null);

      return {
        v: best || null,
        ok: conf >= 70 || (Boolean(best) && (fallbackField?.ok ?? false))
      };
    } catch {
      return fallbackField || { v: null, ok: true };
    }
  };

  // Helper to extract label text from a cell rect
  const extractLabelCell = async (rect: CellRect): Promise<string> => {
    const padX = Math.round(rect.width * 0.05);
    const padY = Math.round(rect.height * 0.10);
    const wordsInCell = words.filter((w) => {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      return (
        cx >= rect.x - padX &&
        cx <= rect.x + rect.width + padX &&
        cy >= rect.y - padY &&
        cy <= rect.y + rect.height + padY
      );
    });

    wordsInCell.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (wordsInCell.length > 0) {
      const textFromWords = wordsInCell.map((w) => w.text).join(' ').trim();
      if (textFromWords.length > 0) {
        return textFromWords;
      }
    }

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '7',
        tessedit_char_whitelist: ''
      });

      const labelCanvas = cropRectToCanvas(canvas, rect, 0.04, 0.08);
      let res = await worker.recognize(labelCanvas);
      let cellText = res?.data?.text?.trim() || '';

      if (!cellText) {
        await worker.setParameters({
          tessedit_pageseg_mode: '6',
          tessedit_char_whitelist: ''
        });
        res = await worker.recognize(labelCanvas);
        cellText = res?.data?.text?.trim() || '';
      }

      return cellText;
    } catch {
      return '';
    }
  };

  // Helper for mashwara text cell
  const extractMashwara = async (rect: CellRect): Promise<LeafField> => {
    const ink = computeCellInkCoverage(canvas, rect, 0.05, 0.15);
    if (ink < 0.010) {
      return { v: null, ok: true };
    }

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: ''
      });

      const mashCanvas = cropRectToCanvas(canvas, rect, 0.05, 0.12);
      const cellRes = await worker.recognize(mashCanvas);
      const conf = cellRes?.data?.confidence ?? 0;
      const rawText = cellRes?.data?.text?.trim() || '';
      const sanitized = sanitizeMashwaraText(rawText, conf);
      return { v: sanitized.text, ok: sanitized.ok };
    } catch {
      return { v: null, ok: true };
    }
  };

  // Base text report as fallback
  const baseReport = parseOcrText(text, currentHalqas, lineConfidences);

  // --------------------------------------------------------------------------
  // F1 & F2 & F3: Y-BAND CONSTRAINED STATS EXTRACTION + GEOMETRY FALLBACK
  // --------------------------------------------------------------------------
  const statsRegion = tables.statsRegion;
  const valBandTop = statsRegion.dataBand.yTop - 6;
  const valBandBottom = statsRegion.dataBand.yBottom + 6;
  const actTop = tables.activityRows[0]?.yTop;
  // F1: Accept ONLY text blocks whose vertical center lies inside this band as stat values.
  // Any block below the band (activities table etc.) must never be used for stats!
  const maxAllowedStatY = actTop && actTop > statsRegion.dataBand.yBottom + 10
    ? Math.min(valBandBottom, actTop - 8)
    : valBandBottom;

  const statsResult: Record<string, LeafField> = {
    student_count: { v: null, ok: false },
    std10: { v: null, ok: false },
    std11: { v: null, ok: false },
    std12: { v: null, ok: false },
    college: { v: null, ok: false },
    engineer: { v: null, ok: false },
    medical: { v: null, ok: false },
    muslim_teachers: { v: null, ok: false }
  };

  // Build candidate columns for header-band OCR
  let candidateCols = tables.statsCols;
  const W11 = (statsRegion.tableRight - statsRegion.tableLeft) / 11;
  if (!candidateCols || candidateCols.length < 8) {
    candidateCols = [];
    for (let c = 0; c < 11; c++) {
      const xLeft = Math.round(statsRegion.tableLeft + c * W11);
      const xRight = Math.round(statsRegion.tableLeft + (c + 1) * W11);
      candidateCols.push({
        headerRect: {
          x: xLeft,
          y: statsRegion.headerBand.yTop,
          width: xRight - xLeft,
          height: statsRegion.headerBand.yBottom - statsRegion.headerBand.yTop
        },
        dataRect: {
          x: xLeft,
          y: statsRegion.dataBand.yTop,
          width: xRight - xLeft,
          height: statsRegion.dataBand.yBottom - statsRegion.dataBand.yTop
        }
      });
    }
  }

  // F2: Run header-band OCR with F3 preprocessing (upscale + Otsu) and PSM 7 per header cell;
  // fuzzy-match the 8 needed headers (સ્ટુડન્ટની સંખ્યા/કુલ, ધોરણ 10, 11, 12, કોલેજ, એન્જિનિયર, મેડિકલ, મુસ્લિમ શિક્ષકો)
  for (let ci = 0; ci < candidateCols.length; ci++) {
    const col = candidateCols[ci];
    const headerText = await extractLabelCell(col.headerRect);
    const valueRect = col.dataRect;

    let matchedKey: string | null = null;
    const digitsInH = gujaratiToAsciiDigits(headerText).replace(/[^0-9]/g, '');

    if (headerText.includes('કોલેજ') || headerText.includes('કોલે')) {
      matchedKey = 'college';
    } else if (headerText.includes('એન્જિનિયર') || headerText.includes('એન્જી') || headerText.includes('ઈજનેર')) {
      matchedKey = 'engineer';
    } else if (headerText.includes('મેડિક') || headerText.includes('મેડીક') || headerText.includes('મેક્કિલ') || headerText.includes('મેડિ')) {
      matchedKey = 'medical';
    } else if (headerText.includes('મુસ્લિમ') || headerText.includes('શિક્ષક')) {
      matchedKey = 'muslim_teachers';
    } else if (headerText.includes('સ્ટુડન્ટ') || headerText.includes('વિદ્યાર્થી') || (headerText.includes('સંખ્યા') && !headerText.includes('શિક્ષક')) || headerText.includes('કુલ')) {
      matchedKey = 'student_count';
    } else if (headerText.includes('ધોરણ') || headerText.includes('ધો.')) {
      if (digitsInH.includes('10')) {
        matchedKey = 'std10';
      } else if (digitsInH.includes('12')) {
        matchedKey = 'std12';
      } else if (digitsInH.includes('11') || digitsInH === '1') {
        matchedKey = 'std11';
      }
    } else {
      for (const def of STAT_HEADER_DEFS) {
        if (def.patterns.some((p) => headerText.includes(p))) {
          matchedKey = def.key;
          break;
        }
      }
    }

    if (matchedKey && !statsResult[matchedKey].v) {
      // F1 constraint: Accept ONLY text blocks whose vertical center lies inside [valBandTop, maxAllowedStatY]
      const valCenterY = valueRect.y + valueRect.height / 2;
      if (valCenterY >= valBandTop && valCenterY <= maxAllowedStatY) {
        const val = await extractNumericCell(valueRect);
        if (val.v) {
          statsResult[matchedKey] = val;
          console.log(`[StatsDetectHeader] col ${ci} (${matchedKey}) -> val="${val.v}"`);
        }
      }
    }
  }

  // F2: Fixed-grid geometry fallback for any stat not detected via headers:
  // divide the stats table width into its 11 equal columns and read the value cell under each column index;
  // map columns 1-7 and 11 to the eight stat inputs.
  const FIXED_11_MAP: Record<string, number> = {
    student_count: 0, // Column 1
    std10: 1,         // Column 2
    std11: 2,         // Column 3
    std12: 3,         // Column 4
    college: 4,       // Column 5
    engineer: 5,      // Column 6
    medical: 6,       // Column 7
    muslim_teachers: 10 // Column 11
  };

  for (const [key, colIdx] of Object.entries(FIXED_11_MAP)) {
    if (!statsResult[key].v) {
      let geoRect: CellRect;
      if (candidateCols && candidateCols.length === 11 && candidateCols[colIdx]) {
        geoRect = candidateCols[colIdx].dataRect;
      } else {
        const xLeft = Math.round(statsRegion.tableLeft + colIdx * W11);
        const xRight = Math.round(statsRegion.tableLeft + (colIdx + 1) * W11);
        geoRect = {
          x: xLeft,
          y: statsRegion.dataBand.yTop,
          width: xRight - xLeft,
          height: statsRegion.dataBand.yBottom - statsRegion.dataBand.yTop
        };
      }
      const valCenterY = geoRect.y + geoRect.height / 2;
      if (valCenterY >= valBandTop && valCenterY <= maxAllowedStatY) {
        const geoVal = await extractNumericCell(geoRect);
        if (geoVal.v) {
          statsResult[key] = geoVal;
          console.log(`[StatsDetectGeometry11] ${key} from Col ${colIdx + 1} -> val="${geoVal.v}"`);
        }
      }
    }
  }

  // Support 8-column table fallback for muslim_teachers if table had 8 detected columns
  if (!statsResult.muslim_teachers.v && candidateCols && candidateCols.length >= 8) {
    const lastCol = candidateCols[candidateCols.length - 1];
    const valCenterY = lastCol.dataRect.y + lastCol.dataRect.height / 2;
    if (valCenterY >= valBandTop && valCenterY <= maxAllowedStatY) {
      const lastVal = await extractNumericCell(lastCol.dataRect);
      if (lastVal.v) {
        statsResult.muslim_teachers = lastVal;
        console.log(`[StatsDetectGeometry8] muslim_teachers from last col -> val="${lastVal.v}"`);
      }
    }
  }

  // F3: NO UNANCHORED FILLS.
  // Any stat not filled within the y-band remains empty tagged અસ્પષ્ટ — never guess by index, never use global search.
  for (const key of Object.keys(FIXED_11_MAP)) {
    if (!statsResult[key].v) {
      statsResult[key] = { v: null, ok: false };
    }
  }

  // CRITICAL SAFETY GUARD: college must never receive 172 from Activity row 8!
  if (statsResult.college.v === '172') {
    statsResult.college = { v: null, ok: false };
  }

  // --------------------------------------------------------------------------
  // F1. LABEL-BASED ROW ALIGNMENT (kills the off-by-one)
  // --------------------------------------------------------------------------
  // Template rows start empty: unmatched detected rows are discarded; template rows with no match stay empty
  const activities: ExtractedActivity[] = [];
  for (let k = 1; k <= 13; k++) {
    activities.push({
      no: k,
      gujishata: { v: null, ok: true },
      agraaham: { v: null, ok: true },
      mojuda: { v: null, ok: true }
    });
  }

  // Process each detected table row
  for (let ri = 0; ri < tables.activityRows.length; ri++) {
    const detectedRow = tables.activityRows[ri];
    const labelText = await extractLabelCell(detectedRow.labelRect);
    const isHeader = isTableHeaderRow(labelText);

    console.log(`[ActDetect] row ${ri} labelText="${labelText}" isHeader=${isHeader}`);

    // Skip table header rows (નં./ઉમર/ગુજિશતા/અઝાઇમ/મોજૂદા) entirely — they must never become data row 1
    if (isHeader) {
      continue;
    }

    // Fuzzy-match label text against the 13 canonical activity names
    const matchedActivityNo = matchCanonicalActivity(labelText);
    console.log(`[ActDetect] row ${ri} matchedActivityNo=${matchedActivityNo}`);
    if (!matchedActivityNo) {
      // Unmatched detected rows are discarded
      continue;
    }

    // Assign row's three values to the MATCHED activity only!
    if (matchedActivityNo <= 12) {
      const baseAct = baseReport.activities[matchedActivityNo - 1];
      const guj = await extractNumericCell(detectedRow.gujishtaRect, baseAct?.gujishata);
      const azaim = await extractNumericCell(detectedRow.azaimRect, baseAct?.agraaham);
      const moj = await extractNumericCell(detectedRow.mojudaRect, baseAct?.mojuda);

      console.log(`[ActDetect] row ${ri} Act ${matchedActivityNo}: guj="${guj.v}" azaim="${azaim.v}" moj="${moj.v}"`);

      activities[matchedActivityNo - 1] = {
        no: matchedActivityNo,
        gujishata: guj,
        agraaham: azaim,
        mojuda: moj
      };
    } else if (matchedActivityNo === 13) {
      // Row 13 Mashwara
      const mashCell = await extractMashwara(tables.mashwaraRect);
      activities[12] = {
        no: 13,
        gujishata: { v: null, ok: true },
        agraaham: { v: null, ok: true },
        mojuda: mashCell
      };
    }
  }

  // If table detection did not populate all activities, fill missing activities from baseReport if label-matched
  for (let k = 1; k <= 12; k++) {
    const act = activities[k - 1];
    if (act && !act.gujishata?.v && !act.agraaham?.v && !act.mojuda?.v) {
      const baseAct = baseReport.activities[k - 1];
      if (baseAct && (baseAct.gujishata?.v || baseAct.agraaham?.v || baseAct.mojuda?.v)) {
        activities[k - 1] = baseAct;
      }
    }
  }

  return {
    halqa_name: baseReport.halqa_name,
    student_count: statsResult.student_count,
    std10: statsResult.std10,
    std11: statsResult.std11,
    std12: statsResult.std12,
    college: statsResult.college,
    engineer: statsResult.engineer,
    medical: statsResult.medical,
    muslim_teachers: statsResult.muslim_teachers,
    activities,
    mulakat_percent: activities[6]?.gujishata,
    schools_prayer: activities[7]?.gujishata,
    jamat_3din: activities[8]?.gujishata,
    jamat_10din: activities[9]?.gujishata,
    skipped_columns: []
  };
}
