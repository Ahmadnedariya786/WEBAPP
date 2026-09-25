import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { buildReportWorkbook, buildAllReportsWorkbook, writeReportWorkbookToBuffer } from '../lib/excelGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { SavedReport } from '../store/appStore';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeading } from '../components/ui/PageHeading';
import { LiquidButton } from '../components/ui/LiquidButton';
import { 
  Calendar, Users, MapPin, Download, Share2, Edit3, Trash2, 
  Search, CheckCircle, Plus, Lock, Check, CheckSquare, Square, 
  X, AlertCircle, Loader2 
} from 'lucide-react';
import { formatDate, logActivity, cn } from '../lib/utils';
import { useOverlayScrollLock } from '../lib/useOverlayScrollLock';
import { nativeSave, NATIVE_SAVE_SUCCESS } from '../lib/nativeSave';

export const PastReports: React.FC = () => {
  const navigate = useNavigate();
  const { reports, deleteReport, setDraftReport, sessionRole } = useAppStore();
  const [search, setSearch] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  // Bulk Selection States (D1, D2, D3, D4)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkBarHeight, setBulkBarHeight] = useState(64);
  const bulkBarRef = useRef<HTMLDivElement>(null);

  useOverlayScrollLock({ isOpen: reportToDelete !== null, onClose: () => setReportToDelete(null) });
  
  // Toasts
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isErrorToast, setIsErrorToast] = useState(false);

  const showNotification = (msg: string, isError: boolean = false) => {
    setToastMessage(msg);
    setIsErrorToast(isError || msg.includes('❌'));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Dynamic bottom padding for report cards list so last card never hides behind bulk bar (D3)
  useLayoutEffect(() => {
    if (isSelectMode && bulkBarRef.current) {
      const h = bulkBarRef.current.offsetHeight;
      if (h > 0) setBulkBarHeight(h);
    }
  }, [isSelectMode, isConfirming, selectedIds.size]);

  const handleEdit = (report: SavedReport) => {
    setDraftReport({
      halqa: report.halqa,
      date: report.date,
      stats: report.stats,
      activities: report.activities,
      mashwara: report.mashwara,
      notes: report.notes
    });
    navigate('/');
    showNotification('રિપોર્ટ લોડ થયો ✅');
  };

  const confirmDelete = () => {
    if (reportToDelete !== null) {
      useAppStore.getState().requireAuth(async () => {
        try {
          await deleteReport(reportToDelete);
          setReportToDelete(null);
          showNotification('રિપોર્ટ ડિલીટ થયો ✅');
        } catch (err: any) {
          console.error(err);
          showNotification(err.message || 'ભૂલ આવી! ડિલીટ ન થઈ શક્યું ❌', true);
        }
      });
    }
  };

  const filteredReports = reports.filter(r => r.halqa.includes(search) || r.date.includes(search));
  const visibleIds = filteredReports.map(r => r.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds(new Set());
      setIsConfirming(false);
    } else {
      setIsSelectMode(true);
      setSelectedIds(new Set());
      setIsConfirming(false);
    }
  };

  const toggleReportSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleBulkDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    useAppStore.getState().requireAuth(async () => {
      setIsDeleting(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of idsToDelete) {
        try {
          await deleteReport(id);
          successCount++;
        } catch (err) {
          console.error(`Error deleting report ${id}:`, err);
          failCount++;
        }
      }

      // D5: log via existing logging as one summary entry "બલ્ક ડિલીટ: N"
      if (successCount > 0) {
        logActivity(`બલ્ક ડિલીટ: ${successCount}`);
      }

      // D5: truthful end toast
      if (failCount === 0 && successCount > 0) {
        showNotification(`${successCount} રિપોર્ટ્સ કાઢી નાખ્યા ✅`, false);
      } else if (successCount > 0 && failCount > 0) {
        showNotification(`${successCount} કાઢી નાખ્યા, ${failCount} નિષ્ફળ ❌`, true);
      } else {
        showNotification('ડિલીટ નિષ્ફળ ❌', true);
      }

      // Exit select mode after
      setIsDeleting(false);
      setIsConfirming(false);
      setIsSelectMode(false);
      setSelectedIds(new Set());
    });
  };

  const getTotalStudents = (stats: any) => {
    if (!stats) return 0;
    return (stats.std_10 || 0) + (stats.std_11 || 0) + (stats.std_12 || 0) + (stats.college || 0);
  };

  const handleShareWhatsApp = (report: SavedReport) => {
    const text = `બનાસકાંઠા સ્ટુડન્ટ મહેનત ટ્રેકર\nહલકો: ${report.halqa} | તારીખ: ${formatDate(report.date)}\nકુલ સ્ટુડન્ટ: ${getTotalStudents(report.stats)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadExcel = async (report: SavedReport) => {
    const wb = buildReportWorkbook({
      halqa: report.halqa,
      date: report.date,
      stats: report.stats,
      activities: report.activities,
      mashwara: report.mashwara,
      notes: report.notes,
      totalStudents: getTotalStudents(report.stats)
    });
    
    const filename = `mehnat_${report.halqa}_${report.date}.xlsx`;
    const excelBuffer = writeReportWorkbookToBuffer(wb);
    const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const route = await nativeSave(new Uint8Array(excelBuffer), filename, XLSX_MIME);
    // D3: single toast — Kotlin owns it on APK; JS shows it only on desktop
    if (route === 'desktop') showNotification(NATIVE_SAVE_SUCCESS);
  };

  const handleDownloadAllExcel = async () => {
    if (reports.length === 0) return showNotification('કોઈ રિપોર્ટ નથી ❌', true);
    
    const wb = buildAllReportsWorkbook(reports.map(r => ({
      halqa: r.halqa,
      date: r.date,
      stats: r.stats,
      activities: r.activities,
      mashwara: r.mashwara,
      notes: r.notes,
      totalStudents: getTotalStudents(r.stats)
    })));

    const filename = `all_reports.xlsx`;
    const excelBuffer = writeReportWorkbookToBuffer(wb);
    const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const route = await nativeSave(new Uint8Array(excelBuffer), filename, XLSX_MIME);
    // D3: single toast — Kotlin owns it on APK; JS shows it only on desktop
    if (route === 'desktop') showNotification(NATIVE_SAVE_SUCCESS);
  };

  return (
    <div className="space-y-6 pb-12 relative">
      <AnimatePresence>
        {showToast && (
          <div className="fixed inset-x-4 bottom-24 z-[80] flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.16, ease: 'easeIn' }}
              className="w-full max-w-md rounded-2xl bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-2 shadow-lg border border-brd/10"
            >
              {isErrorToast ? (
                <AlertCircle size={18} className="text-danger shrink-0" />
              ) : (
                <CheckCircle size={18} className="text-acc2 shrink-0" />
              )}
              <span className="flex-1 text-sm text-txt font-gujarati font-medium">{toastMessage}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportToDelete !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="viewport-fixed-overlay bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setReportToDelete(null); }}
            id="report-delete-dialog-overlay"
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
              aria-label="રિપોર્ટ ડિલીટ ખાતરી"
              id="report-delete-dialog-container"
              tabIndex={-1}
            >
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 text-center border border-brd/20">
                <h3 className="text-xl font-bold font-gujarati text-danger">ખાતરી કરો</h3>
                <p className="font-gujarati text-sub">શું તમે ખરેખર આ રિપોર્ટ કાઢી નાખવા માંગો છો?</p>
                <div className="flex flex-wrap gap-3 pt-2 justify-center">
                  <LiquidButton variant="neutral" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={() => setReportToDelete(null)}>
                    {t('action.cancel' as any)}
                  </LiquidButton>
                  <LiquidButton variant="danger" className="flex-1 min-w-[120px] px-4 py-2.5 whitespace-nowrap" onClick={confirmDelete}>
                    હા, કાઢી નાખો
                  </LiquidButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* D1. Header Row with SELECT MODE Button */}
      <header className="flex flex-wrap gap-2 justify-between items-center">
        <PageHeading title={t('nav.past_reports')} />
        <button
          type="button"
          id="btn-toggle-select-mode"
          onClick={toggleSelectMode}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-gujarati font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer",
            isSelectMode
              ? "bg-acc/15 text-acc border border-acc/30 hover:bg-acc/25"
              : "bg-card text-txt hover:bg-acc/10 border border-brd/20"
          )}
        >
          {isSelectMode ? (
            <>
              <X size={16} className="shrink-0" />
              <span>બંધ કરો</span>
            </>
          ) : (
            <>
              <CheckSquare size={16} className="shrink-0" />
              <span>પસંદ કરો</span>
            </>
          )}
        </button>
      </header>

      {/* Top Actions: Existing Bulk Excel Export button stays unchanged and visually separate (D6) */}
      <div className="flex flex-wrap gap-3">
        <LiquidButton variant="primary" className="flex-1 flex flex-row items-center justify-center gap-2 whitespace-nowrap px-4 py-3.5 max-[380px]:text-sm min-w-0 shrink-0" onClick={() => navigate('/')}>
          <Plus size={18} className="shrink-0" />
          <span className="font-gujarati truncate">{t('nav.new_report')}</span>
        </LiquidButton>
        {sessionRole && (
          <LiquidButton variant="neutral" className="flex-1 flex flex-row items-center justify-center gap-2 whitespace-nowrap px-4 py-3.5 max-[380px]:text-sm text-acc border-acc2/30 min-w-0 shrink-0" onClick={handleDownloadAllExcel}>
            <Download size={18} className="shrink-0" />
            <span className="font-gujarati truncate">એક્સેલ ડાઉનલોડ</span>
          </LiquidButton>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sub/50" size={20} />
        <input 
          id="search-reports-input"
          type="text" 
          placeholder={t('past_reports.search_placeholder' as any)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 pl-12 pr-4 rounded-full app-input outline-none focus:shadow-[inset_0_0_0_2px_rgb(var(--acc))] transition-shadow font-gujarati placeholder-opacity-50"
        />
      </div>

      {/* D2. SELECT ALL Sub-Row when in Select Mode */}
      {isSelectMode && (
        <motion.div 
          id="select-all-toolbar"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-card/80 backdrop-blur rounded-2xl border border-brd/15 shadow-sm"
        >
          <button
            type="button"
            id="btn-select-all-toggle"
            onClick={toggleSelectAll}
            className="px-3.5 py-1.5 rounded-xl text-sm font-gujarati font-semibold bg-acc/10 text-acc hover:bg-acc/20 border border-acc/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            {isAllVisibleSelected ? (
              <>
                <Square size={16} className="shrink-0" />
                <span>કોઈ નહીં પસંદ કરો</span>
              </>
            ) : (
              <>
                <CheckSquare size={16} className="shrink-0" />
                <span>બધા પસંદ કરો</span>
              </>
            )}
          </button>
          <div className="text-sm font-gujarati text-sub flex items-center gap-1.5">
            <span>પસંદ કરેલ:</span>
            <span className="font-num font-bold text-acc text-base" id="selected-reports-count">{selectedIds.size}</span>
            <span>/</span>
            <span className="font-num text-txt">{filteredReports.length}</span>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between text-sm text-sub px-2">
        <span className="font-gujarati">{t('past_reports.total_reports' as any)}</span>
        <span className="font-num font-bold text-txt">{filteredReports.length}</span>
      </div>

      {/* Report Cards with dynamic bottom padding when mode is active (D3) */}
      <div 
        id="report-cards-list"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        style={{
          paddingBottom: isSelectMode ? `${bulkBarHeight + 16}px` : undefined,
        }}
      >
        {filteredReports.map((report, i) => {
          const acts = report.activities || {};
          const namaz = acts['activity.namaz'] || {};
          const jam3 = acts['activity.jamaat_3']?.maujuda || '0';
          const jam10 = acts['activity.jamaat_10']?.maujuda || '0';
          const isSelected = selectedIds.has(report.id);

          return (
            <motion.div
              key={report.id}
              id={`report-card-${report.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.06, ease: 'easeOut' }}
              onClick={() => {
                if (isSelectMode) {
                  toggleReportSelection(report.id);
                }
              }}
            >
              <GlassCard 
                className={cn(
                  "p-4 space-y-3 transition-all duration-150 relative",
                  isSelectMode && "cursor-pointer select-none",
                  isSelectMode && isSelected && "ring-2 ring-acc border-acc bg-acc/[0.04] shadow-md"
                )}
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 text-acc font-bold font-gujarati text-lg">
                      <MapPin size={16} /> {report.halqa}
                    </div>
                    <div className="flex items-center gap-2 text-sub text-xs mt-1 font-num">
                      <Calendar size={12} /> {formatDate(report.date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-acc/10 text-acc px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[inset_0_0_0_1px_rgb(var(--brd)/0.15)]">
                      <Users size={14} />
                      <span className="font-num font-bold text-sm">{getTotalStudents(report.stats)}</span>
                    </div>

                    {/* D1: 44px Checkbox Top-Right */}
                    {isSelectMode && (
                      <button
                        type="button"
                        id={`card-checkbox-${report.id}`}
                        aria-label={isSelected ? "પસંદગી રદ કરો" : "રિપોર્ટ પસંદ કરો"}
                        className="w-[44px] h-[44px] -mr-2 -my-2 flex items-center justify-center cursor-pointer transition-transform active:scale-90 select-none shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReportSelection(report.id);
                        }}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-150",
                          isSelected 
                            ? "bg-acc text-white shadow-sm ring-2 ring-acc/30" 
                            : "border-2 border-sub/40 bg-card/60 hover:border-acc/60"
                        )}>
                          {isSelected && <Check size={16} strokeWidth={3} />}
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Lines */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-sm font-gujarati flex justify-between bg-card px-3 py-2 rounded-lg">
                    <span className="text-sub">નમાઝ પાબંદી:</span>
                    <span className="font-medium text-txt">ગુ:- <span className="font-num">{namaz.gujishta || '-'}</span> | અઝ:- <span className="font-num">{namaz.azaim || '-'}</span></span>
                  </div>
                  <div className="text-sm font-gujarati flex justify-between bg-card px-3 py-2 rounded-lg">
                    <span className="text-sub">જમાઅતો (૩/૧૦ દિન):</span>
                    <span className="font-medium text-txt font-num">{jam3} / {jam10}</span>
                  </div>
                </div>

                {/* Action Row: Individual delete stays exactly as-is when not in select mode (D1, D6) */}
                <div className={cn(
                  "flex justify-between items-center pt-2 mt-2 border-t border-brd/10 transition-opacity",
                  isSelectMode && "opacity-40 pointer-events-none"
                )}>
                  <div className="flex gap-2">
                    {sessionRole && (
                      <>
                        <button className="w-9 h-9 rounded-full flex items-center justify-center text-acc hover:bg-acc/10 " onClick={() => handleShareWhatsApp(report)}>
                          <Share2 size={16} />
                        </button>
                        <button className="w-9 h-9 rounded-full flex items-center justify-center text-acc hover:bg-acc/10 " onClick={() => handleDownloadExcel(report)}>
                          <Download size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="w-9 h-9 rounded-full flex items-center justify-center text-acc hover:bg-acc/10 " onClick={() => { if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } handleEdit(report); }}>
                      {!sessionRole ? <Lock size={16} /> : <Edit3 size={16} />}
                    </button>
                    <button id={`btn-delete-report-${report.id}`} className="w-9 h-9 rounded-full flex items-center justify-center text-danger hover:bg-danger/10 " onClick={() => { if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } setReportToDelete(report.id); }}>
                      {!sessionRole ? <Lock size={16} /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
        {filteredReports.length === 0 && (
          <div className="text-center py-12 text-sub font-gujarati">
            કોઈ રિપોર્ટ મળ્યો નથી.
          </div>
        )}
      </div>

      {/* D1, D2, D3, D4: Fixed Bulk Bar portaled to document.body (immune to any ancestor transforms) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isSelectMode && (
              <motion.div
                ref={bulkBarRef}
                id="fixed-bulk-bar"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="fixed z-40 bg-card/95 backdrop-blur-md border border-brd/20 rounded-[16px] shadow-2xl px-4 py-3 max-w-xl mx-auto left-[12px] right-[12px]"
                style={{
                  bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
                }}
              >
                {isConfirming ? (
                  /* D4: IN-BAR CONFIRM (no overlay/portal, no scroll) */
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full" id="bulk-bar-confirm-content">
                    <p className="text-sm font-gujarati font-medium text-txt text-center sm:text-left leading-snug">
                      ખરેખર <span className="font-num font-bold text-danger">{selectedIds.size}</span> કાઢી નાખવા? આ ક્રિયા પરત નહીં થાય.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        id="bulk-cancel-confirm-btn"
                        onClick={() => setIsConfirming(false)}
                        disabled={isDeleting}
                        className="px-3.5 py-2 rounded-xl text-sm font-gujarati font-medium border border-brd/30 hover:bg-sub/10 text-txt transition-colors cursor-pointer"
                      >
                        રદ કરો
                      </button>
                      <button
                        type="button"
                        id="bulk-execute-delete-btn"
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl text-sm font-gujarati font-bold bg-danger text-white hover:opacity-95 shadow-md flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>કાઢી રહ્યા છીએ...</span>
                          </>
                        ) : (
                          <span>હા, કાઢી નાખો</span>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* D3: Standard Bulk Bar Content */
                  <div className="flex items-center justify-between gap-3 w-full" id="bulk-bar-standard-content">
                    <div className="font-gujarati text-txt font-semibold text-sm sm:text-base">
                      <span className="font-num font-bold text-acc mr-1 text-base">{selectedIds.size}</span>
                      રિપોર્ટ પસંદ
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        id="bulk-cancel-mode-btn"
                        onClick={() => {
                          setIsSelectMode(false);
                          setSelectedIds(new Set());
                          setIsConfirming(false);
                        }}
                        className="px-3.5 py-2 rounded-xl text-sm font-gujarati font-medium border border-brd/30 hover:bg-sub/10 text-txt transition-colors cursor-pointer"
                      >
                        રદ કરો
                      </button>
                      <button
                        type="button"
                        id="bulk-delete-btn"
                        disabled={selectedIds.size === 0}
                        onClick={() => {
                          if (selectedIds.size > 0) setIsConfirming(true);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-gujarati font-bold bg-danger text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer",
                          selectedIds.size === 0
                            ? "opacity-40 cursor-not-allowed shadow-none"
                            : "hover:opacity-95 active:scale-[0.97]"
                        )}
                      >
                        કાઢી નાખો (<span className="font-num">{selectedIds.size}</span>)
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
