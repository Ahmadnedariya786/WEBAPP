import React, { useRef, useState } from 'react';
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
  const [isScanning, setIsScanning] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset file input so same file can be selected again
    e.target.value = '';
    if (!file) return;

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('ઇન્ટરનેટ કનેક્શન જરૂરી છે ❌');
      return;
    }

    setIsScanning(true);

    try {
      // Step 1: EXIF normalize + compress max 1600px JPEG q0.8
      const processed = await processImageFile(file);

      // Step 2: Call /api/scan-extract
      const response = await fetch('/api/scan-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: processed.base64,
          mimeType: processed.mimeType
        })
      });

      if (!response.ok) {
        throw new Error('API response not ok: ' + response.status);
      }

      const extracted: ExtractedReport = await response.json();
      const parsedReviewData = transformExtractionToReviewData(extracted, currentHalqas);

      setReviewData(parsedReviewData);
      setIsOverlayOpen(true);
    } catch (err: any) {
      console.error('Scan & extract failure:', err);
      showToast('સ્કેન નિષ્ફળ ❌ — સાફ રોશનીમાં ફોટો લઈને ફરી પ્રયત્ન કરો');
    } finally {
      setIsScanning(false);
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

  return (
    <div className="w-full space-y-1.5" id="scan-fill-module">
      {/* Hidden file inputs for Camera & Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        id="camera-scan-input"
        onChange={handleFileSelected}
        disabled={isScanning}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        id="gallery-scan-input"
        onChange={handleFileSelected}
        disabled={isScanning}
      />

      {/* Two Trigger Pills */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isScanning}
          id="btn-camera-scan"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-card hover:bg-card/90 active:scale-[0.98] border border-brd/30 shadow-sm text-txt font-gujarati text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {isScanning ? (
            <Loader2 size={16} className="animate-spin text-acc shrink-0" />
          ) : (
            <Camera size={16} className="text-acc shrink-0" />
          )}
          <span>{isScanning ? 'પ્રોસેસિંગ...' : 'કેમેરાથી સ્કાન'}</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={isScanning}
          id="btn-gallery-scan"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-card hover:bg-card/90 active:scale-[0.98] border border-brd/30 shadow-sm text-txt font-gujarati text-sm font-semibold transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          {isScanning ? (
            <Loader2 size={16} className="animate-spin text-acc shrink-0" />
          ) : (
            <ImageIcon size={16} className="text-acc shrink-0" />
          )}
          <span>{isScanning ? 'પ્રોસેસિંગ...' : 'ગેલરીથી ઇમ્પોર્ટ'}</span>
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
