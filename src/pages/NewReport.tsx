import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../i18n';
import { PageHeading } from '../components/ui/PageHeading';
import { 
  Calendar, Save, Trash2, Download, Share2, CheckCircle, 
  Plus, X, Copy, Lock, RotateCcw, Check, ListChecks 
} from 'lucide-react';
import { cn, formatDate, localTodayIso } from '../lib/utils';
import { isDuplicateReportError, mapSupabaseError } from '../services/supabaseService';
import { ScanPills } from '../components/ScanFill';
import { NeumorphicCalendarDialog } from '../components/ui/NeumorphicCalendarDialog';
import { useOverlayScrollLock } from '../lib/useOverlayScrollLock';

// Constants
const ACTIVITY_KEYS = [
  'activity.namaz', 'activity.mashwara_pabandi', 'activity.taleem', 'activity.gasht',
  'activity.panchkosa', 'activity.shabguzari', 'activity.mulaqat_percent', 'activity.school_namaz',
  'activity.jamaat_3', 'activity.jamaat_10', 'activity.jamaat_40', 'activity.jamaat_4m'
];

const KPI_KEYS: { key: keyof typeof initialStats; label: string }[] = [
  { key: 'std_10', label: 'ધોરણ ૧૦' },
  { key: 'std_11', label: 'ધોરણ ૧૧' },
  { key: 'std_12', label: 'ધોરણ ૧૨' },
  { key: 'college', label: 'કોલેજ' },
  { key: 'engineering', label: 'એન્જિનિયર' },
  { key: 'medical', label: 'મેડિકલ' }
];

const initialStats = {
  std_10: 0,
  std_11: 0,
  std_12: 0,
  college: 0,
  engineering: 0,
  medical: 0,
  muslim_teachers: 0
};

