import React, { useRef, useState, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Clock, BarChart2 } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../../lib/utils';

/**
 * Calculates a mathematically smooth SVG path for the cradle navigation bar:
 * - Rounded pill corners (rCorner)
 * - Flat top edges on left and right wings
 * - Convex shoulder fillets (shoulderRadius = 14px)
 * - Concave cradle arc (cradleRadius = 33px for 56px FAB + 5px halo gap)
 * - Tangent continuity across all transitions (zero jagged corners)
 */
function getCradleBarPath(w: number, h = 64, rCorner = 28): string {
  const x0 = w / 2;
  const cradleRadius = 33; // 28px FAB radius + 5px halo gap
  const shoulderRadius = 14; // smooth convex fillet blending into top edge
  const dy = shoulderRadius; // vertical offset of shoulder center from cradle center (y = 0)
  const dist = cradleRadius + shoulderRadius; // 47px
  const dx = Math.sqrt(dist * dist - dy * dy); // ~44.866px

  // Tangency point between shoulder circle and cradle circle
  const tx = dx * (cradleRadius / dist); // ~31.502px
  const ty = shoulderRadius * (cradleRadius / dist); // ~9.830px

  return [
    `M ${rCorner} 0`,
    `L ${x0 - dx} 0`,
    `A ${shoulderRadius} ${shoulderRadius} 0 0 1 ${x0 - tx} ${ty}`,
    `A ${cradleRadius} ${cradleRadius} 0 0 0 ${x0 + tx} ${ty}`,
    `A ${shoulderRadius} ${shoulderRadius} 0 0 1 ${x0 + dx} 0`,
    `L ${w - rCorner} 0`,
    `A ${rCorner} ${rCorner} 0 0 1 ${w} ${rCorner}`,
    `L ${w} ${h - rCorner}`,
    `A ${rCorner} ${rCorner} 0 0 1 ${w - rCorner} ${h}`,
    `L ${rCorner} ${h}`,
    `A ${rCorner} ${rCorner} 0 0 1 0 ${h - rCorner}`,
    `L 0 ${rCorner}`,
    `A ${rCorner} ${rCorner} 0 0 1 ${rCorner} 0`,
    `Z`,
  ].join(' ');
}

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial estimate clamped between 288px and 448px
  const [barWidth, setBarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.min(Math.max(window.innerWidth - 32, 288), 448);
    }
    return 360;
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.offsetWidth;
      if (w > 0) setBarWidth(w);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const pathD = getCradleBarPath(barWidth, 64, 28);

  const isDashboardActive = location.pathname === '/dashboard';
  const isPastReportsActive = location.pathname === '/past-reports';
  const isFabActive = location.pathname === '/' || location.pathname === '/new-report';

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
        {/* Seamless Concave Cradle Background */}
        <svg
          className="bottom-nav-svg absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          viewBox={`0 0 ${barWidth} 64`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={pathD} className="bottom-nav-fill" />
        </svg>

        {/* Seated Center FAB (Half-raised above bar top edge with 5px halo gap) */}
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label={t('nav.new_report')}
          className={cn(
            'bottom-nav-fab absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
            'w-14 h-14 rounded-full flex items-center justify-center z-20',
            'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2',
            isFabActive && 'bottom-nav-fab-active'
          )}
        >
          <FileText size={22} strokeWidth={2.2} className="bottom-nav-fab-icon" />
        </button>

        {/* 3-Slot Navigation Buttons */}
        <div className="relative z-10 w-full h-full flex items-center justify-between px-3 sm:px-6">
          {/* Slot 1: ડેશબોર્ડ (Dashboard) */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={cn(
              'bottom-nav-btn flex-1 min-w-[56px] min-h-[48px] h-full flex flex-col items-center justify-center',
              'cursor-pointer outline-none transition-colors transition-transform duration-150 ease-out',
              isDashboardActive ? 'bottom-nav-btn-active' : 'bottom-nav-btn-inactive'
            )}
          >
            <BarChart2
              size={20}
              strokeWidth={isDashboardActive ? 2.4 : 1.9}
              className="bottom-nav-btn-icon"
            />
            <span className="bottom-nav-btn-label font-gujarati text-[11px] leading-tight mt-1 whitespace-nowrap">
              {t('nav.dashboard')}
            </span>
            <span
              className={cn(
                'bottom-nav-dot w-1.5 h-1.5 rounded-full mt-0.5 transition-opacity duration-150',
                isDashboardActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            />
          </button>

          {/* Center spacer reserving the cradle dip width (88px) */}
          <div className="w-[88px] h-full shrink-0 pointer-events-none" aria-hidden="true" />

          {/* Slot 3: પાછલા રિપોર્ટ્સ (Past Reports) */}
          <button
            type="button"
            onClick={() => navigate('/past-reports')}
            className={cn(
              'bottom-nav-btn flex-1 min-w-[56px] min-h-[48px] h-full flex flex-col items-center justify-center',
              'cursor-pointer outline-none transition-colors transition-transform duration-150 ease-out',
              isPastReportsActive ? 'bottom-nav-btn-active' : 'bottom-nav-btn-inactive'
            )}
          >
            <Clock
              size={20}
              strokeWidth={isPastReportsActive ? 2.4 : 1.9}
              className="bottom-nav-btn-icon"
            />
            <span className="bottom-nav-btn-label font-gujarati text-[11px] leading-tight mt-1 whitespace-nowrap">
              {t('nav.past_reports')}
            </span>
            <span
              className={cn(
                'bottom-nav-dot w-1.5 h-1.5 rounded-full mt-0.5 transition-opacity duration-150',
                isPastReportsActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            />
          </button>
        </div>
      </div>
    </nav>
  );
};
export default BottomNav;
