import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { Moon, Globe, Shield, Info, CheckCircle, Key } from 'lucide-react';
import { useThemeStore, type Theme } from '../store/themeStore';
import { useAppStore } from '../store/appStore';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SETTINGS_MOUNT');
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-gujarati">{t('settings.title' as any)}</h2>
        <div className="text-xs font-gujarati bg-card px-3 py-1.5 rounded-full shadow-sm text-sub flex items-center gap-1.5">
          {useAppStore().sessionRole === 'admin' 
            ? <span className="inline-flex items-center gap-1">એડમિન લૉગિન <CheckCircle className="w-4 h-4 text-acc2" /></span>
            : useAppStore().sessionRole === 'team' 
              ? <span className="inline-flex items-center gap-1">ટીમ કોડ સક્રિય <CheckCircle className="w-4 h-4 text-acc2" /></span>
              : 'મહેમાન મોડ'}
        </div>
      </header>

      <div className="space-y-4">
        {/* Theme Settings */}
        <GlassCard className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-acc/10 flex items-center justify-center text-acc">
              <Moon size={20} />
            </div>
            <div>
              <div className="font-gujarati font-medium">{t('settings.theme' as any)}</div>
              <div className="text-xs text-sub font-gujarati mt-0.5">{t('settings.theme_desc' as any)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full">
            {(['outdoor', 'dark', 'premium'] as Theme[]).map((tVal) => (
              <button
                key={tVal}
                onClick={() => setTheme(tVal)}
                className={`px-3 py-2 font-gujarati text-sm font-medium rounded-full shadow-[inset_0_0_0_1px_rgb(var(--brd)/0.15)] ${
                  theme === tVal ? 'bg-acc text-white shadow-md' : 'bg-card text-sub hover:bg-txt/5'
                }`}
              >
                {tVal === 'outdoor' ? 'આઉટડોર' : tVal === 'dark' ? 'ગ્રેફાઇટ' : 'પ્રીમિયમ'}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Auth Link */}
        <GlassCard hoverEffect className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => useAppStore.setState({ authDialogOpen: true, authPendingAction: null })}>
          <div className="w-10 h-10 rounded-full bg-acc/10 flex items-center justify-center text-acc">
            <Key className="w-5 h-5" />
          </div>
          <div className="font-gujarati font-medium">ટીમ કોડ દાખલ કરો / બદલો</div>
        </GlassCard>

        {/* Language Settings (Mock) */}
        <GlassCard className="p-4 flex items-center justify-between opacity-75">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sub/10 flex items-center justify-center text-sub">
              <Globe size={20} />
            </div>
            <div>
              <div className="font-gujarati font-medium">{t('settings.language' as any)}</div>
              <div className="text-xs text-sub font-gujarati">ગુજરાતી (ફિક્સ)</div>
            </div>
          </div>
        </GlassCard>

        {/* Admin Link */}
        <GlassCard hoverEffect className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/admin')}>
          <div className="w-10 h-10 rounded-full bg-acc/10 flex items-center justify-center text-acc">
            <Shield size={20} />
          </div>
          <div className="font-gujarati font-medium">{t('nav.admin' as any)}</div>
        </GlassCard>

        {/* Help Link */}
        <GlassCard hoverEffect className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/help')}>
          <div className="w-10 h-10 rounded-full bg-acc/10 flex items-center justify-center text-acc">
            <Info size={20} />
          </div>
          <div className="font-gujarati font-medium">{t('nav.help' as any)}</div>
        </GlassCard>
      </div>
    </div>
  );
};