export const NewReport: React.FC = () => {
  const { 
    draftReport, setDraftReport, clearDraft, halqas, customHalqas, 
    addCustomHalqa, removeCustomHalqa, addReport, sessionRole 
  } = useAppStore();
  
  // Toasts
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Scan & Fill State
  const [recentlyFilledKeys, setRecentlyFilledKeys] = useState<Set<string>>(new Set());
  const [undoSnapshot, setUndoSnapshot] = useState<any | null>(null);
  const undoTimeoutRef = useRef<any>(null);

  // Form State
  const [halqa, setHalqa] = useState('');
  const [date, setDate] = useState(() => sessionStorage.getItem('currentDate') || localTodayIso());
  
  useEffect(() => {
    sessionStorage.setItem('currentDate', date);
  }, [date]);

  const [stats, setStats] = useState(initialStats);
  const [activities, setActivities] = useState<Record<string, { gujishta: string, azaim: string, maujuda: string }>>({});
  const [mashwara, setMashwara] = useState('');
  const [notes, setNotes] = useState('');

  // Dialogs
  const [showHalqaDialog, setShowHalqaDialog] = useState(false);
  const [newHalqaName, setNewHalqaName] = useState('');
  const [halqaToDelete, setHalqaToDelete] = useState<string | null>(null);
  const [isAddingHalqa, setIsAddingHalqa] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useOverlayScrollLock({ isOpen: showHalqaDialog, onClose: () => setShowHalqaDialog(false) });
  useOverlayScrollLock({ isOpen: !!halqaToDelete, onClose: () => setHalqaToDelete(null) });
  useOverlayScrollLock({ isOpen: showClearConfirm, onClose: () => setShowClearConfirm(false) });

  // Save feedback state
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recentTileKey, setRecentTileKey] = useState<string | null>(null);

  // Total Students Calculation & Count-up Animation
  const totalStudents = stats.std_10 + stats.std_11 + stats.std_12 + stats.college;
  const [displayCount, setDisplayCount] = useState(totalStudents);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayCount(totalStudents);
      return;
    }
    const start = displayCount;
    const end = totalStudents;
    if (start === end) return;
    const duration = 400; // 400ms count-up
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(start + (end - start) * easeOut));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [totalStudents]);

  // Stepper completion calculation
  const stepperState = React.useMemo(() => {
    const isHalqaDone = !!halqa;
    const isDateDone = isHalqaDone && !!date;
    const isStatsDone = isHalqaDone && (totalStudents > 0 || stats.muslim_teachers > 0);
    const isNotesDone = isHalqaDone && notes.trim().length > 0;
    const isSaveReady = isHalqaDone && (isStatsDone || isNotesDone || Object.keys(activities).length > 0);

    return [
      {
        id: 1,
        label: 'હલકો',
        isDone: isHalqaDone,
        isCurrent: !isHalqaDone
      },
      {
        id: 2,
        label: 'તારીખ',
        isDone: isDateDone,
        isCurrent: isHalqaDone && !isStatsDone && !isNotesDone
      },
      {
        id: 3,
        label: 'ગણતરી',
        isDone: isStatsDone,
        isCurrent: isHalqaDone && isDateDone && !isStatsDone
      },
      {
        id: 4,
        label: 'નોંધ',
        isDone: isNotesDone,
        isCurrent: isHalqaDone && isStatsDone && !isNotesDone
      },
      {
        id: 5,
        label: 'સાચવો',
        isDone: saveSuccess,
        isCurrent: isSaveReady
      }
    ];
  }, [halqa, date, totalStudents, stats.muslim_teachers, notes, activities, saveSuccess]);

  // Actions
  const generateReportText = () => {
    return `બનાસકાંઠા સ્ટુડન્ટ મહેનત ટ્રેકર\nહલકો: ${halqa || '-'} | તારીખ: ${formatDate(date)}\nકુલ સ્ટુડન્ટ: ${totalStudents}\n\nપ્રવૃત્તિ સારાંશ:\n` + 
    ACTIVITY_KEYS.map(k => `${t(k as any)}: ${activities[k]?.maujuda || '-'}`).join('\n') + 
    `\nમશવારો: ${activities['mashwara']?.maujuda || '-'}\nખાસ નોંધ: ${notes}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText());
    showNotification('ટેક્સ્ટ કોપી થઈ ✅');
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generateReportText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleScanFill = (reviewData: any) => {
    const result = useAppStore.getState().fillFromScan(reviewData, halqas);

    if (result.matchedHalqa) {
      setHalqa(result.matchedHalqa);
    } else if (result.unmatchedHalqaName) {
      showNotification(`હલકો '${result.unmatchedHalqaName}' મળ્યો નથી — મેન્યુઅલી પસંદ કરો`);
    }

    if (result.newDraft.stats) {
      setStats(result.newDraft.stats);
    }
    if (result.newDraft.activities) {
      setActivities(result.newDraft.activities);
    }
    if (result.newDraft.mashwara) {
      setMashwara(result.newDraft.mashwara);
    }

    // Visual feedback: soft accent highlight for 2s
    setRecentlyFilledKeys(new Set(result.filledKeys));
    setTimeout(() => {
      setRecentlyFilledKeys(new Set());
    }, 2000);

    // Snapshot for Undo (30s lifetime or until save)
    setUndoSnapshot(result.preFillSnapshot);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setUndoSnapshot(null);
    }, 30000);

    showNotification('સ્કેન ડેટા ભરાયો ✅ — ચકાસીને સાચવો');
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    setHalqa(undoSnapshot.halqa || '');
    setStats(undoSnapshot.stats || initialStats);
    setActivities(undoSnapshot.activities || {});
    setMashwara(undoSnapshot.mashwara || '');
    setNotes(undoSnapshot.notes || '');
    setDraftReport(undoSnapshot);
    setUndoSnapshot(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    showNotification('ડ્રાફ્ટ પૂર્વવત્ થયો ↩️');
  };

  const handleSave = () => {
    if (!halqa) {
      showNotification('કૃપા કરીને હલકો પસંદ કરો ❌');
      return;
    }
    useAppStore.getState().requireAuth(async () => {
      try {
        await addReport({
          id: '',
          halqa,
          date,
          stats,
          activities,
          mashwara: activities['mashwara']?.maujuda || '',
          notes
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        showNotification('રિપોર્ટ સેવ થયો ✅');
        setUndoSnapshot(null);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setHalqa('');
        sessionStorage.removeItem('currentDate');
        setDate(localTodayIso());
        setStats(initialStats);
        setActivities({});
        setMashwara('');
        setNotes('');
        clearDraft();
      } catch (err) {
        console.error(err);
        if (isDuplicateReportError(err)) {
          showNotification('આ હલકા માટે આ તારીખનો રિપોર્ટ પહેલેથી છે — એડિટ કરો');
        } else {
          showNotification('ભૂલ આવી! સેવ ન થઈ શક્યું ❌');
        }
      }
    });
  };

  const confirmClear = () => {
    setUndoSnapshot(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setHalqa('');
    sessionStorage.removeItem('currentDate');
    setDate(localTodayIso());
    setStats(initialStats);
    setActivities({});
    setMashwara('');
    setNotes('');
    clearDraft();
    setShowClearConfirm(false);
    showNotification('ડ્રાફ્ટ ડિલીટ થયો ✅');
  };

  const handleDownloadExcel = () => {
    const rows: any[][] = [
      ["બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ"],
      ["હલકો:", halqa || '-', "તારીખ:", formatDate(date)],
      [],
      ["સ્ટુડન્ટ આંકડા"],
      ["કુલ સ્ટુડન્ટની સંખ્યા", totalStudents],
      [t('stat.std_10' as any), stats.std_10 || 0],
      [t('stat.std_11' as any), stats.std_11 || 0],
      [t('stat.std_12' as any), stats.std_12 || 0],
      [t('stat.college' as any), stats.college || 0],
      [t('stat.engineering' as any), stats.engineering || 0],
      [t('stat.medical' as any), stats.medical || 0],
      [t('stat.muslim_teachers' as any), stats.muslim_teachers || 0],
      [],
      ["પ્રવૃત્તિ", t('header.gujishta' as any), t('header.azaim' as any), t('header.maujuda' as any)]
    ];

    ACTIVITY_KEYS.forEach(k => {
      rows.push([
        t(k as any), 
        activities[k]?.gujishta || '-', 
        activities[k]?.azaim || '-', 
        activities[k]?.maujuda || '-'
      ]);
    });

    rows.push([]);
    rows.push(["મશવારો:", activities['mashwara']?.maujuda || '-']);
    rows.push(["ખાસ નોંધ:", notes || '-']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:32}, {wch:12}, {wch:12}, {wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "રિપોર્ટ");
    XLSX.writeFile(wb, `mehnat_${halqa || 'report'}_${date}.xlsx`);
    
    showNotification('Excel ફાઇલ ડાઉનલોડ થઈ ✅');
  };

  const handleDownloadPdf = () => {
    window.print();
    showNotification('PDF પ્રિન્ટ ડાયલોગ ખુલ્યો ✅');
  };

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Restore draft on mount
  useEffect(() => {
    if (draftReport && !halqa) {
      setHalqa(draftReport.halqa || '');
      setStats(draftReport.stats || stats);
      setActivities(draftReport.activities || {});
      setMashwara(draftReport.mashwara || '');
      setNotes(draftReport.notes || '');
      showNotification(t('toast.draft_restored' as any));
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      setDraftReport({ halqa, date, stats, activities, mashwara, notes });
    }, 1000);
    return () => clearTimeout(timer);
  }, [halqa, date, stats, activities, mashwara, notes, setDraftReport]);

  const handleStatChange = (key: keyof typeof stats, value: string) => {
    setRecentTileKey(key);
    setTimeout(() => setRecentTileKey(null), 200);
    setStats(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
  };

  const handleActivityChange = (rowKey: string, col: 'gujishta' | 'azaim' | 'maujuda', value: string) => {
    setActivities(prev => ({
      ...prev,
      [rowKey]: { ...(prev[rowKey] || { gujishta: '', azaim: '', maujuda: '' }), [col]: value }
    }));
  };

  const handleAddHalqa = async () => {
    if (!newHalqaName.trim() || isAddingHalqa) return;
    setIsAddingHalqa(true);
    try {
      await addCustomHalqa(newHalqaName.trim());
      await useAppStore.getState().loadData();
      setHalqa(newHalqaName.trim());
      setNewHalqaName('');
      setShowHalqaDialog(false);
      showNotification('હલકો ઉમેરાયો ✅');
    } catch (err: any) {
      const errorMsg = mapSupabaseError(err);
      if (errorMsg === 'આ નામનો હલકો પહેલેથી છે ✅') {
        await useAppStore.getState().loadData();
        setHalqa(newHalqaName.trim());
        setNewHalqaName('');
        setShowHalqaDialog(false);
        showNotification(errorMsg);
      } else {
        showNotification(errorMsg);
      }
    } finally {
      setIsAddingHalqa(false);
    }
  };

  const confirmDeleteHalqa = async () => {
    if (!halqaToDelete) return;
    const targetHalqa = halqas.find(h => h.name === halqaToDelete);
    const uuid = targetHalqa?.id || halqaToDelete;
    try {
      await removeCustomHalqa(uuid);
      await useAppStore.getState().loadData();
      showNotification('હલકો ડિલીટ થયો ✅');
      if (halqa === halqaToDelete) setHalqa('');
      setHalqaToDelete(null);
    } catch (err: any) {
      showNotification('ભૂલ આવી: ' + (err.message || 'અજ્ઞાત ભૂલ'));
    }
  };

  const ALL_HALQAS = halqas.map((h: any) => h.name);

  // Desktop table scrollbar autohide state
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);

  const handleTableScroll = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.classList.add('is-scrolling');
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (tableScrollRef.current) {
          tableScrollRef.current.classList.remove('is-scrolling');
        }
      }, 1200);
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // S41-MASTER Note N1: Single source of truth for BlockC (notes + action cluster)
  // Duplicated instances (desktop + mobile) bind to identical state with zero duplicate IDs
  const renderBlockC = (instanceKey: string) => (
    <div className="space-y-5" key={instanceKey}>
      {/* D4: Card 3 "ખાસ નોંધ" */}
      <div className="bg-card rounded-[20px] p-4 sm:p-5 border border-brd/30 shadow-sm space-y-2.5 new-report-card">
        <label className="font-gujarati text-[14px] font-bold text-txt block">
          ખાસ નોંધ
        </label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="ખાસ નોંધ"
          placeholder="અહીં લખો..."
          className="w-full app-input outline-none resize-none min-h-[72px] font-gujarati text-txt placeholder:text-sub/50 p-3 rounded-[14px] text-sm border border-brd/30 transition-all focus:border-acc"
        />
      </div>

      {/* D5: Action Cluster */}
      <div className="space-y-3 pt-1">
        {/* PRIMARY: "સાચવો" = Full-width 48px accent button */}
        <button
          type="button"
          onClick={() => { 
            if (!sessionRole) { 
              useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); 
              return; 
            } 
            handleSave(); 
          }}
          aria-label="સાચવો"
          className="action-cluster-primary-btn"
        >
          {!sessionRole ? (
            <Lock size={18} className="shrink-0" />
          ) : saveSuccess ? (
            <Check size={20} className="shrink-0 stroke-[3]" />
          ) : (
            <Save size={18} className="shrink-0" />
          )}
          <span className="font-gujarati font-bold text-base">સાચવો</span>
        </button>

        {/* SECONDARY: 2×2 icon-pill grid at ALL widths */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleWhatsApp}
            aria-label="WhatsApp પર શેર કરો"
            className="action-cluster-grid-btn"
          >
            <Share2 size={15} className="text-acc shrink-0" />
            <span className="font-gujarati">WhatsApp પર શેર કરો</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            aria-label="કૉપી કરો"
            className="action-cluster-grid-btn"
          >
            <Copy size={15} className="text-acc shrink-0" />
            <span className="font-gujarati">કૉપી કરો</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            aria-label="Excel ડાઉનલોડ કરો"
            className="action-cluster-grid-btn"
          >
            <Download size={15} className="text-acc shrink-0" />
            <span className="font-gujarati">Excel ડાઉનલોડ કરો</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            aria-label="PDF ડાઉનલોડ કરો"
            className="action-cluster-grid-btn"
          >
            <Download size={15} className="text-acc shrink-0" />
            <span className="font-gujarati">PDF ડાઉનલોડ કરો</span>
          </button>
        </div>

        {/* DANGER LAST: "કાઢી નાખો" muted outline, red token text */}
        <button
          type="button"
          onClick={() => { 
            if (!sessionRole) { 
              useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); 
              return; 
            } 
            setShowClearConfirm(true); 
          }}
          aria-label="કાઢી નાખો"
          className="action-cluster-danger-btn"
        >
          {!sessionRole ? <Lock size={16} className="shrink-0" /> : <Trash2 size={16} className="shrink-0" />}
          <span className="font-gujarati">કાઢી નાખો</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="new-report-container w-full max-w-[1400px] mx-auto space-y-6 pb-36 relative">
      {/* Toast & Undo Pill */}
      <AnimatePresence>
        {showToast && (
          <div className="fixed inset-x-4 bottom-24 z-[80] flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.16, ease: 'easeIn' }}
              className="w-full max-w-md rounded-2xl bg-card/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2 shadow-lg border border-brd/10 pointer-events-auto"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={18} className="text-acc shrink-0" />
                <span className="flex-1 text-sm text-txt font-gujarati font-medium truncate">{toastMessage}</span>
              </div>
              {undoSnapshot && (
                <button
                  type="button"
                  onClick={handleUndo}
                  id="btn-toast-undo"
                  aria-label="અન્ડૂ"
                  className="px-3 py-1 rounded-full bg-acc text-white text-xs font-gujarati font-bold hover:bg-acc/90 active:scale-95 transition-all shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>અન્ડૂ</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent Floating Undo Pill */}
      <AnimatePresence>
        {undoSnapshot && !showToast && (
          <div className="fixed bottom-24 right-4 z-[80]">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="button"
              onClick={handleUndo}
              id="btn-floating-undo"
              aria-label="અન્ડૂ"
              className="px-4 py-2 rounded-full bg-card/95 backdrop-blur shadow-lg border border-acc/40 text-acc hover:bg-acc hover:text-white text-sm font-gujarati font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>અન્ડૂ</span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Halqa Dialog */}
      <AnimatePresence>
        {showHalqaDialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="viewport-fixed-overlay bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !isAddingHalqa) setShowHalqaDialog(false); }}
            id="halqa-dialog-overlay"
          >
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm max-h-[85vh] overflow-y-auto select-none"
              role="dialog"
              aria-modal="true"
              aria-label="નવા હલકાનું નામ લખો"
              id="halqa-dialog-container"
              tabIndex={-1}
            >
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 border border-brd/20">
                <h3 className="text-xl font-bold font-gujarati">નવા હલકાનું નામ લખો</h3>
                <input 
                  autoFocus
                  type="text" 
                  aria-label="નવા હલકાનું નામ"
                  placeholder="દા.ત. ધાનેરા, વડગામ, દાંતા..." 
                  value={newHalqaName}
                  onChange={(e) => setNewHalqaName(e.target.value)}
                  className="w-full app-input rounded-md px-4 py-3 outline-none shadow-[inset_0_0_0_1px_rgb(var(--brd)/0.15)] font-gujarati focus:shadow-[inset_0_0_0_2px_rgb(var(--acc))] transition-shadow"
                />
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <button 
                    type="button"
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-brd/30 text-txt hover:bg-card/80 font-gujarati text-sm font-medium transition-all cursor-pointer"
                    onClick={() => setShowHalqaDialog(false)} 
                    disabled={isAddingHalqa}
                    aria-label="રદ કરો"
                  >
                    {t('action.cancel' as any)}
                  </button>
                  <button 
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 min-w-[120px] px-4 py-2.5 rounded-xl bg-acc text-white font-gujarati text-sm font-semibold hover:bg-acc/90 transition-all shadow-md cursor-pointer"
                    onClick={handleAddHalqa} 
                    disabled={isAddingHalqa}
                    aria-label="હલકો ઉમેરો"
                  >
                    {isAddingHalqa ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : '+ ઉમેરો'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {halqaToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="viewport-fixed-overlay bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setHalqaToDelete(null); }}
            id="halqa-delete-dialog-overlay"
          >
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm max-h-[85vh] overflow-y-auto select-none"
              role="dialog"
              aria-modal="true"
              aria-label="હલકો કાઢી નાખવાની ખાતરી"
              id="halqa-delete-dialog-container"
              tabIndex={-1}
            >
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 text-center border border-brd/20">
                <h3 className="text-xl font-bold font-gujarati text-danger">ખાતરી કરો</h3>
                <p className="font-gujarati text-sub">શું તમે ખરેખર "{halqaToDelete}" કાઢી નાખવા માંગો છો?</p>
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <button 
                    type="button"
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-brd/30 text-txt hover:bg-card/80 font-gujarati text-sm font-medium transition-all cursor-pointer"
                    onClick={() => setHalqaToDelete(null)}
                    aria-label="રદ કરો"
                  >
                    {t('action.cancel' as any)}
                  </button>
                  <button 
                    type="button"
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl bg-danger text-white font-gujarati text-sm font-semibold hover:bg-danger/90 transition-all shadow-md cursor-pointer"
                    onClick={confirmDeleteHalqa}
                    aria-label="હા, કાઢી નાખો"
                  >
                    હા, કાઢી નાખો
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="viewport-fixed-overlay bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowClearConfirm(false); }}
            id="clear-confirm-dialog-overlay"
          >
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm max-h-[85vh] overflow-y-auto select-none"
              role="dialog"
              aria-modal="true"
              aria-label="ડ્રાફ્ટ ડિલીટ ખાતરી"
              id="clear-confirm-dialog-container"
              tabIndex={-1}
            >
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 text-center border border-brd/20">
                <h3 className="text-xl font-bold font-gujarati text-danger">ડ્રાફ્ટ ડિલીટ</h3>
                <p className="font-gujarati text-sub">શું તમે બધી માહિતી ભૂંસવા માંગો છો?</p>
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <button 
                    type="button"
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-brd/30 text-txt hover:bg-card/80 font-gujarati text-sm font-medium transition-all cursor-pointer"
                    onClick={() => setShowClearConfirm(false)}
                    aria-label="રદ કરો"
                  >
                    {t('action.cancel' as any)}
                  </button>
                  <button 
                    type="button"
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl bg-danger text-white font-gujarati text-sm font-semibold hover:bg-danger/90 transition-all shadow-md cursor-pointer"
                    onClick={confirmClear}
                    aria-label="હા, ભૂંસી નાખો"
                  >
                    હા, ભૂંસી નાખો
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Heading */}
      <header className="flex flex-wrap gap-2 justify-between items-center">
        <PageHeading title={t('nav.new_report')} />
      </header>

      {/* Main Responsive Grid: 12-col layout on ≥900px (Form: 5 cols, Table: 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Form Column (col-span-12 lg:col-span-5) ── */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* D1: Flow Stepper (Relative Position, Fits 360px without wrap) */}
          <div className="flow-stepper-container bg-card p-3 rounded-2xl border border-brd/30 shadow-sm">
            <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
              {stepperState.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div 
                      className={cn(
                        "flow-stepper-dot",
                        step.isDone 
                          ? "flow-stepper-dot-done" 
                          : step.isCurrent 
                            ? "flow-stepper-dot-current" 
                            : "flow-stepper-dot-pending"
                      )}
                    >
                      {step.isDone ? <Check size={12} className="stroke-[2.5]" /> : step.id}
                    </div>
                    <span 
                      className={cn(
                        "text-[12px] font-gujarati whitespace-nowrap leading-none",
                        step.isDone || step.isCurrent 
                          ? "flow-stepper-label-active" 
                          : "flow-stepper-label-pending"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < stepperState.length - 1 && (
                    <div 
                      className={cn(
                        "flow-stepper-connector self-center mb-4",
                        step.isDone ? "flow-stepper-connector-done" : "flow-stepper-connector-pending"
                      )} 
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* D2: Card 1 "ક્યાં અને ક્યારે" (Internal order strictly preserved) */}
          <div className="bg-card rounded-[20px] p-4 sm:p-5 border border-brd/30 shadow-sm space-y-4 new-report-card">
            <h3 className="font-gujarati font-semibold text-[15px] text-txt">ક્યાં અને ક્યારે</h3>

            {/* 1. Halqa chips + "+ હલકો ઉમેરો" */}
            <div className="space-y-2">
              <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar">
                {ALL_HALQAS.map(h => (
                  <div key={h} className="snap-start relative group shrink-0">
                    <button
                      type="button"
                      onClick={() => setHalqa(h)}
                      aria-label={`હલકો ${h}`}
                      className={cn(
                        "whitespace-nowrap px-4 py-2 rounded-full font-gujarati text-sm font-medium transition-all duration-200",
                        halqa === h 
                          ? "bg-acc text-white shadow-[0_4px_12px_rgb(var(--acc)/0.3)]" 
                          : "bg-card text-txt hover:bg-card/80 border border-brd/30"
                      )}
                    >
                      {h}
                    </button>
                    {customHalqas.includes(h) && (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!sessionRole) { 
                            useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); 
                            return; 
                          } 
                          setHalqaToDelete(h); 
                        }}
                        aria-label={`હલકો ${h} કાઢી નાખો`}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center shadow-md scale-0 group-hover:scale-100 transition-transform"
                      >
                        {!sessionRole ? <Lock size={12} /> : <X size={12} />}
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={() => { 
                    if (!sessionRole) { 
                      useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); 
                      return; 
                    } 
                    setShowHalqaDialog(true); 
                  }}
                  aria-label="+ હલકો ઉમેરો"
                  className="snap-start whitespace-nowrap px-4 py-2 rounded-full border border-dashed border-sub/40 text-sub hover:bg-sub/10 flex items-center gap-1.5 font-gujarati text-sm font-medium shrink-0 transition-colors"
                >
                  {!sessionRole ? <Lock size={15} /> : <Plus size={15} />}
                  <span>+ હલકો ઉમેરો</span>
                </button>
              </div>
            </div>

            {/* 2. Scan pills */}
            <div>
              <ScanPills
                onFill={handleScanFill}
                showToast={showNotification}
                currentHalqas={ALL_HALQAS}
              />
            </div>

            {/* 3. Existing Date card trigger */}
            <div 
              id="btn-date-picker-trigger"
              onClick={() => setShowCalendar(true)}
              role="button"
              tabIndex={0}
              aria-label="તારીખ પસંદ કરો"
              className="flex items-center gap-3.5 p-3 rounded-2xl bg-bg/50 border border-brd/20 hover:border-acc/40 cursor-pointer transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-acc/10 flex items-center justify-center text-acc shrink-0">
                <Calendar size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs text-sub font-gujarati">તારીખ:</span>
                <div className="font-num text-base font-bold text-txt">
                  {date ? formatDate(date) : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* S27 Neumorphic Calendar Dialog */}
          <NeumorphicCalendarDialog
            isOpen={showCalendar}
            onClose={() => setShowCalendar(false)}
            selectedDate={date}
            onSelectDate={(newDate) => setDate(newDate)}
          />

          {/* D3: Card 2 "ગણતરી" = COLORED COUNT-ZONE */}
          <div className="count-zone-card p-4 sm:p-5 new-report-card">
            {/* Top Row: "સ્ટુડન્ટની સંખ્યા" + 36sp Extrabold Animated Count-up */}
            <div className="flex items-center justify-between mb-4">
              <span className="count-zone-top-label font-gujarati text-[13px] font-medium tracking-wide">
                સ્ટુડન્ટની સંખ્યા
              </span>
              <span className="count-zone-top-value font-num font-extrabold text-[36px] leading-none">
                {displayCount}
              </span>
            </div>

            {/* KPI Tiles: 2 columns on ≤640px, 3 columns on >640px (NEVER 6) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {KPI_KEYS.map(({ key, label }) => (
                <div 
                  key={key} 
                  className={cn(
                    "count-zone-tile rounded-[14px] p-2.5 flex flex-col items-center justify-between gap-1.5 transition-all",
                    recentTileKey === key && "tile-input-tick",
                    recentlyFilledKeys.has(`stat.${key}`) && "ring-2 ring-acc"
                  )}
                >
                  <span className="count-zone-tile-label font-gujarati text-[11px] font-medium text-center truncate w-full">
                    {label}
                  </span>
                  <input
                    type="number"
                    value={(stats as any)[key] || ''}
                    onChange={(e) => handleStatChange(key, e.target.value)}
                    aria-label={label}
                    placeholder="0"
                    className="count-zone-tile-input w-full font-num font-semibold text-[18px] text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              ))}

              {/* Full-width tile: "મુસ્લિમ શિક્ષકોની સંખ્યા" */}
              <div 
                className={cn(
                  "count-zone-tile col-span-2 sm:col-span-3 rounded-[14px] p-2.5 flex items-center justify-between gap-2 transition-all px-4",
                  recentTileKey === 'muslim_teachers' && "tile-input-tick",
                  recentlyFilledKeys.has('stat.muslim_teachers') && "ring-2 ring-acc"
                )}
              >
                <span className="count-zone-tile-label font-gujarati text-[12px] font-medium">
                  મુસ્લિમ શિક્ષકોની સંખ્યા
                </span>
                <input
                  type="number"
                  value={stats.muslim_teachers || ''}
                  onChange={(e) => handleStatChange('muslim_teachers', e.target.value)}
                  aria-label="મુસ્લિમ શિક્ષકોની સંખ્યા"
                  placeholder="0"
                  className="count-zone-tile-input w-24 font-num font-semibold text-[18px] text-right sm:text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Desktop BlockC: rendered only on desktop >=900px (hidden lg:block, single source of truth, no duplicate IDs) */}
          <div className="hidden lg:block">
            {renderBlockC('desktop')}
          </div>
        </div>

        {/* ── Right Column: Mobile BlockB + Mobile BlockC (<900px) OR Desktop BlockB (≥900px) ── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Mobile BlockB: 13 stacked activity cards (<900px, lg:hidden, zero horizontal scroll) */}
          <div className="space-y-3 lg:hidden overflow-x-hidden">
            {ACTIVITY_KEYS.map((key, idx) => {
              const isScanFilled = recentlyFilledKeys.has(`${key}.gujishta`) || 
                                   recentlyFilledKeys.has(`${key}.azaim`) || 
                                   recentlyFilledKeys.has(`${key}.maujuda`);
              return (
                <div 
                  key={key} 
                  className={cn(
                    "activity-mobile-card space-y-2.5 transition-all duration-300",
                    isScanFilled && "ring-2 ring-acc shadow-md"
                  )}
                  style={{
                    animationDelay: `${idx * 40}ms`
                  }}
                >
                  {/* Row 1: 22px rank chip + activity label 14sp */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-[22px] h-[22px] rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 font-num bg-acc shadow-xs">
                      {idx + 1}
                    </span>
                    <span className="font-gujarati font-semibold text-[14px] text-txt truncate">
                      {t(key as any)}
                    </span>
                  </div>

                  {/* Row 2: 3-column input grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Col 1: Gujishta */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-gujarati text-sub font-medium block text-center truncate">
                        {t('header.gujishta' as any)}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={activities[key]?.gujishta || ''}
                        onChange={(e) => handleActivityChange(key, 'gujishta', e.target.value)}
                        aria-label={`${t(key as any)} ${t('header.gujishta' as any)}`}
                        placeholder="-"
                        className={cn(
                          "w-full rounded-xl app-input py-2 text-[16px] text-center font-num font-semibold outline-none focus:border-acc transition-all",
                          recentlyFilledKeys.has(`${key}.gujishta`) && "bg-acc/20 ring-2 ring-acc"
                        )}
                      />
                    </div>

                    {/* Col 2: Azaim */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-gujarati text-sub font-medium block text-center truncate">
                        {t('header.azaim' as any)}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={activities[key]?.azaim || ''}
                        onChange={(e) => handleActivityChange(key, 'azaim', e.target.value)}
                        aria-label={`${t(key as any)} ${t('header.azaim' as any)}`}
                        placeholder="-"
                        className={cn(
                          "w-full rounded-xl app-input py-2 text-[16px] text-center font-num font-semibold outline-none focus:border-acc transition-all",
                          recentlyFilledKeys.has(`${key}.azaim`) && "bg-acc/20 ring-2 ring-acc"
                        )}
                      />
                    </div>

                    {/* Col 3: Maujuda */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-gujarati text-sub font-medium block text-center truncate">
                        {t('header.maujuda' as any)}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={activities[key]?.maujuda || ''}
                        onChange={(e) => handleActivityChange(key, 'maujuda', e.target.value)}
                        aria-label={`${t(key as any)} ${t('header.maujuda' as any)}`}
                        placeholder="-"
                        className={cn(
                          "w-full rounded-xl app-input py-2 text-[16px] text-center font-num font-bold outline-none focus:border-acc transition-all",
                          recentlyFilledKeys.has(`${key}.maujuda`) && "bg-acc/20 ring-2 ring-acc"
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Activity 13 Card: Mashwara */}
            <div 
              className={cn(
                "activity-mobile-card space-y-2.5 transition-all duration-300",
                recentlyFilledKeys.has('mashwara') && "ring-2 ring-acc shadow-md"
              )}
              style={{
                animationDelay: `${12 * 40}ms`
              }}
            >
              {/* Row 1: 22px rank chip + label 14sp */}
              <div className="flex items-center gap-2.5">
                <span className="w-[22px] h-[22px] rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 font-num bg-acc shadow-xs">
                  13
                </span>
                <span className="font-gujarati font-semibold text-[14px] text-txt truncate">
                  {t('activity.mashwara_when_where' as any)}
                </span>
              </div>

              {/* Row 2: Full-width text input */}
              <div>
                <input
                  type="text"
                  value={activities['mashwara']?.maujuda || ''}
                  onChange={(e) => handleActivityChange('mashwara', 'maujuda', e.target.value)}
                  aria-label={t('activity.mashwara_when_where' as any)}
                  placeholder="કિંમત લખો..."
                  className={cn(
                    "w-full rounded-xl app-input py-2.5 px-3.5 text-sm font-gujarati border border-brd/30 outline-none focus:border-acc transition-all",
                    recentlyFilledKeys.has('mashwara') && "bg-acc/20 ring-2 ring-acc"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Mobile BlockC: rendered only on mobile <900px (lg:hidden, single source of truth, no duplicate IDs) */}
          <div className="lg:hidden">
            {renderBlockC('mobile')}
          </div>

          {/* Desktop BlockB: 13-activity table (≥900px, hidden lg:block) */}
          <div className="hidden lg:block">
            <div className="bg-card rounded-[20px] overflow-hidden border border-brd/40 shadow-sm new-report-card">
              {/* Table Scrollable Container with Custom 6px Scrollbar */}
              <div 
                ref={tableScrollRef}
                onScroll={handleTableScroll}
                className="overflow-x-auto report-table-scroll"
              >
                <table className="w-full text-left border-collapse min-w-[500px] lg:min-w-0">
                  <thead>
                    <tr className="report-table-header-row">
                      {/* Sticky Activity Column Header */}
                      <th className="py-3.5 px-4 report-table-sticky-header w-[40%] min-w-[170px]">
                        <div className="flex items-center gap-1.5 font-gujarati font-semibold text-[13px] tracking-wide">
                          <ListChecks size={15} className="shrink-0" />
                          <span>૧૩ મહેનત પ્રવૃત્તિઓ</span>
                        </div>
                      </th>
                      {/* Flexible Halqa Data Columns */}
                      <th className="py-3.5 px-3 text-center min-w-[110px] flex-1">
                        <span className="font-gujarati font-semibold text-[12px] opacity-95">
                          {t('header.gujishta' as any)}
                        </span>
                      </th>
                      <th className="py-3.5 px-3 text-center min-w-[110px] flex-1">
                        <span className="font-gujarati font-semibold text-[12px] opacity-95">
                          {t('header.azaim' as any)}
                        </span>
                      </th>
                      <th className="py-3.5 px-3 text-center min-w-[110px] flex-1">
                        <span className="font-gujarati font-semibold text-[12px] opacity-95">
                          {t('header.maujuda' as any)}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brd/30">
                    {ACTIVITY_KEYS.map((key, idx) => (
                      <tr key={key} className="hover:bg-acc/5 transition-colors">
                        {/* Sticky Activity Column */}
                        <td className="py-3 px-4 report-table-sticky-col">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-[22px] h-[22px] rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 font-num bg-acc shadow-xs"
                            >
                              {idx + 1}
                            </span>
                            <span className="font-gujarati font-medium text-[14px] text-txt truncate">
                              {t(key as any)}
                            </span>
                          </div>
                        </td>

                        {/* Gujishta Input */}
                        <td className="py-2.5 px-2.5 text-center">
                          <input
                            type="text"
                            value={activities[key]?.gujishta || ''}
                            onChange={(e) => handleActivityChange(key, 'gujishta', e.target.value)}
                            aria-label={`${t(key as any)} ${t('header.gujishta' as any)}`}
                            placeholder="-"
                            className={cn(
                              "w-full max-w-[100px] mx-auto block rounded-xl app-input py-2 text-sm text-center font-num outline-none focus:border-acc transition-all",
                              recentlyFilledKeys.has(`${key}.gujishta`) && "bg-acc/20 ring-2 ring-acc"
                            )}
                          />
                        </td>

                        {/* Azaim Input */}
                        <td className="py-2.5 px-2.5 text-center">
                          <input
                            type="text"
                            value={activities[key]?.azaim || ''}
                            onChange={(e) => handleActivityChange(key, 'azaim', e.target.value)}
                            aria-label={`${t(key as any)} ${t('header.azaim' as any)}`}
                            placeholder="-"
                            className={cn(
                              "w-full max-w-[100px] mx-auto block rounded-xl app-input py-2 text-sm text-center font-num outline-none focus:border-acc transition-all",
                              recentlyFilledKeys.has(`${key}.azaim`) && "bg-acc/20 ring-2 ring-acc"
                            )}
                          />
                        </td>

                        {/* Maujuda Input */}
                        <td className="py-2.5 px-2.5 text-center">
                          <input
                            type="text"
                            value={activities[key]?.maujuda || ''}
                            onChange={(e) => handleActivityChange(key, 'maujuda', e.target.value)}
                            aria-label={`${t(key as any)} ${t('header.maujuda' as any)}`}
                            placeholder="-"
                            className={cn(
                              "w-full max-w-[100px] mx-auto block rounded-xl app-input py-2 text-sm text-center font-num font-bold outline-none focus:border-acc transition-all",
                              recentlyFilledKeys.has(`${key}.maujuda`) && "bg-acc/20 ring-2 ring-acc"
                            )}
                          />
                        </td>
                      </tr>
                    ))}

                    {/* Row 13: Mashwara Text Input */}
                    <tr className="hover:bg-acc/5 transition-colors">
                      <td className="py-3 px-4 report-table-sticky-col">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-[22px] h-[22px] rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 font-num bg-acc shadow-xs"
                          >
                            13
                          </span>
                          <span className="font-gujarati font-bold text-[14px] text-txt truncate">
                            {t('activity.mashwara_when_where' as any)}
                          </span>
                        </div>
                      </td>
                      <td colSpan={3} className="py-2.5 px-3">
                        <input
                          type="text"
                          value={activities['mashwara']?.maujuda || ''}
                          onChange={(e) => handleActivityChange('mashwara', 'maujuda', e.target.value)}
                          aria-label={t('activity.mashwara_when_where' as any)}
                          placeholder="કિંમત લખો..."
                          className={cn(
                            "row13-text-input app-input border border-brd/30 focus:border-acc",
                            recentlyFilledKeys.has('mashwara') && "bg-acc/20 ring-2 ring-acc"
                          )}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Print Block for PDF Generation */}
      <div id="print-report" className="hidden">
        <h1 className="text-2xl font-bold mb-4 border-b border-black pb-2">બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ</h1>
        <div className="flex justify-between mb-4 font-bold text-lg">
          <span>હલકો: {halqa || '-'}</span>
          <span>તારીખ: {formatDate(date)}</span>
        </div>
        
        <h2 className="text-xl font-bold mb-2">સ્ટુડન્ટ આંકડા (કુલ: {totalStudents})</h2>
        <table className="w-full border-collapse border border-black mb-6 text-sm">
          <tbody>
            {KPI_KEYS.map(({ key, label }) => (
              <tr key={key}>
                <td className="border border-black p-2 font-bold w-1/2">{label}</td>
                <td className="border border-black p-2">{(stats as any)[key] || 0}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-black p-2 font-bold">મુસ્લિમ શિક્ષકોની સંખ્યા</td>
              <td className="border border-black p-2">{stats.muslim_teachers}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-bold mb-2">૧૩ મહેનત પ્રવૃત્તિઓ</h2>
        <table className="w-full border-collapse border border-black mb-6 text-sm text-center">
          <thead>
            <tr className="bg-card">
              <th className="border border-black p-2 text-left w-1/3">પ્રવૃત્તિ</th>
              <th className="border border-black p-2">{t('header.gujishta' as any)}</th>
              <th className="border border-black p-2">{t('header.azaim' as any)}</th>
              <th className="border border-black p-2">{t('header.maujuda' as any)}</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_KEYS.map(k => (
              <tr key={k}>
                <td className="border border-black p-2 text-left font-bold">{t(k as any)}</td>
                <td className="border border-black p-2">{activities[k]?.gujishta || '-'}</td>
                <td className="border border-black p-2">{activities[k]?.azaim || '-'}</td>
                <td className="border border-black p-2">{activities[k]?.maujuda || '-'}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-black p-2 text-left font-bold">{t('activity.mashwara_when_where' as any)}</td>
              <td className="border border-black p-2 text-left" colSpan={3}>{activities['mashwara']?.maujuda || '-'}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-bold mb-2">ખાસ નોંધ</h2>
        <div className="border border-black p-4 min-h-[100px] text-sm whitespace-pre-wrap">
          {notes || '-'}
        </div>
      </div>
    </div>
  );
};
