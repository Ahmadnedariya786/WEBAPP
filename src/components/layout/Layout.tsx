import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import { useAppStore } from '../../store/appStore';
import { BottomNav } from './BottomNav';

export const Layout: React.FC = () => {
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
      <main className="p-4 sm:p-6 pb-36 md:pb-40 relative w-full sm:max-w-2xl lg:max-w-6xl mx-auto">
        <Outlet />
      </main>

      {/* S35 Bottom Navigation: Concave Cradle Cutout with Seated Center FAB */}
      <BottomNav />
    </div>
  );
};
