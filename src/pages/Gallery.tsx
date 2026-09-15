import React from 'react';
import { LiquidButton } from '../components/ui/LiquidButton';
import { GlassCard } from '../components/ui/GlassCard';
import { LiquidSwitch } from '../components/ui/LiquidSwitch';
import ThemeSwitcher from '../components/ui/ThemeSwitcher';
import { t } from '../i18n';
import { Settings, Home, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export const Gallery: React.FC = () => {
  const [switchState, setSwitchState] = React.useState(false);

  return (
    <div className="max-w-md mx-auto p-6 space-y-8 pb-24">
      <header className="flex flex-wrap gap-4 items-center justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold font-gujarati truncate">{t('gallery.title')}</h1>
          <p className="text-sm text-sub font-gujarati truncate">{t('gallery.subtitle')}</p>
        </div>
        <div className="shrink-0">
          <ThemeSwitcher />
        </div>
      </header>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-wider text-sub font-gujarati">{t('gallery.section_buttons')}</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <LiquidButton variant="primary">
            <CheckCircle size={18} />
            {t('btn.primary')}
          </LiquidButton>
          
          <LiquidButton variant="neutral">
            {t('btn.neutral')}
          </LiquidButton>
          
          <LiquidButton variant="success">
            {t('btn.success')}
          </LiquidButton>
          
          <LiquidButton variant="warning">
            <AlertTriangle size={18} />
            {t('btn.warning')}
          </LiquidButton>
          
          <LiquidButton variant="danger" className="col-span-2">
            {t('btn.danger_wide')}
          </LiquidButton>
        </div>

        <div className="flex gap-4 items-center">
          <LiquidButton variant="neutral" size="icon">
            <Settings size={20} />
          </LiquidButton>
          <LiquidButton variant="primary" size="icon">
            <Home size={20} />
          </LiquidButton>
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-wider text-sub font-gujarati">{t('gallery.section_cards')}</h2>
        
        <GlassCard hoverEffect>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-acc/10 text-acc flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <span className="font-medium text-sm text-sub uppercase">{t('stat.students_count')}</span>
              </div>
              <h3 className="text-4xl font-bold font-num">1,204</h3>
            </div>
            <LiquidSwitch checked={switchState} onChange={setSwitchState} />
          </div>
          <div className="mt-4 pt-4 border-t border-brd/10 flex justify-between text-sm text-sub">
            <span className="font-gujarati">{t('stat.vs_last_month')}</span>
          </div>
        </GlassCard>

        <GlassCard className="bg-gradient-premium shadow-none text-white">
          <h3 className="text-xl font-bold mb-2 font-gujarati">{t('gallery.premium_card_title')}</h3>
          <p className="text-sub text-sm font-gujarati">{t('gallery.premium_card_desc')}</p>
          <div className="mt-4">
            <LiquidButton variant="neutral" className="text-white w-full">
              {t('btn.action')}
            </LiquidButton>
          </div>
        </GlassCard>
      </section>

      {/* Bottom Nav Mockup */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm">
        <div className="glass-pill h-16 flex items-center justify-around px-2">
          <div className="flex flex-col items-center justify-center w-14 h-12 rounded-full text-sub">
            <Home size={20} />
            <span className="text-[10px] mt-1 font-medium">{t('nav.dashboard')}</span>
          </div>
          <div className="flex flex-col items-center justify-center w-16 h-12 rounded-full bg-acc text-white shadow-lg shadow-acc/30 -translate-y-2">
            <FileText size={20} />
            <span className="text-[10px] mt-1 font-medium">{t('nav.new_report')}</span>
          </div>
          <div className="flex flex-col items-center justify-center w-14 h-12 rounded-full text-sub">
            <Settings size={20} />
            <span className="text-[10px] mt-1 font-medium">{t('nav.settings')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
