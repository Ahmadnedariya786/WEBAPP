/**
 * pdfGenerator.ts
 * S50-MASTER — Crisp Unicode PDF Generator using Offscreen Canvas & jsPDF
 * 
 * Root fix for Gujarati mojibake in jsPDF:
 *   - Renders each page to a 2x-resolution offscreen canvas using the browser's
 *     already-loaded Gujarati webfont ('Hind Vadodara', 'Noto Sans Gujarati')
 *   - Gates rendering behind `await document.fonts.ready`
 *   - Embeds the crisp rasterized page images into jsPDF (A4 portrait)
 *   - Zero font-encoding corruption, zero Latin-1 mojibake
 * 
 * Complies with D2 structured layout:
 *   - Centered bold title "બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ"
 *   - Meta line: "હલકો: <value>   તારીખ: <value>"
 *   - Section "સ્ટુડન્ટ આંકડા": two-column table (7 stats + total)
 *   - Section "પ્રવૃત્તિ સારાંશ": 4-column bordered table with light gray header
 *     filled + bold: પ્રવૃત્તિ | ગુજિશતા | અઝાઇમ | મોજૂદા (13 activity rows)
 *   - Sections "મશવારો" & "ખાસ નોંધ" with verbatim values
 *   - Footer: centered page numbers
 *   - Auto page-break handling
 */

import { jsPDF } from 'jspdf';
import { t } from '../i18n';
import { formatDate } from './utils';

export interface PdfReportData {
  halqa?: string;
  date?: string;
  stats?: {
    std_10?: number;
    std_11?: number;
    std_12?: number;
    college?: number;
    engineering?: number;
    medical?: number;
    muslim_teachers?: number;
    [key: string]: any;
  };
  activities?: Record<string, { gujishta?: string; azaim?: string; maujuda?: string }>;
  mashwara?: string;
  notes?: string;
  totalStudents?: number;
}

const ACTIVITY_KEYS = [
  'activity.namaz',
  'activity.mashwara_pabandi',
  'activity.taleem',
  'activity.gasht',
  'activity.panchkosa',
  'activity.shabguzari',
  'activity.mulaqat_percent',
  'activity.school_namaz',
  'activity.jamaat_3',
  'activity.jamaat_10',
  'activity.jamaat_40',
  'activity.jamaat_4m'
];

const FONT_FAMILY = '"Hind Vadodara", "Noto Sans Gujarati", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';

// Canvas A4 dimensions at 150 DPI (2x scale relative to 72 pt)
const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 1754;
const MARGIN_LEFT = 70;
const MARGIN_RIGHT = 1170;
const CONTENT_WIDTH = MARGIN_RIGHT - MARGIN_LEFT; // 1100 px

/**
 * Word-wrap helper for canvas text rendering
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return ['-'];
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : ['-'];
}

/**
 * Creates a clean white canvas initialized for A4 rendering.
 */
function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // High quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  return { canvas, ctx };
}

/**
 * Draws footer on a page canvas.
 */
function drawFooter(ctx: CanvasRenderingContext2D, pageNum: number, totalPages: number) {
  ctx.save();
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(MARGIN_LEFT, 1690, CONTENT_WIDTH, 1);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 15px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(`પેજ ${pageNum} / ${totalPages}`, CANVAS_WIDTH / 2, 1720);
  ctx.restore();
}

/**
 * Generates a complete report PDF Blob with authentic Gujarati typography.
 */
