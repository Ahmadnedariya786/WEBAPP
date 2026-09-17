import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { processImageFile } from './imageUtils';
import { ReviewOverlay } from './ReviewOverlay';
import type { ExtractedReport, ReviewData, ColumnHeaderDef, EditableActivityRow } from './types';
import { t } from '../../i18n';

interface ScanPillsProps {
  onFill: (reviewData: ReviewData) => void;
  showToast: (msg: string) => void;
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
  const [scanStage, setScanStage] = useState<'idle' | 'compressing' | 'scanning'>('idle');
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isScanning = scanStage !== 'idle';

  // N1: Reset scanStage to idle on native cancel event
  useEffect(() => {
    const handleCancel = () => {
      setScanStage('idle');
      setIsLargeFile(false);
    };

    const cam = cameraInputRef.current;
    const gal = galleryInputRef.current;

    cam?.addEventListener('cancel', handleCancel);
    gal?.addEventListener('cancel', handleCancel);

    return () => {
      cam?.removeEventListener('cancel', handleCancel);
      gal?.removeEventListener('cancel', handleCancel);
    };
  }, []);

  const processAndScan = async (file: File) => {
    if (!file) {
      setScanStage('idle');
      return;
    }

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('ઇન્ટરનેટ કનેક્શન જરૂરી છે ❌');
      setScanStage('idle');
      return;
    }

    const large = file.size > 5 * 1024 * 1024;
    setIsLargeFile(large);
    setScanStage('compressing');

    try {
      // Stage 1: EXIF normalize + compress max 1200px JPEG q0.75
      const processed = await processImageFile(file);

      // Stage 2: Call /api/scan-extract with AbortController 30s timeout & single retry
      setScanStage('scanning');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000);

      let extracted: ExtractedReport | null = null;
      let lastError: any = null;

      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (controller.signal.aborted) {
            break;
          }

          try {
            const response = await fetch('/api/scan-extract', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                image: processed.base64,
                mimeType: processed.mimeType
              }),
              signal: controller.signal
            });

            if (!response.ok) {
              let errJson: any = null;
              try {
                errJson = await response.json();
              } catch {
                errJson = { status: response.status, statusText: response.statusText };
              }
              throw new Error(errJson?.detail || errJson?.code || `API response not ok: ${response.status}`);
            }

            extracted = await response.json();
            break; // Succeeded!
          } catch (err: any) {
            lastError = err;
            if (controller.signal.aborted) {
              // Timeout reached (30s)
              break;
            }
            // Retry once on network error or server failure after brief pause
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 300));
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (!extracted) {
        throw lastError || new Error('Scan extraction failed');
      }

      const parsedReviewData = transformExtractionToReviewData(extracted, currentHalqas);

      setReviewData(parsedReviewData);
      setIsOverlayOpen(true);
    } catch (err: any) {
      console.error('Scan & extract failure:', err);
      showToast('સ્કેન નિષ્ફળ ❌ — સાફ રોશનીમાં ફોટો લઈને ફરી પ્રયત્ન કરો');
    } finally {
      // N1: Reset scanStage to 'idle' in finally-block covering success, error, and cancel paths
      setScanStage('idle');
      setIsLargeFile(false);
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
      const matched = halqas.some(h => h.trim().replace(/\s+/g, '') === normExtracted);
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

  const getSpinnerText = () => {
    if (scanStage === 'compressing') {
      return isLargeFile ? 'કમ્પ્રેસ થઈ રહ્યું છે...' : 'ફોટો તૈયાર થઈ રહ્યો છે...';
    }
    if (scanStage === 'scanning') {
      return 'સ્કેન થઈ રહ્યું છે...';
    }
    return '';
  };

  return (
    <div className="w-full space-y-1.5" id="scan-fill-module">
      {/* Hidden file inputs for Camera & Gallery (never display:none for mobile browser compatibility) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        id="camera-scan-input"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) processAndScan(e.target.files[0]);
          e.target.value = '';
        }}
        disabled={isScanning}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        id="gallery-scan-input"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) processAndScan(e.target.files[0]);
          e.target.value = '';
        }}
        disabled={isScanning}
      />

      {/* Two Trigger Pills: Equal Height (items-stretch, min-h-[56px]) */}
      <div className="flex items-stretch gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (isScanning) return;
            cameraInputRef.current?.click();
          }}
          disabled={isScanning}
          id="btn-camera-scan"
          aria-label="કેમેરાથી સ્કાન"
          className="flex-1 min-h-[56px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-card hover:bg-card/90 active:scale-[0.98] border border-brd/30 shadow-sm text-txt font-gujarati text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none text-center cursor-pointer"
        >
          {isScanning ? (
            <Loader2 size={16} className="animate-spin text-acc shrink-0" />
          ) : (
            <Camera size={16} className="text-acc shrink-0" />
          )}
          <span>{isScanning ? getSpinnerText() : 'કેમેરાથી સ્કાન'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isScanning) return;
            galleryInputRef.current?.click();
          }}
          disabled={isScanning}
          id="btn-gallery-scan"
          aria-label="ગેલરીથી ઇમ્પોર્ટ"
          className="flex-1 min-h-[56px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-card hover:bg-card/90 active:scale-[0.98] border border-brd/30 shadow-sm text-txt font-gujarati text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none text-center cursor-pointer"
        >
          {isScanning ? (
            <Loader2 size={16} className="animate-spin text-acc shrink-0" />
          ) : (
            <ImageIcon size={16} className="text-acc shrink-0" />
          )}
          <span>{isScanning ? getSpinnerText() : 'ગેલરીથી ઇમ્પોર્ટ'}</span>
        </button>
      </div>

      {/* Mandatory Hint Text */}
      <p className="text-xs text-sub text-center font-gujarati tracking-wide select-none">
        પૂરું પેજ, સાફ રોશની, છાયા વિના
      </p>

      {/* Review Bottom Sheet Overlay */}
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
