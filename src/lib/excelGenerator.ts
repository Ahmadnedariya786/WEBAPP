/**
 * excelGenerator.ts
 * S50-MASTER — Styled Excel Generator using xlsx-js-style
 * 
 * Provides professional layout and cell styling for:
 *   - NewReport single report export
 *   - PastReports single report export
 *   - PastReports all reports multi-sheet export
 * 
 * Complies with D3 requirements:
 *   - A1:D1 merged, bold 14, centered report title
 *   - Row 2: "હલકો:" bold + value | "તારીખ:" bold + value
 *   - Stats block: bold section label + label/value rows
 *   - Activities table: bold header row with light gray fill + thin borders on header & all 13 rows
 *   - Column widths: A=45, B/C/D=14 (!cols)
 *   - Freeze panes at activities header
 *   - "મશવારો" / "ખાસ નોંધ" bold labels with their values
 *   - Sheet name "રિપોર્ટ" unchanged, all data verbatim
 */

import XLSX from 'xlsx-js-style';
import { t } from '../i18n';
import { formatDate } from './utils';

export interface ReportExportData {
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

// Reusable styling tokens
const STYLES = {
  title: {
    font: { bold: true, sz: 14, name: 'Calibri', color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'F8FAFC' } }
  },
  metaLabel: {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '1E293B' } },
    alignment: { vertical: 'center' }
  },
  metaValue: {
    font: { sz: 11, name: 'Calibri', color: { rgb: '334155' } },
    alignment: { vertical: 'center' }
  },
  sectionHeader: {
    font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { vertical: 'center' }
  },
  statLabel: {
    font: { sz: 11, name: 'Calibri', color: { rgb: '334155' } },
    alignment: { vertical: 'center' }
  },
  statValue: {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  },
  tableHeader: {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } }
    }
  },
  activityName: {
    font: { sz: 11, name: 'Calibri', color: { rgb: '1E293B' } },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  },
  activityCell: {
    font: { sz: 11, name: 'Calibri', color: { rgb: '334155' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  },
  noteLabel: {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '1E293B' } },
    alignment: { vertical: 'center' }
  },
  noteValue: {
    font: { sz: 11, name: 'Calibri', color: { rgb: '334155' } },
    alignment: { vertical: 'center' }
  }
};

/**
 * Builds a styled worksheet for a single report.
 */
