import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Clock, BarChart2 } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../../lib/utils';

// Register @property in JavaScript if supported for robust cross-engine transition
if (typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function') {
  try {
    CSS.registerProperty({
      name: '--slot-x',
      syntax: '<length>',
      inherits: false,
      initialValue: '164px',
    });
  } catch {
    // Ignore if already registered
  }
}

interface NavItemConfig {
  path: string;
  label: 'nav.dashboard' | 'nav.new_report' | 'nav.past_reports';
  icon: typeof BarChart2;
}

const NAV_SLOTS: NavItemConfig[] = [
  { path: '/dashboard', label: 'nav.dashboard', icon: BarChart2 },
  { path: '/', label: 'nav.new_report', icon: FileText },
  { path: '/past-reports', label: 'nav.past_reports', icon: Clock },
];

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = [
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
  ];

  // Active route index mapping: 0 = Dashboard, 1 = New Report, 2 = Past Reports
  const getActiveIndex = () => {
    if (location.pathname === '/dashboard') return 0;
    if (location.pathname === '/past-reports') return 2;
    if (location.pathname === '/' || location.pathname === '/new-report') return 1;
    return 1;
  };

  const activeIndex = getActiveIndex();

  // Slot horizontal centers in px (defaults for 328px width: 54.67, 164, 273.33)
  const [slotCenters, setSlotCenters] = useState<number[]>([54.67, 164, 273.33]);

  // Icon cross-fade state: 120ms fade out old icon -> 100ms delay -> swap -> 120ms fade in new icon
  const [displayedIndex, setDisplayedIndex] = useState<number>(activeIndex);
  const [iconOpacity, setIconOpacity] = useState<number>(1);

  // Ripple state per slot
  const [ripples, setRipples] = useState<{ [key: number]: Ripple[] }>({
    0: [],
    1: [],
    2: [],
  });

  // Measure dynamic slot centers based on actual button layout
  const measureSlotCenters = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width === 0) return;

    const newCenters = slotRefs.map((ref, idx) => {
      if (ref.current) {
        const btnRect = ref.current.getBoundingClientRect();
        return btnRect.left - containerRect.left + btnRect.width / 2;
      }
      return ((idx * 2 + 1) * containerRect.width) / 6;
    });

    setSlotCenters(newCenters);
  };

  useLayoutEffect(() => {
    measureSlotCenters();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measureSlotCenters);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Icon cross-fade transition
  useEffect(() => {
    if (activeIndex === displayedIndex) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayedIndex(activeIndex);
      setIconOpacity(1);
      return;
    }

    // Step 1: Fade out old icon (120ms)
    setIconOpacity(0);

    // Step 2: Swap to new icon after 100ms and fade in (120ms)
    const swapTimer = setTimeout(() => {
      setDisplayedIndex(activeIndex);
      setIconOpacity(1);
    }, 100);

    return () => clearTimeout(swapTimer);
  }, [activeIndex, displayedIndex]);

  const activeCenterX = slotCenters[activeIndex] ?? 164;
  const ActiveIcon = NAV_SLOTS[displayedIndex]?.icon ?? FileText;

  // Handle slot tap with expanding ripple
  const handleSlotTap = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now() + Math.random();

      setRipples((prev) => ({
        ...prev,
        [index]: [...(prev[index] || []), { id, x, y }],
      }));

      setTimeout(() => {
        setRipples((prev) => ({
          ...prev,
          [index]: (prev[index] || []).filter((r) => r.id !== id),
        }));
      }, 450);
    }

    const target = NAV_SLOTS[index];
    if (target && location.pathname !== target.path) {
      navigate(target.path);
    }
  };

  return (
    <nav
      aria-label="મુખ્ય નેવિગેશન"
      className="bottom-nav-root fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 pointer-events-none"
      style={{
        bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        ref={containerRef}
        className="relative w-full h-16 pointer-events-auto select-none"
      >
        {/* Shadow Wrapper for Masked Bar */}
        <div className="bottom-nav-shadow-wrapper absolute inset-0 w-full h-full pointer-events-none">
          {/* Moving Cradle Cutout via CSS Mask Radial-Gradient */}
          <div
            className="bottom-nav-bar w-full h-full"
            style={{
              '--slot-x': `${activeCenterX}px`,
            } as React.CSSProperties}
          />
        </div>

        {/* Sliding 56px Raised Accent Circle with 5px Halo Ring & Soft Glow */}
        <button
          type="button"
          aria-label={t(NAV_SLOTS[activeIndex].label)}
          onClick={() => navigate(NAV_SLOTS[activeIndex].path)}
          className="bottom-nav-circle absolute left-0 top-0 w-14 h-14 rounded-full flex items-center justify-center z-20 cursor-pointer outline-none active:scale-[0.96]"
          style={{
            transform: `translate3d(${activeCenterX - 28}px, -28px, 0)`,
          }}
        >
          <div
            className="bottom-nav-circle-icon flex items-center justify-center pointer-events-none"
            style={{
              opacity: iconOpacity,
              transition: 'opacity 120ms ease',
            }}
          >
            <ActiveIcon size={24} strokeWidth={2.4} />
          </div>
        </button>

        {/* 3-Slot Navigation Buttons */}
        <div className="bottom-nav-slots relative z-10 w-full h-full flex items-center justify-between">
          {NAV_SLOTS.map((slot, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={slot.path}
                ref={slotRefs[index]}
                type="button"
                onClick={(e) => handleSlotTap(index, e)}
                aria-label={t(slot.label)}
                className={cn(
                  'bottom-nav-slot flex-1 min-w-[56px] min-h-[48px] h-full flex flex-col items-center justify-end pb-2 relative overflow-hidden',
                  'cursor-pointer outline-none select-none',
                  isActive ? 'bottom-nav-slot-active' : 'bottom-nav-slot-inactive'
                )}
              >
                {/* Translucent Tap Ripple */}
                {(ripples[index] || []).map((r) => (
                  <span
                    key={r.id}
                    className="bottom-nav-ripple absolute pointer-events-none rounded-full"
                    style={{ left: r.x, top: r.y }}
                  />
                ))}

                {/* Inactive Icon: 24px, muted; cross-fades out when active */}
                <div
                  className={cn(
                    'bottom-nav-slot-icon h-6 flex items-center justify-center mb-0.5 transition-all duration-200 ease-out',
                    isActive ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'
                  )}
                >
                  <slot.icon size={24} strokeWidth={2} />
                </div>

                {/* Gujarati Label (Semibold & strong token when active, muted when inactive) */}
                <span
                  className={cn(
                    'bottom-nav-slot-label font-gujarati text-[11px] leading-tight whitespace-nowrap transition-colors duration-200',
                    isActive ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {t(slot.label)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
export default BottomNav;
