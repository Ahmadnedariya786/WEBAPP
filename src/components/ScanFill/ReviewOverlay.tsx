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
      halqa_name: { ...prev.halqa_name, v: val }
    }));
  };

  const handleStatChange = (key: string, val: string) => {
    setData(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [key]: { ...prev.stats[key], v: val }
      }
    }));
  };

  const handleActivityCellChange = (rowIdx: number, colKey: string, val: string) => {
    setData(prev => {
      const updated = [...prev.activities];
      const row = updated[rowIdx];
      if (row) {
        row.cols = {
          ...row.cols,
          [colKey]: { ...(row.cols[colKey] || { ok: true }), v: val }
        };
      }
      return { ...prev, activities: updated };
    });
  };

  const statFieldLabels: Record<string, string> = {
    student_count: 'કુલ સંખ્યા',
    std10: 'ધોરણ ૧૦',
    std11: 'ધોરણ ૧૧',
    std12: 'ધોરણ ૧૨',
    college: 'કોલેજ',
    engineer: 'એન્જિનિયર',
    medical: 'મેડિકલ',
    muslim_teachers: 'મુસ્લિમ શિક્ષકો'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="viewport-fixed-overlay bg-black/60 backdrop-blur-md"
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
            className="w-full max-w-3xl max-h-[85vh] bg-card rounded-[28px] shadow-2xl flex flex-col border border-brd/30 overflow-hidden select-none"
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
              <p className="text-xs text-sub font-gujarati mt-0.5">
                પીળા ટપકાવાળા ખાના અસ્પષ્ટ લખાણ દર્શાવે છે
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

          {/* Internal Scrollable Content */}
          <div ref={innerScrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar">
            {/* Halqa Name */}
            <div className="p-4 rounded-2xl bg-bg/60 border border-brd/20 space-y-2">
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
                  onChange={(e) => handleHalqaChange(e.target.value)}
                  placeholder="હલકાનું નામ દા.ત. પાલનપુર"
                  className="w-full app-input px-3.5 py-2.5 rounded-xl text-sm font-gujarati font-semibold outline-none focus:ring-2 focus:ring-acc/40 transition-all"
                />
              </div>
            </div>

            {/* Grouped Stats */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sub font-gujarati">
                સ્ટુડન્ટ આંકડા (Grouped Stats)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(data.stats).map(([key, stat]) => {
                  const label = statFieldLabels[key] || key;
                  return (
                    <div
                      key={key}
                      className="p-3 rounded-2xl bg-bg/50 border border-brd/20 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-gujarati text-sub truncate pr-1">
                          {label}
                        </span>
                        {!stat.ok && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                            title="અસ્પષ્ટ લખાણ"
                          />
                        )}
                      </div>
                      <input
                        type="text"
                        value={stat.v || ''}
                        onChange={(e) => handleStatChange(key, e.target.value)}
                        placeholder="-"
                        className="w-full app-input py-1.5 px-2 rounded-lg text-base font-bold font-num text-right outline-none focus:ring-2 focus:ring-acc/40"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 13 Activities Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sub font-gujarati">
                  ૧૩ મહેનત પ્રવૃત્તિઓ (Activities)
                </h4>
              </div>

              <div className="rounded-2xl border border-brd/30 bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    {/* Sticky Table Headers rendered from extracted columnKeys (N4) */}
                    <thead className="sticky top-0 z-10 bg-acc text-white shadow-sm">
                      <tr>
                        <th className="py-2.5 px-3 text-xs font-gujarati font-semibold w-2/5">
                          પ્રવૃત્તિ
                        </th>
                        {data.columnKeys.map((col) => (
                          <th
                            key={col.key}
                            className="py-2.5 px-3 text-xs font-gujarati font-semibold text-center"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brd/20">
                      {data.activities.map((act, idx) => (
                        <tr
                          key={act.no}
                          className="hover:bg-acc/5 transition-colors text-sm"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-acc/10 text-acc text-xs font-bold flex items-center justify-center shrink-0 font-num">
                                {act.no}
                              </span>
                              <span className="font-gujarati text-xs sm:text-sm text-txt truncate">
                                {act.name}
                              </span>
                            </div>
                          </td>
                          {act.no === 13 ? (
                            <td colSpan={data.columnKeys.length} className="py-2 px-3">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={act.cols['mojuda']?.v || ''}
                                  onChange={(e) =>
                                    handleActivityCellChange(idx, 'mojuda', e.target.value)
                                  }
                                  placeholder="વિગત લખો..."
                                  className="w-full app-input py-1.5 px-3 rounded-lg text-xs font-gujarati outline-none focus:ring-2 focus:ring-acc/40"
                                />
                                {!act.cols['mojuda']?.ok && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-amber-500 absolute right-3 shrink-0"
                                    title="અસ્પષ્ટ લખાણ"
                                  />
                                )}
                              </div>
                            </td>
                          ) : (
                            data.columnKeys.map((col) => {
                              const cell = act.cols[col.key] || { v: '', ok: true };
                              return (
                                <td key={col.key} className="py-2 px-2 text-center">
                                  <div className="relative flex items-center justify-center">
                                    <input
                                      type="text"
                                      value={cell.v || ''}
                                      onChange={(e) =>
                                        handleActivityCellChange(idx, col.key, e.target.value)
                                      }
                                      placeholder="-"
                                      className="w-full max-w-[90px] app-input py-1 px-1.5 rounded-lg text-xs text-center font-num outline-none focus:ring-2 focus:ring-acc/40 font-medium"
                                    />
                                    {!cell.ok && (
                                      <span
                                        className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute right-1.5 top-1.5 shrink-0"
                                        title="અસ્પષ્ટ લખાણ"
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            })
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              className="w-full min-h-[48px] h-[48px] px-4 font-gujarati text-sm flex items-center justify-center"
              onClick={onClose}
            >
              રદ કરો
            </LiquidButton>
            <LiquidButton
              variant="primary"
              className="w-full min-h-[48px] h-[48px] px-4 font-gujarati text-sm flex items-center justify-center gap-1.5"
              onClick={() => onConfirmFill(data)}
            >
              <Check size={16} />
              <span>ફોર્મમાં ભરો ✅</span>
            </LiquidButton>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
};
