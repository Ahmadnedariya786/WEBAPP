import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Clock, BarChart2, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../../lib/utils';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import { useAppStore } from '../../store/appStore';

const NAV_ITEMS = [
  { path: '/dashboard', icon: BarChart2, label: 'nav.dashboard' },
  { path: '/', icon: FileText, label: 'nav.new_report', isPrimary: true },
  { path: '/past-reports', icon: Clock, label: 'nav.past_reports' },
];

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshAll } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshAll();
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'ડેટા રિફ્રેશ થયો ✅' }));
    setTimeout(() => setIsRefreshing(false), 500); // Ensures animation spins for at least 0.5s
  };

  return (
    <div className="min-h-screen bg-bg text-txt">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-4 bg-transparent flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-extrabold text-txt font-gujarati uppercase tracking-wide min-w-0 truncate">
            Mehnat Tracker
          </h1>
          <div className="h-1 w-12 bg-acc rounded-full" />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ThemeSwitcher />
          
          <button 
            type="button" 
            onClick={handleRefresh}
            aria-label="રિફ્રેશ" 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-transparent hover:bg-acc/10 active:bg-acc/20 transition-colors" 
          >
            <RefreshCw size={18} className={cn("text-txt", isRefreshing && "motion-safe:animate-spin")} />
          </button>

          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              navigate('/settings');
            }} 
            aria-label="સેટિંગ્સ" 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-transparent hover:bg-acc/10 active:bg-acc/20 transition-colors" 
          >
            <SettingsIcon size={18} className="text-txt"/>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 pb-28 md:pb-32 relative w-full sm:max-w-2xl lg:max-w-6xl mx-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-2xl z-50">
        <div className="bg-card/70 backdrop-blur-xl rounded-full h-16 flex items-center justify-around px-2 relative overflow-hidden" style={{boxShadow: 'inset 0 0 0 1px rgb(var(--brd) / 0.15), 0 8px 32px rgb(var(--shadow-color) / var(--shadow-alpha))'}}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/new-report');
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center  duration-300 relative",
                  item.isPrimary ? "w-16 h-16 rounded-full" : "w-14 h-12 rounded-full",
                  isActive && !item.isPrimary ? "text-acc" : "text-sub"
                )}
              >
                {item.isPrimary ? (
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center shadow-lg ",
                      isActive ? "bg-acc text-white shadow-lg shadow-acc/40" : "bg-card text-acc"
                    )}
                  >
                    <item.icon size={18} />
                  </motion.div>
                ) : (
                  <>
                    <item.icon size={18} className="mb-1" />
                    <span className="text-[10px] font-medium font-gujarati">{t(item.label as any)}</span>
                    {isActive && (
                      <motion.div 
                        layoutId="bottom-nav-indicator"
                        className="absolute -bottom-1 w-1 h-1 rounded-full bg-acc"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
