import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { localTodayIso, cn } from '../../lib/utils';
import { useOverlayScrollLock } from '../../lib/useOverlayScrollLock';

interface NeumorphicCalendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // 'YYYY-MM-DD' or ''
  onSelectDate: (date: string) => void;
}

const GUJARATI_MONTHS = [
  'જાન્યુઆરી',
  'ફેબ્રુઆરી',
  'માર્ચ',
  'એપ્રિલ',
  'મે',
  'જૂન',
  'જુલાઈ',
  'ઓગસ્ટ',
  'સપ્ટેમ્બર',
  'ઓક્ટોબર',
  'નવેમ્બર',
  'ડિસેમ્બર'
];

const GUJARATI_WEEKDAYS = ['રવિ', 'સોમ', 'મંગળ', 'બુધ', 'ગુરુ', 'શુક્ર', 'શનિ'];

export const NeumorphicCalendarDialog: React.FC<NeumorphicCalendarDialogProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate
}) => {
  // DATA KAVACH: Read-only access to reports state for report dots & month count
  const reports = useAppStore((state) => state.reports);

  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayScrollLock({ isOpen, onClose, panelRef });

  // Initialize view year & month from selectedDate or today
  const [navYear, setNavYear] = useState<number>(() => {
    const base = selectedDate || localTodayIso();
    const [y] = base.split('-').map(Number);
    return y || new Date().getFullYear();
  });

  const [navMonth, setNavMonth] = useState<number>(() => {
    const base = selectedDate || localTodayIso();
    const [, m] = base.split('-').map(Number);
    return (m ? m - 1 : new Date().getMonth());
  });

  // Year options: current year ±5
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const yrs: number[] = [];
    const min = Math.min(current - 5, navYear);
    const max = Math.max(current + 5, navYear);
    for (let y = min; y <= max; y++) {
      yrs.push(y);
    }
    return yrs;
  }, [navYear]);

  // Sync nav view whenever dialog opens or selectedDate changes externally
  useEffect(() => {
    if (isOpen) {
      const base = selectedDate || localTodayIso();
      const [y, m] = base.split('-').map(Number);
      if (y && m) {
        setNavYear(y);
        setNavMonth(m - 1);
      }
    }
  }, [isOpen, selectedDate]);

  // Month navigation wrapping years correctly
  const handlePrevMonth = () => {
    setNavMonth((prevMonth) => {
      if (prevMonth === 0) {
        setNavYear((prevYear) => prevYear - 1);
        return 11;
      }
      return prevMonth - 1;
    });
  };

  const handleNextMonth = () => {
    setNavMonth((prevMonth) => {
      if (prevMonth === 11) {
        setNavYear((prevYear) => prevYear + 1);
        return 0;
      }
      return prevMonth + 1;
    });
  };

  // Month saved-report count
  const monthReportsCount = useMemo(() => {
    const monthPrefix = `${navYear}-${String(navMonth + 1).padStart(2, '0')}`;
    return reports.filter((r) => r.date && r.date.startsWith(monthPrefix)).length;
  }, [reports, navYear, navMonth]);

  // Set of dates that have saved reports
  const reportDatesSet = useMemo(() => {
    return new Set(reports.map((r) => r.date).filter(Boolean));
  }, [reports]);

  // Fixed 42-cell grid (6 rows x 7 days) to ensure zero layout shift
  const calendarCells = useMemo(() => {
    const cells: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
    }> = [];

    const daysInCurMonth = new Date(navYear, navMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(navYear, navMonth, 1).getDay(); // 0 = Sunday

    // Previous month fill
    const prevYear = navMonth === 0 ? navYear - 1 : navYear;
    const prevMonth = navMonth === 0 ? 11 : navMonth - 1;
    const daysInPrevMonth = new Date(navYear, navMonth, 0).getDate();

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurMonth; d++) {
      const dateStr = `${navYear}-${String(navMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true
      });
    }

    // Next month fill to make exactly 42 cells (6 rows)
    const nextYear = navMonth === 11 ? navYear + 1 : navYear;
    const nextMonth = navMonth === 11 ? 0 : navMonth + 1;
    let nextDay = 1;
    while (cells.length < 42) {
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      cells.push({
        dayNumber: nextDay,
        dateStr,
        isCurrentMonth: false
      });
      nextDay++;
    }

    return cells;
  }, [navYear, navMonth]);

  const todayIso = localTodayIso();

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="viewport-fixed-overlay bg-black/50 backdrop-blur-xs"
          onClick={onClose}
          id="calendar-dialog-overlay"
        >
          <motion.div
            ref={panelRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="neu-cal-dialog flex flex-col select-none max-h-[90vh] overflow-y-auto"
            id="calendar-dialog-container"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
          >
            {/* Header Row: Prev button, Centered Title + Dropdown Pills + Subtitle, Next button */}
            <div className="flex items-center justify-between gap-1.5 mb-3 px-1">
              <button
                type="button"
                id="neu-cal-prev-btn"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="w-[40px] h-[40px] rounded-full neu-cal-btn flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex-1 text-center min-w-0 flex flex-col items-center">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <h3 className="neu-cal-title font-gujarati font-bold text-sm sm:text-base leading-tight truncate">
                    {GUJARATI_MONTHS[navMonth]} {navYear}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Month Dropdown Pill */}
                    <div className="neu-cal-dropdown-pill relative inline-flex items-center">
                      <select
                        id="neu-cal-month-select"
                        aria-label="મહિનો પસંદ કરો"
                        value={navMonth}
                        onChange={(e) => setNavMonth(Number(e.target.value))}
                        className="neu-cal-select font-gujarati text-xs cursor-pointer appearance-none bg-transparent pr-4 pl-2 py-1 outline-none font-semibold"
                      >
                        {GUJARATI_MONTHS.map((m, idx) => (
                          <option key={idx} value={idx}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="neu-cal-select-chevron pointer-events-none absolute right-1.5 opacity-60" />
                    </div>

                    {/* Year Dropdown Pill */}
                    <div className="neu-cal-dropdown-pill relative inline-flex items-center">
                      <select
                        id="neu-cal-year-select"
                        aria-label="વર્ષ પસંદ કરો"
                        value={navYear}
                        onChange={(e) => setNavYear(Number(e.target.value))}
                        className="neu-cal-select font-num text-xs cursor-pointer appearance-none bg-transparent pr-4 pl-2 py-1 outline-none font-semibold"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="neu-cal-select-chevron pointer-events-none absolute right-1.5 opacity-60" />
                    </div>
                  </div>
                </div>

                <p className="neu-cal-sub font-gujarati text-[11px] font-medium leading-normal mt-0.5">
                  {monthReportsCount} રિપોર્ટ્સ
                </p>
              </div>

              <button
                type="button"
                id="neu-cal-next-btn"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="w-[40px] h-[40px] rounded-full neu-cal-btn flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Weekday Header: Existing Gujarati abbreviations (Sunday first) */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2 px-1">
              {GUJARATI_WEEKDAYS.map((wd, i) => (
                <div
                  key={i}
                  className="neu-cal-weekday text-xs font-bold font-gujarati h-7 flex items-center justify-center"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Date Grid: 42 fixed circular discs (44px), zero layout shift */}
            <div className="grid grid-cols-7 gap-x-1 gap-y-1.5 justify-items-center items-center mb-4 px-1">
              {calendarCells.map((cell, idx) => {
                const isSelected = selectedDate === cell.dateStr;
                const isToday = todayIso === cell.dateStr;
                const hasReport = reportDatesSet.has(cell.dateStr);

                return (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    type="button"
                    onClick={() => {
                      onSelectDate(cell.dateStr);
                      onClose();
                    }}
                    className={cn(
                      'w-[44px] h-[44px] rounded-full flex flex-col items-center justify-center relative cursor-pointer font-num text-sm transition-all duration-150',
                      isSelected ? 'neu-cal-disc-selected' : 'neu-cal-disc',
                      isToday && !isSelected && 'neu-cal-disc-today',
                      !cell.isCurrentMonth && 'opacity-35'
                    )}
                    data-date={cell.dateStr}
                    aria-label={cell.dateStr}
                  >
                    <span className="leading-none">{cell.dayNumber}</span>
                    {hasReport && (
                      <span className="w-1.5 h-1.5 rounded-full neu-cal-dot absolute bottom-1.5 pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer: Neumorphic Pills "સાફ કરો" and "આજે" */}
            <div className="flex gap-2.5 px-1 pt-1">
              <button
                type="button"
                id="neu-cal-clear-btn"
                onClick={() => {
                  onSelectDate('');
                  onClose();
                }}
                className="flex-1 h-[44px] rounded-full neu-cal-pill-neutral font-gujarati text-sm font-semibold flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                સાફ કરો
              </button>

              <button
                type="button"
                id="neu-cal-today-btn"
                onClick={() => {
                  onSelectDate(todayIso);
                  onClose();
                }}
                className="flex-1 h-[44px] rounded-full neu-cal-pill-primary font-gujarati text-sm font-semibold flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                આજે
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
