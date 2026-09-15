import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { LiquidButton } from '../components/ui/LiquidButton';
import { Calendar, Save, Trash2, Download, Share2, CheckCircle, Plus, X, Copy, ListChecks, MapPin, Lock, RotateCcw } from 'lucide-react';
import { cn, formatDate, localTodayIso } from '../lib/utils';
import { isDuplicateReportError, mapSupabaseError } from '../services/supabaseService';
import { ScanPills } from '../components/ScanFill';

// Constants
const ACTIVITY_KEYS = [
  'activity.namaz', 'activity.mashwara_pabandi', 'activity.taleem', 'activity.gasht',
  'activity.panchkosa', 'activity.shabguzari', 'activity.mulaqat_percent', 'activity.school_namaz',
  'activity.jamaat_3', 'activity.jamaat_10', 'activity.jamaat_40', 'activity.jamaat_4m'
];

export const NewReport: React.FC = () => {
  const { draftReport, setDraftReport, clearDraft, halqas, customHalqas, addCustomHalqa, removeCustomHalqa, addReport, sessionRole } = useAppStore();
  
  // Toasts
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // S23: Scan & Fill State
  const [recentlyFilledKeys, setRecentlyFilledKeys] = useState<Set<string>>(new Set());
  const [undoSnapshot, setUndoSnapshot] = useState<any | null>(null);
  const undoTimeoutRef = useRef<any>(null);

  // Form State
  const [halqa, setHalqa] = useState('');
  const [date, setDate] = useState(() => sessionStorage.getItem('currentDate') || localTodayIso());
  
  useEffect(() => {
    sessionStorage.setItem('currentDate', date);
  }, [date]);

  const [stats, setStats] = useState({
    std_10: 0, std_11: 0, std_12: 0, college: 0, engineering: 0, medical: 0, muslim_teachers: 0
  });
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

  // Total Students Calculation
  const totalStudents = stats.std_10 + stats.std_11 + stats.std_12 + stats.college;

  // Real Actions
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
    setStats(undoSnapshot.stats || { std_10: 0, std_11: 0, std_12: 0, college: 0, engineering: 0, medical: 0, muslim_teachers: 0 });
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
          id: '', // Empty ID for new reports, DB will generate UUID
          halqa,
          date,
          stats,
          activities,
          mashwara: activities['mashwara']?.maujuda || '',
          notes
        });
        showNotification('રિપોર્ટ સેવ થયો ✅');
        setUndoSnapshot(null);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setHalqa('');
        sessionStorage.removeItem('currentDate');
        setDate(localTodayIso());
        setStats({ std_10: 0, std_11: 0, std_12: 0, college: 0, engineering: 0, medical: 0, muslim_teachers: 0 });
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
    setStats({ std_10: 0, std_11: 0, std_12: 0, college: 0, engineering: 0, medical: 0, muslim_teachers: 0 });
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
      // Date is not restored from draft.
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
      await useAppStore.getState().loadData(); // Refetch halqas as requested
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
      await useAppStore.getState().loadData(); // Refetch halqas
      showNotification('હલકો ડિલીટ થયો ✅');
      if (halqa === halqaToDelete) setHalqa('');
      setHalqaToDelete(null);
    } catch (err: any) {
      showNotification('ભૂલ આવી: ' + (err.message || 'અજ્ઞાત ભૂલ'));
    }
  };

  const ALL_HALQAS = halqas.map((h: any) => h.name);

  // Calendar: derive year/month from currently selected date or today
  const calendarBase = date || localTodayIso();
  const [calYear, calMonth] = calendarBase.split('-').map(Number);
  const calMonthIndex = calMonth - 1; // 0-based
  const daysInCalMonth = new Date(calYear, calMonthIndex + 1, 0).getDate();
  const calFirstOffset = new Date(calYear, calMonthIndex, 1).getDay(); // 0=Sun

  return (
    <div className="space-y-6 pb-12 relative">
      {/* Toast & Undo Pill */}
      <AnimatePresence>
        {showToast && (
          <div className="fixed inset-x-4 bottom-24 z-[80] flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="w-full max-w-md rounded-2xl bg-card/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2 shadow-lg border border-brd/10 pointer-events-auto"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={18} className="text-acc2 shrink-0" />
                <span className="flex-1 text-sm text-txt font-gujarati font-medium truncate">{toastMessage}</span>
              </div>
              {undoSnapshot && (
                <button
                  type="button"
                  onClick={handleUndo}
                  id="btn-toast-undo"
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

      {/* Persistent Floating Undo Pill (visible until save or 30s) */}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-card/90 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm">
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4">
                <h3 className="text-xl font-bold font-gujarati">નવા હલકાનું નામ લખો</h3>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="દા.ત. ધાનેરા, વડગામ, દાંતા..." 
                  value={newHalqaName}
                  onChange={(e) => setNewHalqaName(e.target.value)}
                  className="w-full app-input rounded-md px-4 py-3 outline-none shadow-[inset_0_0_0_1px_rgb(var(--brd)/0.15)] font-gujarati focus:shadow-[inset_0_0_0_2px_rgb(var(--acc))] transition-shadow"
                />
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <LiquidButton variant="neutral" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={() => setShowHalqaDialog(false)} disabled={isAddingHalqa}>
                    {t('action.cancel' as any)}
                  </LiquidButton>
                  <LiquidButton variant="primary" className="flex-1 flex items-center justify-center gap-2 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={handleAddHalqa} disabled={isAddingHalqa}>
                    {isAddingHalqa ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : '+ ઉમેરો'}
                  </LiquidButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {halqaToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-card/90 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm">
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 text-center">
                <h3 className="text-xl font-bold font-gujarati text-danger">ખાતરી કરો</h3>
                <p className="font-gujarati text-sub">શું તમે ખરેખર "{halqaToDelete}" કાઢી નાખવા માંગો છો?</p>
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <LiquidButton variant="neutral" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={() => setHalqaToDelete(null)}>
                    {t('action.cancel' as any)}
                  </LiquidButton>
                  <LiquidButton variant="danger" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={confirmDeleteHalqa}>
                    હા, કાઢી નાખો
                  </LiquidButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-card/90 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm">
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 text-center">
                <h3 className="text-xl font-bold font-gujarati text-danger">ડ્રાફ્ટ ડિલીટ</h3>
                <p className="font-gujarati text-sub">શું તમે બધી માહિતી ભૂંસવા માંગો છો?</p>
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <LiquidButton variant="neutral" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={() => setShowClearConfirm(false)}>
                    {t('action.cancel' as any)}
                  </LiquidButton>
                  <LiquidButton variant="danger" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={confirmClear}>
                    હા, ભૂંસી નાખો
                  </LiquidButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-wrap gap-2 justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-gujarati min-w-0 truncate">{t('nav.new_report')}</h2>
      </header>

      <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 xl:items-start">
        <div className="contents xl:flex xl:flex-1 xl:flex-col xl:gap-6">
          {/* Halqa Selector */}
          <section className="order-1 xl:order-none space-y-3 sticky top-[60px] z-30 bg-bg pb-3 pt-2 -mx-6 px-6 border-b border-brd/30 shadow-sm">
            <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar">
              {ALL_HALQAS.map(h => (
                <div key={h} className="snap-start relative group">
                  <button
                    onClick={() => setHalqa(h)}
                    className={cn(
                      "whitespace-nowrap px-4 py-2 rounded-full backdrop-blur-sm  duration-300 font-gujarati",
                      halqa === h 
                        ? "bg-acc text-white shadow-[inset_0_0_0_1px_rgb(var(--acc)/0.3),0_4px_12px_rgb(var(--acc)/0.3)]" 
                        : "bg-card text-txt hover:bg-card shadow-[inset_0_0_0_1px_rgb(var(--brd)/0.15)]"
                    )}
                  >
                    {h}
                  </button>
                  {customHalqas.includes(h) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } setHalqaToDelete(h); }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center shadow-md scale-0 group-hover:scale-100 transition-transform"
                >
                  {!sessionRole ? <Lock size={12} /> : <X size={12} />}
                </button>
              )}
            </div>
          ))}
          <button 
            onClick={() => { if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } setShowHalqaDialog(true); }}
            className="snap-start whitespace-nowrap px-4 py-2 rounded-full border border-dashed border-sub/30 text-sub hover:bg-sub/10  flex items-center gap-1 font-gujarati"
          >
            {!sessionRole ? <Lock size={16} /> : <Plus size={16} />} {t('action.add_halqa' as any)}
          </button>
        </div>
      </section>

      {/* S23: Scan-&-Fill Camera & Gallery Pills (Above Date Card) */}
      <div className="order-2 xl:order-none">
        <ScanPills
          onFill={handleScanFill}
          showToast={showNotification}
          currentHalqas={ALL_HALQAS}
        />
      </div>

      {/* Date Picker (Trigger Card) */}
      <GlassCard className="order-3 xl:order-none p-4">
        <div 
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => setShowCalendar(true)}
        >
          <div className="w-12 h-12 rounded-full bg-acc/10 flex items-center justify-center text-acc shrink-0">
            <Calendar size={24} />
          </div>
          <div className="flex-1">
            <label className="text-xs tracking-wider text-sub font-medium font-gujarati">{t('label.date' as any)}</label>
            <div className="w-full font-num text-lg font-bold text-txt">
              {date ? formatDate(date) : '-'}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* POPUP DIALOG for Calendar */}
      <AnimatePresence>
        {showCalendar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-sm w-full rounded-2xl bg-card/90 backdrop-blur-2xl p-4 shadow-2xl"
            >
              <div className="grid grid-cols-7 gap-1 text-center mb-4">
                {['રવિ', 'સોમ', 'મંગળ', 'બુધ', 'ગુરુ', 'શુક્ર', 'શનિ'].map((d, i) => (
                  <div key={i} className="text-xs text-sub font-gujarati">{d}</div>
                ))}
              </div>
              {/* Month/year heading */}
              <div className="text-center mb-3 font-gujarati font-bold text-txt">
                {['જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'][calMonthIndex]} {calYear}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-6">
                {/* Offset empty cells so day 1 lands on correct weekday */}
                {Array.from({ length: calFirstOffset }).map((_, i) => (
                  <div key={`e${i}`} />
                ))}
                {Array.from({ length: daysInCalMonth }, (_, i) => i + 1).map(d => {
                  const todayStr = localTodayIso();
                  const fullDate = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isSelected = date === fullDate;
                  const isToday = fullDate === todayStr;
                  return (
                    <button
                      key={d}
                      onClick={() => { setDate(fullDate); setShowCalendar(false); }}
                      className={cn(
                        "h-10 w-10 mx-auto rounded-full text-sm flex items-center justify-center font-num transition-transform duration-200",
                        isSelected
                          ? "bg-acc text-white shadow"
                          : isToday
                            ? "ring-1 ring-acc/50 text-txt"
                            : "text-txt hover:bg-acc/10"
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <LiquidButton variant="neutral" className="flex-1 font-gujarati py-2.5" onClick={() => { setDate(''); setShowCalendar(false); }}>
                  સાફ કરો
                </LiquidButton>
                <LiquidButton variant="primary" className="flex-1 font-gujarati py-2.5" onClick={() => { setDate(localTodayIso()); setShowCalendar(false); }}>
                  આજે
                </LiquidButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <section className="order-3 xl:order-none grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard className="col-span-2 p-4">
          <div className="flex justify-between items-center">
            <span className="font-gujarati font-bold text-lg text-txt">{t('stat.students_count' as any)}</span>
            <span className="text-3xl font-bold font-num text-acc">{totalStudents}</span>
          </div>
        </GlassCard>
        
        {['std_10', 'std_11', 'std_12', 'college', 'engineering', 'medical'].map(key => {
          return (
            <GlassCard key={key} className="p-4 flex flex-col justify-between h-24">
              <span className="font-gujarati text-sm text-sub line-clamp-1">{t(`stat.${key}` as any)}</span>
              <input 
                type="number"
                value={(stats as any)[key] || ''}
                onChange={(e) => handleStatChange(key as keyof typeof stats, e.target.value)}
                className={cn(
                  "app-input text-2xl font-bold font-num w-full outline-none text-right rounded-lg px-2 focus:ring-2 focus:ring-acc/40 transition-all placeholder-opacity-50",
                  recentlyFilledKeys.has(`stat.${key}`) && "bg-acc/20 ring-2 ring-acc/60"
                )}
                placeholder="0"
              />
            </GlassCard>
          );
        })}
        
        <GlassCard className="col-span-2 p-4 flex justify-between items-center">
          <span className="font-gujarati text-sm text-sub">{t('stat.muslim_teachers' as any)}</span>
          <input 
            type="number"
            value={stats.muslim_teachers || ''}
            onChange={(e) => handleStatChange('muslim_teachers', e.target.value)}
            className={cn(
              "app-input text-2xl font-bold font-num w-24 outline-none text-right rounded-lg px-2 focus:ring-2 focus:ring-acc/40 transition-all placeholder-opacity-50",
              recentlyFilledKeys.has('stat.muslim_teachers') && "bg-acc/20 ring-2 ring-acc/60"
            )}
            placeholder="0"
          />
        </GlassCard>
      </section>

      {/* Special Note */}
      <section className="order-5 xl:order-none space-y-3">
        <GlassCard className="p-4 space-y-2">
          <label className="font-gujarati text-sm font-bold text-sub">{t('label.special_note' as any)}</label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full app-input bg-transparent outline-none resize-none min-h-[60px] font-gujarati text-txt placeholder:text-sub/50 p-3 rounded-2xl"
            placeholder="અહીં લખો..."
          />
        </GlassCard>
      </section>

      {/* Action Buttons (2-col grid, wired toasts) */}
      <div className="order-6 xl:order-none grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <LiquidButton variant="neutral" className="w-full px-4 min-w-0 h-auto py-2.5 text-danger border-danger/30 bg-danger/10 hover:bg-danger/20" onClick={() => { if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } setShowClearConfirm(true); }}>
          {!sessionRole ? <Lock size={16} className="mr-2 shrink-0" /> : <Trash2 size={16} className="mr-2 shrink-0" />} <span className="font-gujarati text-center">{t('action.delete' as any)}</span>
        </LiquidButton>
        <LiquidButton variant="primary" className="w-full px-4 min-w-0 h-auto py-2.5" onClick={() => { if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } handleSave(); }}>
          {!sessionRole ? <Lock size={16} className="mr-2 shrink-0" /> : <Save size={16} className="mr-2 shrink-0" />} <span className="font-gujarati text-center">{t('action.save' as any)}</span>
        </LiquidButton>
        {sessionRole && (
          <>
            <LiquidButton variant="neutral" className="w-full px-4 min-w-0 h-auto py-2.5" onClick={handleWhatsApp}>
              <Share2 size={16} className="mr-2 text-acc shrink-0" /> <span className="font-gujarati text-sm text-center">{t('action.share_whatsapp' as any)}</span>
            </LiquidButton>
            <LiquidButton variant="neutral" className="w-full px-4 min-w-0 h-auto py-2.5" onClick={handleCopy}>
              <Copy size={16} className="mr-2 text-acc shrink-0" /> <span className="font-gujarati text-sm text-center">કોપી કરો</span>
            </LiquidButton>
            <LiquidButton variant="neutral" className="w-full px-4 min-w-0 h-auto py-2.5" onClick={handleDownloadExcel}>
              <Download size={16} className="mr-2 text-acc shrink-0" /> <span className="font-gujarati text-sm text-center">{t('action.export_excel' as any)}</span>
            </LiquidButton>
            <LiquidButton variant="neutral" className="w-full px-4 min-w-0 h-auto py-2.5" onClick={handleDownloadPdf}>
              <Download size={16} className="mr-2 text-acc shrink-0" /> <span className="font-gujarati text-sm text-center">{t('action.export_pdf' as any)}</span>
            </LiquidButton>
          </>
        )}
      </div>
        </div>

        <div className="order-4 xl:order-none xl:w-[55%]">
      {/* 13-row Activities Table */}
      <section className="space-y-3">
        <h3 className="font-bold font-gujarati text-lg pl-1 text-txt">{t('header.activities' as any)}</h3>
        <div className="rounded-2xl overflow-hidden bg-card shadow-lg border border-brd/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr style={{ background: 'rgb(var(--acc))' }}>
                  <th className="py-4 px-4 w-2/5">
                    <div className="flex items-center justify-start">
                      <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 backdrop-blur-sm font-gujarati font-semibold text-sm whitespace-nowrap" style={{ textShadow: 'var(--on-primary-shadow)', background: 'var(--on-primary-chip-bg)', borderColor: 'var(--on-primary-chip-border)', borderWidth: '1px', color: 'var(--on-primary)' }}>
                        <ListChecks size={14} />
                        પ્રવૃત્તિ
                      </span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 backdrop-blur-sm font-gujarati font-semibold text-sm whitespace-nowrap" style={{ textShadow: 'var(--on-primary-shadow)', background: 'var(--on-primary-chip-bg)', borderColor: 'var(--on-primary-chip-border)', borderWidth: '1px', color: 'var(--on-primary)' }}>
                        <MapPin size={14} />
                        {t('header.gujishta' as any)}
                      </span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 backdrop-blur-sm font-gujarati font-semibold text-sm whitespace-nowrap" style={{ textShadow: 'var(--on-primary-shadow)', background: 'var(--on-primary-chip-bg)', borderColor: 'var(--on-primary-chip-border)', borderWidth: '1px', color: 'var(--on-primary)' }}>
                        <MapPin size={14} />
                        {t('header.azaim' as any)}
                      </span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 backdrop-blur-sm font-gujarati font-semibold text-sm whitespace-nowrap" style={{ textShadow: 'var(--on-primary-shadow)', background: 'var(--on-primary-chip-bg)', borderColor: 'var(--on-primary-chip-border)', borderWidth: '1px', color: 'var(--on-primary)' }}>
                        <MapPin size={14} />
                        {t('header.maujuda' as any)}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brd/30">
                {ACTIVITY_KEYS.map((key, idx) => (
                  <tr key={key} className="hover:bg-acc/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-8 h-8 rounded-lg text-white text-sm font-bold flex items-center justify-center shrink-0 font-num"
                          style={{ background: 'rgb(var(--acc))' }}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-gujarati font-medium text-sm text-txt">{t(key as any)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={activities[key]?.gujishta || ''}
                        onChange={(e) => handleActivityChange(key, 'gujishta', e.target.value)}
                        className={cn(
                          "w-full max-w-[110px] mx-auto block rounded-xl app-input py-2.5 text-sm text-center font-num outline-none focus:border-acc focus:ring-2 focus:ring-acc/40 transition-all",
                          recentlyFilledKeys.has(`${key}.gujishta`) && "bg-acc/20 ring-2 ring-acc/60"
                        )}
                        placeholder="-"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={activities[key]?.azaim || ''}
                        onChange={(e) => handleActivityChange(key, 'azaim', e.target.value)}
                        className={cn(
                          "w-full max-w-[110px] mx-auto block rounded-xl app-input py-2.5 text-sm text-center font-num outline-none focus:border-acc focus:ring-2 focus:ring-acc/40 transition-all",
                          recentlyFilledKeys.has(`${key}.azaim`) && "bg-acc/20 ring-2 ring-acc/60"
                        )}
                        placeholder="-"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={activities[key]?.maujuda || ''}
                        onChange={(e) => handleActivityChange(key, 'maujuda', e.target.value)}
                        className={cn(
                          "w-full max-w-[110px] mx-auto block rounded-xl app-input py-2.5 text-sm text-center font-num font-bold outline-none focus:ring-2 focus:ring-acc/40 transition-all",
                          recentlyFilledKeys.has(`${key}.maujuda`) && "bg-acc/20 ring-2 ring-acc/60"
                        )}
                        placeholder="-"
                      />
                    </td>
                  </tr>
                ))}
                {/* 13th Row: Mashwara */}
                <tr className="hover:bg-acc/5 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg text-white text-sm font-bold flex items-center justify-center shrink-0 font-num"
                        style={{ background: 'rgb(var(--acc))' }}
                      >
                        13
                      </span>
                      <span className="font-gujarati font-bold text-sm text-txt">{t('activity.mashwara_when_where' as any)}</span>
                    </div>
                  </td>
                  <td colSpan={3} className="py-3.5 px-4">
                    <input
                      type="text"
                      value={activities['mashwara']?.maujuda || ''}
                      onChange={(e) => handleActivityChange('mashwara', 'maujuda', e.target.value)}
                      className={cn(
                        "w-full rounded-xl app-input px-4 py-2.5 text-sm font-gujarati outline-none focus:border-acc focus:ring-2 focus:ring-acc/40 transition-all placeholder-opacity-50",
                        recentlyFilledKeys.has('mashwara') && "bg-acc/20 ring-2 ring-acc/60"
                      )}
                      placeholder="વિગત લખો..."
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

        </div>
      </div>
      
      {/* Hidden Print Block */}
      <div id="print-report" className="hidden">
        <h1 className="text-2xl font-bold mb-4 border-b border-black pb-2">બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ</h1>
        <div className="flex justify-between mb-4 font-bold text-lg">
          <span>હલકો: {halqa || '-'}</span>
          <span>તારીખ: {formatDate(date)}</span>
        </div>
        
        <h2 className="text-xl font-bold mb-2">સ્ટુડન્ટ આંકડા (કુલ: {totalStudents})</h2>
        <table className="w-full border-collapse border border-black mb-6 text-sm">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold w-1/2">{t('stat.std_10' as any)}</td>
              <td className="border border-black p-2">{stats.std_10}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">{t('stat.std_11' as any)}</td>
              <td className="border border-black p-2">{stats.std_11}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">{t('stat.std_12' as any)}</td>
              <td className="border border-black p-2">{stats.std_12}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">{t('stat.college' as any)}</td>
              <td className="border border-black p-2">{stats.college}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">{t('stat.engineering' as any)}</td>
              <td className="border border-black p-2">{stats.engineering}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">{t('stat.medical' as any)}</td>
              <td className="border border-black p-2">{stats.medical}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">{t('stat.muslim_teachers' as any)}</td>
              <td className="border border-black p-2">{stats.muslim_teachers}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-bold mb-2">પ્રવૃત્તિ સારાંશ</h2>
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

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