export function buildReportSheet(report: ReportExportData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  const halqa = report.halqa || '-';
  const dateStr = formatDate(report.date || '');
  const stats = report.stats || {};
  const totalStudents = report.totalStudents !== undefined 
    ? report.totalStudents 
    : ((stats.std_10 || 0) + (stats.std_11 || 0) + (stats.std_12 || 0) + (stats.college || 0));
  const activities = report.activities || {};
  const mashwaraVal = report.mashwara || activities['mashwara']?.maujuda || '-';
  const notesVal = report.notes || '-';

  // Helper to set styled cell
  const setCell = (col: number, row: number, value: any, style: any, type: 's' | 'n' = 's') => {
    const ref = XLSX.utils.encode_cell({ c: col, r: row });
    ws[ref] = {
      v: value,
      t: typeof value === 'number' ? 'n' : type,
      s: style
    };
  };

  let r = 0;

  // Row 1: Merged Title (A1:D1)
  setCell(0, r, 'બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ', STYLES.title);
  setCell(1, r, '', STYLES.title);
  setCell(2, r, '', STYLES.title);
  setCell(3, r, '', STYLES.title);
  r++;

  // Row 2: Halqa & Date
  setCell(0, r, 'હલકો:', STYLES.metaLabel);
  setCell(1, r, halqa, STYLES.metaValue);
  setCell(2, r, 'તારીખ:', STYLES.metaLabel);
  setCell(3, r, dateStr, STYLES.metaValue);
  r++;

  // Row 3: Blank separator
  r++;

  // Row 4: Student Stats Section Header
  setCell(0, r, 'સ્ટુડન્ટ આંકડા', STYLES.sectionHeader);
  setCell(1, r, '', STYLES.sectionHeader);
  setCell(2, r, '', STYLES.sectionHeader);
  setCell(3, r, '', STYLES.sectionHeader);
  r++;

  // Rows 5-12: Stats rows
  const statList: [string, number][] = [
    ['કુલ સ્ટુડન્ટની સંખ્યા', totalStudents],
    [t('stat.std_10' as any), stats.std_10 || 0],
    [t('stat.std_11' as any), stats.std_11 || 0],
    [t('stat.std_12' as any), stats.std_12 || 0],
    [t('stat.college' as any), stats.college || 0],
    [t('stat.engineering' as any), stats.engineering || 0],
    [t('stat.medical' as any), stats.medical || 0],
    [t('stat.muslim_teachers' as any), stats.muslim_teachers || 0]
  ];

  statList.forEach(([label, val]) => {
    setCell(0, r, label, STYLES.statLabel);
    setCell(1, r, val, STYLES.statValue, 'n');
    r++;
  });

  // Blank separator before activities table
  r++;

  // Activities Table Header Row (index saved for freeze pane)
  const activitiesHeaderRow = r;
  setCell(0, r, 'પ્રવૃત્તિ', STYLES.tableHeader);
  setCell(1, r, t('header.gujishta' as any), STYLES.tableHeader);
  setCell(2, r, t('header.azaim' as any), STYLES.tableHeader);
  setCell(3, r, t('header.maujuda' as any), STYLES.tableHeader);
  r++;

  // 13 Activity Rows (12 from ACTIVITY_KEYS + 13th row activity.mashwara_when_where)
  ACTIVITY_KEYS.forEach((key, idx) => {
    const act = activities[key];
    const rankLabel = `${idx + 1}. ${t(key as any)}`;
    setCell(0, r, rankLabel, STYLES.activityName);
    setCell(1, r, act?.gujishta || '-', STYLES.activityCell);
    setCell(2, r, act?.azaim || '-', STYLES.activityCell);
    setCell(3, r, act?.maujuda || '-', STYLES.activityCell);
    r++;
  });

  // Row 13: activity.mashwara_when_where
  const act13 = activities['mashwara'];
  const rank13Label = `13. ${t('activity.mashwara_when_where' as any)}`;
  setCell(0, r, rank13Label, STYLES.activityName);
  setCell(1, r, act13?.gujishta || '-', STYLES.activityCell);
  setCell(2, r, act13?.azaim || '-', STYLES.activityCell);
  setCell(3, r, act13?.maujuda || '-', STYLES.activityCell);
  r++;

  // Blank separator before notes
  r++;

  // Sections: "મશવારો" & "ખાસ નોંધ"
  setCell(0, r, 'મશવારો:', STYLES.noteLabel);
  setCell(1, r, mashwaraVal, STYLES.noteValue);
  r++;

  setCell(0, r, 'ખાસ નોંધ:', STYLES.noteLabel);
  setCell(1, r, notesVal, STYLES.noteValue);
  r++;

  // Set worksheet range
  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 3, r } });

  // Column widths: A=45, B/C/D=14
  ws['!cols'] = [
    { wch: 45 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 }
  ];

  // A1:D1 merge
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
  ];

  // Freeze panes at activities header
  ws['!views'] = [
    { state: 'frozen', xSplit: 0, ySplit: activitiesHeaderRow + 1 }
  ];

  return ws;
}

/**
 * Builds a complete WorkBook for a single report.
 */
export function buildReportWorkbook(report: ReportExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = buildReportSheet(report);
  XLSX.utils.book_append_sheet(wb, ws, 'રિપોર્ટ');
  return wb;
}

/**
 * Builds a complete WorkBook containing all reports as separate styled sheets.
 */
export function buildAllReportsWorkbook(reports: ReportExportData[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  reports.forEach((report) => {
    const ws = buildReportSheet(report);
    const rawName = `${report.halqa || 'report'}_${report.date || ''}`;
    // Sheet name max 31 chars in Excel
    const sheetName = rawName.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  return wb;
}

/**
 * Serializes a workbook to an ArrayBuffer using xlsx-js-style.
 */
export function writeReportWorkbookToBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}
