import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { t } from '../i18n';
import { PageHeading } from '../components/ui/PageHeading';
import { TrendingUp, ListOrdered, ArrowDownWideNarrow } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { formatDate, localTodayIso } from '../lib/utils';

// Donut Ring Component (104px diameter, 10px stroke, rounded stroke-caps, 700ms sweep animation)
const DonutRing: React.FC<{
  progress: number;
  label: string;
  delay?: number;
}> = ({ progress, label, delay = 0 }) => {
  const size = 104;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2; // 47px
  const circumference = 2 * Math.PI * radius; // ~295.31px
  const targetOffset = circumference - (progress / 100) * circumference;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Background Track (15% opacity) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-muted/15"
          />
          {/* Animated Arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            className="dashboard-donut-arc"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: prefersReducedMotion ? targetOffset : circumference }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.7, ease: [0.4, 0, 0.2, 1], delay }
            }
          />
        </svg>
        {/* Center % value (22sp extrabold) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-num text-[22px] font-extrabold text-txt leading-none">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      {/* Label below donut (12sp, muted) */}
      <span className="mt-2.5 font-gujarati text-xs text-muted text-center line-clamp-2 px-1 leading-snug">
        {label}
      </span>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { reports } = useAppStore();

  const totalStudents = useMemo(() => {
    return reports.reduce(
      (sum, r) =>
        sum +
        ((r.stats?.std_10 || 0) +
          (r.stats?.std_11 || 0) +
          (r.stats?.std_12 || 0) +
          (r.stats?.college || 0)),
      0
    );
  }, [reports]);

  // Context line values
  const latestReport = reports[0];
  const currentHalqa = latestReport?.halqa || 'બનાસકાંઠા';
  const currentDate = latestReport?.date
    ? formatDate(latestReport.date)
    : formatDate(localTodayIso());

  // Count-up animation for header value (600ms ease-out)
  const [displayCount, setDisplayCount] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPrefersReducedMotion(isReduced);

    if (isReduced || totalStudents === 0) {
      setDisplayCount(totalStudents);
      return;
    }

    const duration = 600;
    const startTime = performance.now();
    let animId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(easeOut * totalStudents));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [totalStudents]);

  // 13 Activity items
  const ACTIVITY_KEYS = [
    { key: 'activity.namaz', value: 85 },
    { key: 'activity.mashwara_pabandi', value: 70 },
    { key: 'activity.taleem', value: 65 },
    { key: 'activity.gasht', value: 50 },
    { key: 'activity.panchkosa', value: 45 },
    { key: 'activity.shabguzari', value: 40 },
    { key: 'activity.mulaqat_percent', value: 60 },
    { key: 'activity.school_namaz', value: 30 },
    { key: 'activity.jamaat_3', value: 15 },
    { key: 'activity.jamaat_10', value: 5 },
    { key: 'activity.jamaat_40', value: 2 },
    { key: 'activity.jamaat_4m', value: 0 },
    { key: 'activity.mashwara_when_where', value: 90 },
  ];

  // Sort state: 'activity' (default sequence) | 'desc' (percentage descending)
  type SortType = 'activity' | 'desc';
  const [sortBy, setSortBy] = useState<SortType>('activity');

  const sortedActivities = useMemo(() => {
    const list = ACTIVITY_KEYS.map((item, index) => ({
      ...item,
      originalIndex: index + 1,
      label: t(item.key as any),
    }));

    if (sortBy === 'desc') {
      return [...list].sort((a, b) => b.value - a.value);
    }
    return list;
  }, [sortBy]);

  return (
    <div className="space-y-4 pb-12 relative">
      {/* Page Heading */}
      <header className="flex flex-wrap gap-2 justify-between items-center mb-1">
        <PageHeading title={t('nav.dashboard')} />
      </header>

      {/* D5 Responsive Grid: Mobile stacked, Desktop (≥900px) two-column layout */}
      <div className="dashboard-layout-container min-[900px]:grid min-[900px]:grid-cols-12 min-[900px]:gap-6 min-[900px]:items-start w-full">
        {/* Left Column (~42% on desktop): Header Zone + Overlapping Target Card */}
        <div className="dashboard-left-column min-[900px]:col-span-5 w-full">
          {/* D1. COLORED HEADER ZONE (rounded-bottom 24px, full-width) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="dashboard-header-zone rounded-b-[24px] p-5 relative overflow-hidden"
          >
            {/* Small Context Line (12sp, on-accent muted) */}
            <div className="header-context text-xs font-gujarati tracking-wide mb-1 font-medium">
              {currentHalqa} • {currentDate}
            </div>

            {/* Label (13sp, on-accent muted) */}
            <div className="header-label text-[13px] font-gujarati font-medium mb-1">
              {t('stat.students_count')}
            </div>

            {/* Value (44sp extrabold, on-accent, count-up animation) */}
            <div className="header-value text-[44px] leading-none font-num font-extrabold mb-3 tracking-tight">
              {displayCount.toLocaleString('en-IN')}
            </div>

            {/* Change Chip: "+0% ગયા માસ કરતા" */}
            <div className="inline-flex items-center">
              <span className="header-chip rounded-full px-3 py-1 text-xs inline-flex items-center gap-1.5 backdrop-blur-sm font-num font-medium">
                <TrendingUp size={13} className="text-emerald-400 shrink-0" />
                <span className="font-bold">+0%</span>
                <span className="font-gujarati opacity-90">ગયા માસ કરતા</span>
              </span>
            </div>
          </motion.div>

          {/* D2. OVERLAPPING TARGET CARD (pulled up -24px over header's bottom edge) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : 0.08 }}
            className="dashboard-card dashboard-target-card -mt-6 relative z-10 rounded-[20px] p-5 shadow-lg"
          >
            {/* Title (15sp semibold, theme text) */}
            <h3 className="text-[15px] font-gujarati font-semibold text-txt mb-4">
              {t('dashboard.vs_target' as any)}
            </h3>

            {/* Two Donut Rings side by side */}
            <div className="flex items-start justify-around gap-2">
              {/* Donut 1: Canonical label "નમાઝોની પાબંદી 85/100" */}
              <DonutRing
                progress={85}
                label={`${t('activity.namaz')} 85/100`}
                delay={prefersReducedMotion ? 0 : 0.1}
              />
              {/* Donut 2: "મુલાકાત કેટલી થઈ (%)" */}
              <DonutRing
                progress={60}
                label={t('activity.mulaqat_percent')}
                delay={prefersReducedMotion ? 0 : 0.15}
              />
            </div>
          </motion.div>
        </div>

        {/* Right Column (~58% on desktop): Activities Card */}
        <div className="dashboard-right-column min-[900px]:col-span-7 w-full mt-5 min-[900px]:mt-0">
          {/* D3. ACTIVITIES CARD (separated by 20px margin from target card on mobile) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : 0.16 }}
            className="dashboard-card dashboard-activities-card rounded-[20px] p-5 shadow-lg"
          >
            {/* Card Header: Title + Sort Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h3 className="text-base font-gujarati font-bold text-txt">
                પ્રવૃત્તિ સારાંશ (બધા હલકા)
              </h3>

              {/* Two Sort Pills with Distinct Icons & Visual Distinction */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortBy('activity')}
                  className={`dashboard-sort-pill px-3 py-1.5 rounded-full text-xs font-gujarati cursor-pointer outline-none transition-all ${
                    sortBy === 'activity'
                      ? 'dashboard-sort-pill-active font-semibold shadow-sm'
                      : 'dashboard-sort-pill-inactive font-medium'
                  }`}
                  aria-label="પ્રવૃત્તિ ક્રમ"
                  aria-pressed={sortBy === 'activity'}
                >
                  <span className="flex items-center gap-1.5">
                    <ListOrdered size={14} className="shrink-0" />
                    પ્રવૃત્તિ
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy('desc')}
                  className={`dashboard-sort-pill px-3 py-1.5 rounded-full text-xs font-gujarati cursor-pointer outline-none transition-all ${
                    sortBy === 'desc'
                      ? 'dashboard-sort-pill-active font-semibold shadow-sm'
                      : 'dashboard-sort-pill-inactive font-medium'
                  }`}
                  aria-label="અવરોહી ક્રમ"
                  aria-pressed={sortBy === 'desc'}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowDownWideNarrow size={14} className="shrink-0" />
                    અવરોહી
                  </span>
                </button>
              </div>
            </div>

            {/* 13 Rows, whitespace-separated (14px vertical rhythm) */}
            <div className="space-y-3.5">
              {sortedActivities.map((item, i) => (
                <div key={item.key} className="space-y-1.5">
                  {/* Top line: 22px rank chip + label + % value */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="dashboard-rank-chip w-[22px] h-[22px] rounded-full flex items-center justify-center font-num text-[11px] font-bold shrink-0">
                        {sortBy === 'desc' ? i + 1 : item.originalIndex}
                      </span>
                      <span className="text-sm font-gujarati font-medium text-txt truncate">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-sm font-num font-semibold text-acc shrink-0">
                      {item.value}%
                    </span>
                  </div>

                  {/* Bottom line: 6px rounded progress bar with staggered fill */}
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted/15">
                    <motion.div
                      className="dashboard-bar-fill h-full rounded-full"
                      initial={prefersReducedMotion ? false : { width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : {
                              duration: 0.5,
                              delay: i * 0.06,
                              ease: [0.4, 0, 0.2, 1],
                            }
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