export async function generateReportPdfBlob(data: PdfReportData): Promise<Blob> {
  // Gate: wait for Gujarati webfonts to load completely
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback gracefully if fonts.ready rejects
    }
  }

  const halqa = data.halqa || '-';
  const dateStr = formatDate(data.date || '');
  const stats = data.stats || {};
  const totalStudents = data.totalStudents !== undefined
    ? data.totalStudents
    : ((stats.std_10 || 0) + (stats.std_11 || 0) + (stats.std_12 || 0) + (stats.college || 0));
  const activities = data.activities || {};
  const mashwaraVal = data.mashwara || activities['mashwara']?.maujuda || '-';
  const notesVal = data.notes || '-';

  const pageCanvases: HTMLCanvasElement[] = [];

  // ─────────────────────────────────────────────────────────────
  // PAGE 1
  // ─────────────────────────────────────────────────────────────
  let { canvas, ctx } = createPageCanvas();
  pageCanvases.push(canvas);

  let y = 85;

  // 1. Centered bold title: "બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ"
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 34px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText('બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ', CANVAS_WIDTH / 2, y);

  // Decorative Accent Rule
  y += 18;
  ctx.fillStyle = '#4F46E5';
  ctx.fillRect((CANVAS_WIDTH - 240) / 2, y, 240, 3.5);

  // 2. Meta line: "હલકો: <value>   તારીખ: <value>"
  y += 38;
  ctx.fillStyle = '#334155';
  ctx.font = `600 20px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(`હલકો: ${halqa}   તારીખ: ${dateStr}`, CANVAS_WIDTH / 2, y);

  // 3. Section "સ્ટુડન્ટ આંકડા": Two-column table
  y += 44;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.fillText('સ્ટુડન્ટ આંકડા', MARGIN_LEFT, y);

  y += 8;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(MARGIN_LEFT, y, CONTENT_WIDTH, 1.5);
  y += 18;

  // 7 Stats + Total Students arranged in 2 columns
  const leftStats: [string, number][] = [
    ['કુલ સ્ટુડન્ટની સંખ્યા', totalStudents],
    [t('stat.std_10' as any), stats.std_10 || 0],
    [t('stat.std_11' as any), stats.std_11 || 0],
    [t('stat.std_12' as any), stats.std_12 || 0],
  ];

  const rightStats: [string, number][] = [
    [t('stat.college' as any), stats.college || 0],
    [t('stat.engineering' as any), stats.engineering || 0],
    [t('stat.medical' as any), stats.medical || 0],
    [t('stat.muslim_teachers' as any), stats.muslim_teachers || 0],
  ];

  const col1X = MARGIN_LEFT;
  const col1ValX = MARGIN_LEFT + 400;
  const col2X = MARGIN_LEFT + 560;
  const col2ValX = MARGIN_LEFT + 980;

  const statRowH = 30;
  for (let i = 0; i < 4; i++) {
    const rowY = y + (i * statRowH);

    // Subtle alternate row tint
    if (i % 2 === 0) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(MARGIN_LEFT, rowY - 18, CONTENT_WIDTH, statRowH);
    }

    // Left Stat
    const [lLabel, lVal] = leftStats[i];
    ctx.fillStyle = i === 0 ? '#0F172A' : '#475569';
    ctx.font = i === 0 ? `bold 16px ${FONT_FAMILY}` : `500 16px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(lLabel, col1X + 12, rowY + 3);

    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(lVal), col1ValX, rowY + 3);

    // Right Stat
    const [rLabel, rVal] = rightStats[i];
    ctx.fillStyle = '#475569';
    ctx.font = `500 16px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(rLabel, col2X + 12, rowY + 3);

    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(rVal), col2ValX, rowY + 3);
  }

  y += (4 * statRowH) + 24;

  // 4. Section "પ્રવૃત્તિ સારાંશ": Bordered 4-column table
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.fillText('પ્રવૃત્તિ સારાંશ', MARGIN_LEFT, y);

  y += 8;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(MARGIN_LEFT, y, CONTENT_WIDTH, 1.5);
  y += 18;

  // 4 Columns ~ 45% (495px), 18% (198px), 18% (198px), 19% (209px)
  const COL_W = [495, 198, 198, 209];
  const COL_X = [
    MARGIN_LEFT,
    MARGIN_LEFT + COL_W[0],
    MARGIN_LEFT + COL_W[0] + COL_W[1],
    MARGIN_LEFT + COL_W[0] + COL_W[1] + COL_W[2]
  ];

  // Table Header Row
  const headerH = 38;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH);

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH);

  // Vertical header dividers
  for (let c = 1; c < 4; c++) {
    ctx.beginPath();
    ctx.moveTo(COL_X[c], y);
    ctx.lineTo(COL_X[c], y + headerH);
    ctx.stroke();
  }

  const headerTitles = ['પ્રવૃત્તિ', t('header.gujishta' as any), t('header.azaim' as any), t('header.maujuda' as any)];
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 16px ${FONT_FAMILY}`;

  // Col 0: Activity header left-aligned
  ctx.textAlign = 'left';
  ctx.fillText(headerTitles[0], COL_X[0] + 16, y + 24);

  // Cols 1, 2, 3: Centered
  ctx.textAlign = 'center';
  for (let c = 1; c < 4; c++) {
    ctx.fillText(headerTitles[c], COL_X[c] + (COL_W[c] / 2), y + 24);
  }

  y += headerH;

  // 13 Activity Rows
  const rowH = 36;
  ctx.lineWidth = 1;

  for (let idx = 0; idx < 13; idx++) {
    const isEven = idx % 2 === 0;
    ctx.fillStyle = isEven ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(MARGIN_LEFT, y, CONTENT_WIDTH, rowH);

    // Border around cell
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(MARGIN_LEFT, y, CONTENT_WIDTH, rowH);

    // Vertical column borders
    for (let c = 1; c < 4; c++) {
      ctx.beginPath();
      ctx.moveTo(COL_X[c], y);
      ctx.lineTo(COL_X[c], y + rowH);
      ctx.stroke();
    }

    if (idx < 12) {
      const key = ACTIVITY_KEYS[idx];
      const act = activities[key];
      const activityTitle = `${idx + 1}. ${t(key as any)}`;

      // Col 0: Activity title
      ctx.fillStyle = '#1E293B';
      ctx.font = `500 15px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(activityTitle, COL_X[0] + 14, y + 23);

      // Col 1, 2, 3: Numeric/value cells centered
      ctx.fillStyle = '#334155';
      ctx.font = `600 15px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(act?.gujishta || '-', COL_X[1] + (COL_W[1] / 2), y + 23);
      ctx.fillText(act?.azaim || '-', COL_X[2] + (COL_W[2] / 2), y + 23);
      ctx.fillText(act?.maujuda || '-', COL_X[3] + (COL_W[3] / 2), y + 23);
    } else {
      // 13th Row: activity.mashwara_when_where
      const act13 = activities['mashwara'];
      const title13 = `13. ${t('activity.mashwara_when_where' as any)}`;

      ctx.fillStyle = '#0F172A';
      ctx.font = `bold 15px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(title13, COL_X[0] + 14, y + 23);

      ctx.fillStyle = '#334155';
      ctx.font = `500 15px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(act13?.gujishta || '-', COL_X[1] + (COL_W[1] / 2), y + 23);
      ctx.fillText(act13?.azaim || '-', COL_X[2] + (COL_W[2] / 2), y + 23);
      ctx.fillText(act13?.maujuda || '-', COL_X[3] + (COL_W[3] / 2), y + 23);
    }

    y += rowH;
  }

  y += 24;

  // 5. Sections "મશવારો" & "ખાસ નોંધ"
  // Check if we have room on page 1 (need at least ~140px before footer)
  if (y + 160 > 1650) {
    // Break to page 2
    const page2 = createPageCanvas();
    pageCanvases.push(page2.canvas);
    ctx = page2.ctx;
    y = 90;

    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 26px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText('વિશેષ નોંધ અને મશવારો', MARGIN_LEFT, y);
    y += 12;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(MARGIN_LEFT, y, CONTENT_WIDTH, 1.5);
    y += 28;
  }

  // Section "મશવારો"
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText('મશવારો ક્યારે અને ક્યાં:', MARGIN_LEFT, y);
  y += 22;

  ctx.fillStyle = '#334155';
  ctx.font = `16px ${FONT_FAMILY}`;
  const mashwaraLines = wrapText(ctx, mashwaraVal, CONTENT_WIDTH);
  for (const line of mashwaraLines) {
    ctx.fillText(line, MARGIN_LEFT, y);
    y += 24;
  }

  y += 16;

  // Section "ખાસ નોંધ"
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText('ખાસ નોંધ:', MARGIN_LEFT, y);
  y += 22;

  ctx.fillStyle = '#334155';
  ctx.font = `16px ${FONT_FAMILY}`;
  const noteLines = wrapText(ctx, notesVal, CONTENT_WIDTH);
  for (const line of noteLines) {
    // Guard against overflowing the second page too
    if (y > 1640) break;
    ctx.fillText(line, MARGIN_LEFT, y);
    y += 24;
  }

  // Draw footers on all generated page canvases
  const totalPages = pageCanvases.length;
  pageCanvases.forEach((c, idx) => {
    const pageCtx = c.getContext('2d')!;
    drawFooter(pageCtx, idx + 1, totalPages);
  });

  // Embed pages into jsPDF as crisp PNG images (2x scale)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  pageCanvases.forEach((c, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait');
    const imgData = c.toDataURL('image/png', 0.95);
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  return doc.output('blob');
}
