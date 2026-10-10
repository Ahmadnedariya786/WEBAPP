import React, { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { processImageFile, UnsupportedFormatError } from './imageUtils';
import { runSelfContainedOcr, resetOcrWorker } from './ocrClient';
import { ReviewOverlay } from './ReviewOverlay';
import type { ExtractedReport, ReviewData, ColumnHeaderDef, EditableActivityRow } from './types';
import { t } from '../../i18n';
import { logActivity } from '../../lib/utils';

interface ScanPillsProps {
  onFill: (reviewData: ReviewData) => void;
  showToast: (msg: string, isError?: boolean) => void;
  currentHalqas: string[];
}

const ACTIVITY_NAMES: Record<number, string> = {
  1: 'નમાઝોની પાબંદી',
  2: 'મશવરાની પાબંદી',
  3: 'તાલીમની પાબંદી',
  4: 'ગશતની પાબંદી',
  5: 'પંચકોસા પાબંદી',
  6: 'શબગુજારી',
  7: 'મુલાકાત કેટલી થઈ (%)',
  8: 'કેટલી સ્કૂલો/કોલેજમાં નમાઝ શરૂ થઈ',
  9: '૩ દિન જમાઅતો',
  10: '૧૦ દિનની જમાઅતો',
  11: '૪૦ દિનની જમાઅતો',
  12: '૪ માહની જમાઅતો',
  13: 'મશવારો ક્યારે અને ક્યાં'
};

export const ScanPills: React.FC<ScanPillsProps> = ({
  onFill,
  showToast,
  currentHalqas
}) => {
  const [scanStage, setScanStage] = useState<'idle' | 'scanning'>('idle');
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isScanning = scanStage === 'scanning';

  // Reset scanStage to idle on native cancel event
  useEffect(() => {
    const handleCancel = () => {
      setScanStage('idle');
    };

    const gal = galleryInputRef.current;
    gal?.addEventListener('cancel', handleCancel);

    return () => {
      gal?.removeEventListener('cancel', handleCancel);
    };
  }, []);

  const processAndScan = async (file: File) => {
    if (!file) {
      setScanStage('idle');
      return;
    }

    setScanStage('scanning');

    try {
      // Stage 1: Preprocessing — downscaled to max 1600px on canvas (F2)
      let processed;
      try {
        processed = await processImageFile(file, 'gallery');
      } catch (err: any) {
        if (err instanceof UnsupportedFormatError || err?.isFormatError || err?.message === 'ફોટો ફોર્મેટ સપોર્ટેડ નથી') {
          showToast('ફોટો ફોર્મેટ સપોર્ટેડ નથી', true);
          return;
        }
        throw err;
      }

      // Stage 2: Self-contained OCR with automatic single retry (F1 & F3)
      let extracted: ExtractedReport | null = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          extracted = await runSelfContainedOcr(processed.canvas, currentHalqas);
          break; // Succeeded!
        } catch (err: any) {
          lastError = err;
          console.warn(`[ScanPath] OCR attempt ${attempt + 1} failed:`, err);
          if (attempt === 0) {
            await resetOcrWorker();
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      if (!extracted) {
        throw lastError || new Error('Scan extraction failed');
      }

      const parsedReviewData = transformExtractionToReviewData(extracted, currentHalqas);

      setReviewData(parsedReviewData);
      setIsOverlayOpen(true);
    } catch (err: any) {
      console.error('[ScanPath] gallery error:', err);
      // F3: Determine short real reason: engine / network / memory / timeout
      const errMsg = (err?.message || err?.toString() || '').toLowerCase();
      let reason = 'engine';
      if (errMsg.includes('memory') || errMsg.includes('allocation') || errMsg.includes('heap') || errMsg.includes('quota')) {
        reason = 'memory';
      } else if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('offline') || errMsg.includes('download')) {
        reason = 'network';
      } else if (errMsg.includes('timeout') || errMsg.includes('aborted')) {
        reason = 'timeout';
      } else if (errMsg.includes('engine') || errMsg.includes('worker') || errMsg.includes('wasm') || errMsg.includes('tesseract')) {
        reason = 'engine';
      }

      const failMsg = `સ્કેન નિષ્ફળ: ${reason}`;
      showToast(failMsg, true);
      logActivity(failMsg);
    } finally {
      // Reset scanStage to 'idle' covering success, error, and format errors
      setScanStage('idle');
    }
  };

  const transformExtractionToReviewData = (
    ext: ExtractedReport,
    halqas: string[]
  ): ReviewData => {
    // Column keys for N4
    const columnKeys: ColumnHeaderDef[] = [
      { key: 'gujishata', label: t('header.gujishta' as any) || 'ગુજિશતા' },
      { key: 'agraaham', label: t('header.azaim' as any) || 'અઝાઇમ' },
      { key: 'mojuda', label: t('header.maujuda' as any) || 'મોજૂદા' }
    ];

    // Map stats
    const stats: Record<string, { v: string; ok: boolean }> = {
      student_count: { v: ext.student_count?.v || '', ok: ext.student_count?.ok ?? true },
      std10: { v: ext.std10?.v || '', ok: ext.std10?.ok ?? true },
      std11: { v: ext.std11?.v || '', ok: ext.std11?.ok ?? true },
      std12: { v: ext.std12?.v || '', ok: ext.std12?.ok ?? true },
      college: { v: ext.college?.v || '', ok: ext.college?.ok ?? true },
      engineer: { v: ext.engineer?.v || '', ok: ext.engineer?.ok ?? true },
      medical: { v: ext.medical?.v || '', ok: ext.medical?.ok ?? true },
      muslim_teachers: { v: ext.muslim_teachers?.v || '', ok: ext.muslim_teachers?.ok ?? true }
    };

    // 13 Activities map
    const activitiesMap = new Map<number, any>();
    if (Array.isArray(ext.activities)) {
      ext.activities.forEach(act => {
        if (act && act.no) {
          activitiesMap.set(act.no, act);
        }
      });
    }

    const activities: EditableActivityRow[] = [];
    for (let no = 1; no <= 13; no++) {
      const act = activitiesMap.get(no);
      const cols: Record<string, { v: string; ok: boolean }> = {
        gujishata: { v: act?.gujishata?.v || '', ok: act?.gujishata?.ok ?? true },
        agraaham: { v: act?.agraaham?.v || '', ok: act?.agraaham?.ok ?? true },
        mojuda: { v: act?.mojuda?.v || '', ok: act?.mojuda?.ok ?? true }
      };

      // Handle top-level shortcuts if act rows were empty
      if (no === 7 && ext.mulakat_percent?.v && !cols.gujishata.v) {
        cols.gujishata = { v: ext.mulakat_percent.v, ok: ext.mulakat_percent.ok };
      }
      if (no === 8 && ext.schools_prayer?.v && !cols.gujishata.v) {
        cols.gujishata = { v: ext.schools_prayer.v, ok: ext.schools_prayer.ok };
      }
      if (no === 9 && ext.jamat_3din?.v && !cols.gujishata.v) {
        cols.gujishata = { v: ext.jamat_3din.v, ok: ext.jamat_3din.ok };
      }
      if (no === 10 && ext.jamat_10din?.v && !cols.gujishata.v) {
        cols.gujishata = { v: ext.jamat_10din.v, ok: ext.jamat_10din.ok };
      }

      activities.push({
        no,
        key: `act_${no}`,
        name: ACTIVITY_NAMES[no] || `પ્રવૃત્તિ ${no}`,
        cols
      });
    }

    // Identify skipped columns: columns detected in paper that don't match any registered halqa
    const skipped_columns: string[] = [];
    if (ext.skipped_columns && Array.isArray(ext.skipped_columns)) {
      skipped_columns.push(...ext.skipped_columns);
    }
    // Also check if extracted halqa_name matches any known halqa
    const extractedHalqa = ext.halqa_name?.v?.trim();
    if (extractedHalqa) {
      const normExtracted = extractedHalqa.replace(/\s+/g, '');
      const matched = halqas.some(h => (typeof h === 'string' ? h : (h as any)?.name || '').trim().replace(/\s+/g, '') === normExtracted);
      if (!matched && !skipped_columns.includes(extractedHalqa)) {
        // Not matched with registered halqas
        skipped_columns.push(extractedHalqa);
      }
    }

    return {
      halqa_name: {
        v: ext.halqa_name?.v || '',
        ok: ext.halqa_name?.ok ?? true
      },
      stats,
      columnKeys,
      activities,
      skipped_columns
    };
  };

  const handleConfirmFill = (data: ReviewData) => {
    setIsOverlayOpen(false);
    onFill(data);
  };

  return (
    <div className="w-full space-y-1.5" id="scan-fill-module">
      {/* Hidden file input for Gallery only */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        id="gallery-scan-input"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            processAndScan(file);
          }
          e.target.value = '';
        }}
        disabled={isScanning}
      />

      {/* Single full-width Gallery Trigger Button: min-h-[56px] */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => {
            if (isScanning) return;
            galleryInputRef.current?.click();
          }}
          disabled={isScanning}
          id="btn-gallery-scan"
          aria-label="ગેલરીથી ઇમ્પોર્ટ"
          className="w-full min-h-[56px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-card hover:bg-card/90 active:scale-[0.98] border border-brd/30 shadow-sm text-txt font-gujarati text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none text-center cursor-pointer"
        >
          {isScanning ? (
            <Loader2 size={16} className="animate-spin text-acc shrink-0" />
          ) : (
            <ImageIcon size={16} className="text-acc shrink-0" />
          )}
          <span>{isScanning ? 'સ્કેન થઈ રહ્યું છે...' : 'ગેલરીથી ઇમ્પોર્ટ'}</span>
        </button>
      </div>

      {/* Mandatory Hint Text */}
      <p className="text-xs text-sub text-center font-gujarati tracking-wide select-none">
        પૂરું પેજ, સાફ રોશની, છાયા વિના
      </p>

      {/* Review Modal Dialog Overlay */}
      {reviewData && (
        <ReviewOverlay
          isOpen={isOverlayOpen}
          onClose={() => setIsOverlayOpen(false)}
          initialData={reviewData}
          onConfirmFill={handleConfirmFill}
        />
      )}
    </div>
  );
};
