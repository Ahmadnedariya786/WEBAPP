import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { LiquidButton } from '../ui/LiquidButton';
import type { ReviewData } from './types';
import { useOverlayScrollLock } from '../../lib/useOverlayScrollLock';

interface ReviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: ReviewData;
  onConfirmFill: (data: ReviewData) => void;
}

export const ReviewOverlay: React.FC<ReviewOverlayProps> = ({
  isOpen,
  onClose,
  initialData,
  onConfirmFill
}) => {
  const [data, setData] = useState<ReviewData>(initialData);
  const panelRef = useRef<HTMLDivElement>(null);
  const innerScrollRef = useRef<HTMLDivElement>(null);

  useOverlayScrollLock({ isOpen, onClose, panelRef });

  useEffect(() => {
    if (isOpen) {
      setData(initialData);
      if (panelRef.current) panelRef.current.scrollTop = 0;
      if (innerScrollRef.current) innerScrollRef.current.scrollTop = 0;
    }
  }, [isOpen, initialData]);

  const handleHalqaChange = (val: string) => {
    setData(prev => ({
      ...prev,
      halqa_name: { v: val, ok: true }
    }));
  };

  const handleHalqaFocus = () => {
    setData(prev => {
      if (!prev.halqa_name.ok) {
        return {
          ...prev,
          halqa_name: { ...prev.halqa_name, ok: true }
        };
      }
      return prev;
    });
  };

  const handleStatChange = (key: string, val: string) => {
    setData(prev => {
      const prevStat = prev.stats[key] || { v: '', ok: true };
      return {
        ...prev,
        stats: {
          ...prev.stats,
          [key]: {
            ...prevStat,
            v: val,
            ok: true
          }
        }
      };
    });
  };

  const handleStatFocus = (key: string) => {
    setData(prev => {
      const prevStat = prev.stats[key];
      if (prevStat && !prevStat.ok) {
        return {
          ...prev,
          stats: {
            ...prev.stats,
            [key]: {
              ...prevStat,
              ok: true
            }
          }
        };
      }
      return prev;
    });
  };

  const handleActivityCellChange = (rowIdx: number, colKey: string, val: string) => {
    setData(prev => {
      const updated = [...prev.activities];
      const row = updated[rowIdx];
      if (row) {
        row.cols = {
          ...row.cols,
          [colKey]: { v: val, ok: true }
        };
      }
      return { ...prev, activities: updated };
    });
  };

  const handleActivityCellFocus = (rowIdx: number, colKey: string) => {
    setData(prev => {
      const row = prev.activities[rowIdx];
      if (row && row.cols[colKey] && !row.cols[colKey].ok) {
        const updated = [...prev.activities];
        updated[rowIdx] = {
          ...row,
          cols: {
            ...row.cols,
            [colKey]: { ...row.cols[colKey], ok: true }
          }
        };
        return { ...prev, activities: updated };
      }
      return prev;
    });
  };

  const handleConfirm = () => {
    // F1: Ensure all badges are hidden permanently after "ફોર્મમાં ભરો"
    const cleanedStats: Record<string, { v: string; ok: boolean }> = {};
    Object.entries(data.stats).forEach(([k, s]) => {
      cleanedStats[k] = { v: s.v || '', ok: true };
    });

    const cleanedActivities = data.activities.map(act => ({
      ...act,
      cols: Object.fromEntries(
        Object.entries(act.cols).map(([cKey, cell]) => [cKey, { v: cell.v || '', ok: true }])
      )
    }));

    const cleanData: ReviewData = {
      ...data,
      halqa_name: { v: data.halqa_name.v || '', ok: true },
      stats: cleanedStats,
      activities: cleanedActivities
    };

    onConfirmFill(cleanData);
  };

  const STAT_FIELDS = [
    { key: 'student_count', label: 'કુલ સંખ્યા' },
    { key: 'std10', label: 'ધોરણ ૧૦' },
    { key: 'std11', label: 'ધોરણ ૧૧' },
    { key: 'std12', label: 'ધોરણ ૧૨' },
    { key: 'college', label: 'કોલેજ' },
    { key: 'engineer', label: 'એન્જિનિયર' },
    { key: 'medical', label: 'મેડિકલ' },
    { key: 'muslim_teachers', label: 'મુસ્લિમ શિક્ષકોની સંખ્યા' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="viewport-fixed-overlay fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          id="scan-review-overlay"
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] bg-card rounded-[28px] shadow-2xl flex flex-col border border-brd/30 overflow-hidden select-none my-auto self-center"
            style={{
              margin: 'auto',
              alignSelf: 'center',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="સ્કેન રિવ્યુ"
            id="scan-review-container"
            tabIndex={-1}
          >
          {/* Header */}
          <div className="px-5 py-4 border-b border-brd/20 flex items-center justify-between bg-card/80 backdrop-blur shrink-0">
            <div>
              <h3 className="text-lg font-bold font-gujarati text-txt flex items-center gap-2">
                <span>સ્કેન રિવ્યુ</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-acc/10 text-acc font-normal">
                  ચકાસો અને સુધારો
                </span>
              </h3>
              <p className="text-xs text-sub font-gujarati mt-0.5" id="review-picker-subtitle">
                ઓસીઆર હાથપ્રત માટે અંદાજ છે — દરેક ખાનું ચકાસો અને સુધારો
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-sub/10 hover:bg-sub/20 text-sub flex items-center justify-center transition-colors cursor-pointer"
              aria-label="બંધ કરો"
            >
              <X size={18} />
            </button>
          </div>

          {/* Internal Scrollable Content - zero horizontal scroll at 360px */}
          <div ref={innerScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-5 hide-scrollbar">
            {/* Halqa Name */}
            <div className="p-3.5 rounded-2xl bg-bg/60 border border-brd/20 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold font-gujarati text-sub">
                  હલકો (Halqa Name)
                </label>
                {!data.halqa_name.ok && (
                  <span className="flex items-center gap-1 text-[11px] font-gujarati text-amber-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    અસ્પષ્ટ
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={data.halqa_name.v || ''}
                  onFocus={handleHalqaFocus}
                  onChange={(e) => handleHalqaChange(e.target.value)}
                  placeholder="હલકાનું નામ દા.ત. પાલનપુર"
                  className="w-full app-input px-3.5 py-2.5 rounded-xl text-sm font-gujarati font-semibold outline-none focus:ring-2 focus:ring-acc/40 transition-all"
                />
              </div>
            </div>

            {/* F2: Student Stats Section - ONE input per stat with its label above; NO 3-column header row */}
            <div className="space-y-2.5" id="scan-review-stats-section">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sub font-gujarati">
                  સ્ટુડન્ટ આંકડા (Student Stats)
                </h4>
              </div>

              {/* Grid of single-input stats: label on top, one input below */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {STAT_FIELDS.map(({ key, label }) => {
                  const stat = data.stats[key] || { v: '', ok: true };
                  const isLowConf = !stat.ok;
                  return (
                    <div
                      key={key}
                      className="p-2.5 rounded-xl bg-bg/50 border border-brd/20 space-y-1.5"
                      data-stat-key={key}
                    >
                      <label className="block font-gujarati text-xs font-bold text-txt truncate" title={label}>
                        {label}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={stat.v || ''}
                          onFocus={() => handleStatFocus(key)}
                          onChange={(e) => handleStatChange(key, e.target.value)}
                          placeholder="–"
                          aria-label={label}
                          data-stat-input={key}
                          className={`w-full app-input py-2 px-2.5 text-xs text-center font-num font-bold outline-none focus:ring-2 focus:ring-acc/40 rounded-xl transition-all ${
                            isLowConf ? 'pr-[56px]' : ''
                          }`}
                        />
                        {isLowConf && (
                          <span
                            className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-gujarati font-semibold absolute right-1.5 top-1.5 pointer-events-none select-none z-10"
                            title="અસ્પષ્ટ"
                            data-testid={`badge-${key}`}
                          >
                            અસ્પષ્ટ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 13 Activities Section - Sticky 3-column headers apply ONLY here */}
            <div className="space-y-2.5" id="scan-review-activities-section">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sub font-gujarati">
                  ૧૩ મહેનત પ્રવૃત્તિઓ (Activities)
                </h4>
              </div>

              {/* Sticky Column Headers for Activities Section */}
              <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm py-1.5 px-1 border-b border-brd/20" id="activities-column-header">
                <div className="grid grid-cols-3 gap-2 w-full text-center">
                  {data.columnKeys.map((col) => (
                    <div
                      key={col.key}
                      className="text-xs font-bold font-gujarati text-sub py-1 px-1.5 rounded-lg bg-sub/10 select-none"
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stacked Rows for Activities (1 to 13) */}
              <div className="space-y-2">
                {data.activities.map((act, idx) => (
                  <div
                    key={act.no}
                    className="p-3 rounded-2xl bg-bg/50 border border-brd/20 space-y-2"
                    data-activity-no={act.no}
                    data-activity-row={act.no}
                  >
                    {/* Full-width label on top: bold small */}
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-acc/10 text-acc text-xs font-bold flex items-center justify-center shrink-0 font-num">
                        {act.no}
                      </span>
                      <span className="font-gujarati text-xs sm:text-sm font-bold text-txt truncate">
                        {act.name}
                      </span>
                    </div>

                    {/* Inputs below it */}
                    {act.no === 13 ? (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={act.cols['mojuda']?.v || ''}
                          onFocus={() => handleActivityCellFocus(idx, 'mojuda')}
                          onChange={(e) =>
                            handleActivityCellChange(idx, 'mojuda', e.target.value)
                          }
                          placeholder="વિગત લખો..."
                          className={`w-full app-input py-2 px-3 rounded-xl text-xs font-gujarati outline-none focus:ring-2 focus:ring-acc/40 font-medium ${
                            !act.cols['mojuda']?.ok ? 'pr-[56px]' : ''
                          }`}
                          data-activity-input="13-mojuda"
                        />
                        {!act.cols['mojuda']?.ok && (
                          <span
                            className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-gujarati font-semibold absolute right-2 top-1.5 pointer-events-none select-none z-10"
                            title="અસ્પષ્ટ"
                            data-testid="badge-13-mojuda"
                          >
                            અસ્પષ્ટ
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {data.columnKeys.map((col) => {
                          const cell = act.cols[col.key] || { v: '', ok: true };
                          const isLowConf = !cell.ok;
                          return (
                            <div key={col.key} className="relative flex items-center">
                              <input
                                type="text"
                                value={cell.v || ''}
                                onFocus={() => handleActivityCellFocus(idx, col.key)}
                                onChange={(e) =>
                                  handleActivityCellChange(idx, col.key, e.target.value)
                                }
                                placeholder="–"
                                className={`w-full app-input py-2 px-2 text-xs text-center font-num font-bold outline-none focus:ring-2 focus:ring-acc/40 rounded-xl transition-all ${
                                  isLowConf ? 'pr-[56px]' : ''
                                }`}
                                data-activity-input={`${act.no}-${col.key}`}
                              />
                              {isLowConf && (
                                <span
                                  className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-gujarati font-semibold absolute right-1.5 top-1 pointer-events-none select-none z-10"
                                  title="અસ્પષ્ટ"
                                  data-testid={`badge-${act.no}-${col.key}`}
                                >
                                  અસ્પષ્ટ
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Read-Only Skipped Columns Section */}
            {data.skipped_columns && data.skipped_columns.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold font-gujarati text-amber-600 dark:text-amber-400">
                  <AlertCircle size={15} />
                  <span>SKIP થયેલા કૉલમ</span>
                </div>
                <p className="text-xs text-sub font-gujarati">
                  આ કૉલમ હાલના હલકાઓ સાથે મેચ થયા નથી:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.skipped_columns.map((col, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-card text-xs font-gujarati font-medium text-txt border border-brd/30 shadow-xs"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy Footer Line */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-sub/70 font-gujarati py-1">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              <span>ઈમેજ ફક્ત એક્સટ્રેક્શન માટે પ્રોસેસ થાય છે, સ્ટોર થતી નથી</span>
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 p-4 border-t border-brd/20 bg-card shrink-0">
            <LiquidButton
              variant="neutral"
              className="w-full min-h-[48px] h-[48px] px-4 font-gujarati text-sm flex items-center justify-center cursor-pointer"
              onClick={onClose}
              id="btn-scan-review-cancel"
            >
              રદ કરો
            </LiquidButton>
            <LiquidButton
              variant="primary"
              className="w-full min-h-[48px] h-[48px] px-4 font-gujarati text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={handleConfirm}
              id="btn-scan-review-confirm"
              data-testid="scan-review-fill-btn"
            >
              <Check size={16} />
              <span>ફોર્મમાં ભરો</span>
            </LiquidButton>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
};
