import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { SavedReport } from '../store/appStore';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeading } from '../components/ui/PageHeading';
import { LiquidButton } from '../components/ui/LiquidButton';
import { Calendar, Users, MapPin, Download, Share2, Edit3, Trash2, Search, CheckCircle, Plus, Lock } from 'lucide-react';
import { formatDate } from '../lib/utils';

export const PastReports: React.FC = () => {
  const navigate = useNavigate();
  const { reports, deleteReport, setDraftReport, sessionRole } = useAppStore();
  const [search, setSearch] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  
  // Toasts
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

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
          showNotification(err.message || 'ભૂલ આવી! ડિલીટ ન થઈ શક્યું ❌');
        }
      });
    }
  };

  const filteredReports = reports.filter(r => r.halqa.includes(search) || r.date.includes(search));

  const getTotalStudents = (stats: any) => {
    if (!stats) return 0;
    return (stats.std_10 || 0) + (stats.std_11 || 0) + (stats.std_12 || 0) + (stats.college || 0);
  };

  const handleShareWhatsApp = (report: SavedReport) => {
    const text = `બનાસકાંઠા સ્ટુડન્ટ મહેનત ટ્રેકર\nહલકો: ${report.halqa} | તારીખ: ${formatDate(report.date)}\nકુલ સ્ટુડન્ટ: ${getTotalStudents(report.stats)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadExcel = (report: SavedReport) => {
    const ACTIVITY_KEYS = [
      'activity.namaz', 'activity.mashwara_pabandi', 'activity.taleem', 'activity.gasht',
      'activity.panchkosa', 'activity.shabguzari', 'activity.mulaqat_percent', 'activity.school_namaz',
      'activity.jamaat_3', 'activity.jamaat_10', 'activity.jamaat_40', 'activity.jamaat_4m'
    ];
    const rows: any[][] = [
      ["બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ"],
      ["હલકો:", report.halqa, "તારીખ:", formatDate(report.date)],
      [],
      ["સ્ટુડન્ટ આંકડા"],
      ["કુલ સ્ટુડન્ટની સંખ્યા", getTotalStudents(report.stats)],
      [t('stat.std_10' as any), report.stats?.std_10 || 0],
      [t('stat.std_11' as any), report.stats?.std_11 || 0],
      [t('stat.std_12' as any), report.stats?.std_12 || 0],
      [t('stat.college' as any), report.stats?.college || 0],
      [t('stat.engineering' as any), report.stats?.engineering || 0],
      [t('stat.medical' as any), report.stats?.medical || 0],
      [t('stat.muslim_teachers' as any), report.stats?.muslim_teachers || 0],
      [],
      ["પ્રવૃત્તિ", t('header.gujishta' as any), t('header.azaim' as any), t('header.maujuda' as any)]
    ];

    ACTIVITY_KEYS.forEach(k => {
      rows.push([
        t(k as any),
        report.activities[k]?.gujishta || '-',
        report.activities[k]?.azaim || '-',
        report.activities[k]?.maujuda || '-'
      ]);
    });

    rows.push([]);
    rows.push(["મશવારો:", report.activities['mashwara']?.maujuda || '-']);
    rows.push(["ખાસ નોંધ:", report.notes || '-']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:32}, {wch:12}, {wch:12}, {wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "રિપોર્ટ");
    
    const filename = `mehnat_${report.halqa}_${report.date}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    (window as any).AndroidPrepareDownload?.(filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Excel ડાઉનલોડ થઈ ✅');
  };

  const handleDownloadAllExcel = () => {
    if (reports.length === 0) return showNotification('કોઈ રિપોર્ટ નથી ❌');
    
    const wb = XLSX.utils.book_new();
    const ACTIVITY_KEYS = [
      'activity.namaz', 'activity.mashwara_pabandi', 'activity.taleem', 'activity.gasht',
      'activity.panchkosa', 'activity.shabguzari', 'activity.mulaqat_percent', 'activity.school_namaz',
      'activity.jamaat_3', 'activity.jamaat_10', 'activity.jamaat_40', 'activity.jamaat_4m'
    ];

    reports.forEach((report) => {
      const rows: any[][] = [
        ["બનાસકાંઠા સ્ટુડન્ટ મહેનત રિપોર્ટ"],
        ["હલકો:", report.halqa, "તારીખ:", formatDate(report.date)],
        [],
        ["સ્ટુડન્ટ આંકડા"],
        ["કુલ સ્ટુડન્ટની સંખ્યા", getTotalStudents(report.stats)],
        [t('stat.std_10' as any), report.stats?.std_10 || 0],
        [t('stat.std_11' as any), report.stats?.std_11 || 0],
        [t('stat.std_12' as any), report.stats?.std_12 || 0],
        [t('stat.college' as any), report.stats?.college || 0],
        [t('stat.engineering' as any), report.stats?.engineering || 0],
        [t('stat.medical' as any), report.stats?.medical || 0],
        [t('stat.muslim_teachers' as any), report.stats?.muslim_teachers || 0],
        [],
        ["પ્રવૃત્તિ", t('header.gujishta' as any), t('header.azaim' as any), t('header.maujuda' as any)]
      ];

      ACTIVITY_KEYS.forEach(k => {
        rows.push([
          t(k as any),
          report.activities[k]?.gujishta || '-',
          report.activities[k]?.azaim || '-',
          report.activities[k]?.maujuda || '-'
        ]);
      });

      rows.push([]);
      rows.push(["મશવારો:", report.activities['mashwara']?.maujuda || '-']);
      rows.push(["ખાસ નોંધ:", report.notes || '-']);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{wch:32}, {wch:12}, {wch:12}, {wch:12}];
      let sheetName = `${report.halqa}_${report.date}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const filename = `all_reports.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    (window as any).AndroidPrepareDownload?.(filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('બધા રિપોર્ટ Excel ડાઉનલોડ થયા ✅');
  };

  return (
    <div className="space-y-6 pb-12 relative">
      <AnimatePresence>
        {showToast && (
          <div className="fixed inset-x-4 bottom-24 z-[80] flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="w-full max-w-md rounded-2xl bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-2 shadow-lg border border-brd/10"
            >
              <CheckCircle size={18} className="text-acc2 shrink-0" />
              <span className="flex-1 text-sm text-txt font-gujarati font-medium">{toastMessage}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportToDelete !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-card/90 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm">
              <div className="bg-card rounded-[24px] shadow-2xl p-6 space-y-4 text-center">
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
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-wrap gap-2 justify-between items-center">
        <PageHeading title={t('nav.past_reports')} />
      </header>

      {/* Top Actions */}
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
          type="text" 
          placeholder={t('past_reports.search_placeholder' as any)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 pl-12 pr-4 rounded-full app-input outline-none focus:shadow-[inset_0_0_0_2px_rgb(var(--acc))] transition-shadow font-gujarati placeholder-opacity-50"
        />
      </div>

      <div className="flex items-center justify-between text-sm text-sub px-2">
        <span className="font-gujarati">{t('past_reports.total_reports' as any)}</span>
        <span className="font-num font-bold text-txt">{filteredReports.length}</span>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredReports.map((report, i) => {
          const acts = report.activities || {};
          const namaz = acts['activity.namaz'] || {};
          const jam3 = acts['activity.jamaat_3']?.maujuda || '0';
          const jam10 = acts['activity.jamaat_10']?.maujuda || '0';

          return (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard className="p-4 space-y-3">
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
                  <div className="bg-acc/10 text-acc px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[inset_0_0_0_1px_rgb(var(--brd)/0.15)]">
                    <Users size={14} />
                    <span className="font-num font-bold text-sm">{getTotalStudents(report.stats)}</span>
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

                {/* Action Row */}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-brd/10">
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
                    <button className="w-9 h-9 rounded-full flex items-center justify-center text-danger hover:bg-danger/10 " onClick={() => { if (!sessionRole) { useAppStore.setState({ authDialogOpen: true, authPendingAction: null }); return; } setReportToDelete(report.id); }}>
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
    </div>
  );
};



