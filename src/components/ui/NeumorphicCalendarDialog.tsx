import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
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

export const NeumorphicCalendarDialog = React.memo<NeumorphicCalendarDialogProps>(({
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

  // Custom themed dropdown state (D3)
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  // Close dropdowns when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setMonthDropdownOpen(false);
      setYearDropdownOpen(false);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape closes open dropdowns without closing whole calendar dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (monthDropdownOpen) {
          e.stopPropagation();
          setMonthDropdownOpen(false);
        } else if (yearDropdownOpen) {
          e.stopPropagation();
          setYearDropdownOpen(false);
        }
      }
    };
    if (monthDropdownOpen || yearDropdownOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [monthDropdownOpen, yearDropdownOpen]);

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
        <motion.div
          key="calendar-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="viewport-fixed-overlay bg-black/50 md:backdrop-blur-sm"
          onClick={onClose}
          id="calendar-dialog-overlay"
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            onClick={(e) => {
              e.stopPropagation();
              setMonthDropdownOpen(false);
              setYearDropdownOpen(false);
            }}
            className="neu-cal-dialog flex flex-col select-none max-h-[90vh] overflow-y-auto relative"
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
                    {/* Month Dropdown Sheet Trigger & Popover */}
                    <div className="relative inline-flex items-center">
                      <button
                        type="button"
                        id="neu-cal-month-select"
                        aria-label="મહિનો પસંદ કરો"
                        aria-haspopup="listbox"
                        aria-expanded={monthDropdownOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMonthDropdownOpen((prev) => !prev);
                          setYearDropdownOpen(false);
                        }}
                        className="neu-cal-dropdown-pill font-gujarati text-xs cursor-pointer bg-transparent pr-2 pl-2.5 py-1 outline-none font-semibold flex items-center gap-1"
                      >
                        <span>{GUJARATI_MONTHS[navMonth]}</span>
                        <ChevronDown size={11} className={`neu-cal-select-chevron transition-transform duration-150 opacity-60 ${monthDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {monthDropdownOpen && (
                          <motion.ul
                            key="neu-cal-month-menu"
                            role="listbox"
                            aria-label="મહિનો પસંદ કરો"
                            initial={{ opacity: 0, y: -4, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.96 }}
                            transition={{ duration: 0.16, ease: 'easeOut' }}
                            className="neu-cal-dropdown-menu absolute top-full left-0 mt-1.5 z-50 min-w-[130px] max-h-[60vh] overflow-y-auto rounded-2xl p-1.5 shadow-xl border outline-none font-gujarati text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {GUJARATI_MONTHS.map((m, idx) => {
                              const isSelected = navMonth === idx;
                              return (
                                <li
                                  key={idx}
                                  role="option"
                                  aria-selected={isSelected}
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNavMonth(idx);
                                    setMonthDropdownOpen(false);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setNavMonth(idx);
                                      setMonthDropdownOpen(false);
                                    }
                                  }}
                                  className={`neu-cal-dropdown-item flex items-center justify-between px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                    isSelected ? 'is-selected font-bold' : ''
                                  }`}
                                >
                                  <span>{m}</span>
                                  {isSelected && (
                                    <Check size={13} className="neu-cal-dropdown-check shrink-0 stroke-[2.5]" />
                                  )}
                                </li>
                              );
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Year Dropdown Sheet Trigger & Popover */}
                    <div className="relative inline-flex items-center">
                      <button
                        type="button"
                        id="neu-cal-year-select"
                        aria-label="વર્ષ પસંદ કરો"
                        aria-haspopup="listbox"
                        aria-expanded={yearDropdownOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setYearDropdownOpen((prev) => !prev);
                          setMonthDropdownOpen(false);
                        }}
                        className="neu-cal-dropdown-pill font-num text-xs cursor-pointer bg-transparent pr-2 pl-2.5 py-1 outline-none font-semibold flex items-center gap-1"
                      >
                        <span>{navYear}</span>
                        <ChevronDown size={11} className={`neu-cal-select-chevron transition-transform duration-150 opacity-60 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {yearDropdownOpen && (
                          <motion.ul
                            key="neu-cal-year-menu"
                            role="listbox"
                            aria-label="વર્ષ પસંદ કરો"
                            initial={{ opacity: 0, y: -4, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.96 }}
                            transition={{ duration: 0.16, ease: 'easeOut' }}
                            className="neu-cal-dropdown-menu absolute top-full right-0 mt-1.5 z-50 min-w-[90px] max-h-[60vh] overflow-y-auto rounded-2xl p-1.5 shadow-xl border outline-none font-num text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {yearOptions.map((y) => {
                              const isSelected = navYear === y;
                              return (
                                <li
                                  key={y}
                                  role="option"
                                  aria-selected={isSelected}
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNavYear(y);
                                    setYearDropdownOpen(false);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setNavYear(y);
                                      setYearDropdownOpen(false);
                                    }
                                  }}
                                  className={`neu-cal-dropdown-item flex items-center justify-between px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                    isSelected ? 'is-selected font-bold' : ''
                                  }`}
                                >
                                  <span>{y}</span>
                                  {isSelected && (
                                    <Check size={13} className="neu-cal-dropdown-check shrink-0 stroke-[2.5]" />
                                  )}
                                </li>
                              );
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
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

            {/* Footer: Neumorphic Sticky Footer Pills "સાફ કરો" and "આજે" */}
            <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 p-3 mt-2 border-t border-brd/20 bg-card rounded-b-[24px]">
              <button
                type="button"
                id="neu-cal-clear-btn"
                onClick={() => {
                  onSelectDate('');
                  onClose();
                }}
                className="w-full min-h-[48px] h-[48px] rounded-full neu-cal-pill-neutral font-gujarati text-sm font-semibold flex items-center justify-center cursor-pointer transition-all active:scale-95"
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
                className="w-full min-h-[48px] h-[48px] rounded-full neu-cal-pill-primary font-gujarati text-sm font-semibold flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                આજે
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

NeumorphicCalendarDialog.displayName = 'NeumorphicCalendarDialog';
