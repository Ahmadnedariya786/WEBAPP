import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { LiquidButton } from '../components/ui/LiquidButton';
import { ChevronRight, Check } from 'lucide-react';

export const Onboarding: React.FC = () => {
  const { setHasCompletedOnboarding } = useAppStore();
  const [slide, setSlide] = useState(0);

  const slides = [
    { title: t('onboarding.slide1.title' as any) || 'સ્વાગત છે', desc: t('onboarding.slide1.desc' as any) || 'બનાસકાંઠા સ્ટુડન્ટ મહેનત ટ્રેકરમાં તમારું સ્વાગત છે.' },
    { title: t('onboarding.slide2.title' as any) || 'રિપોર્ટ બનાવો', desc: t('onboarding.slide2.desc' as any) || 'તમારા હલકાનો રિપોર્ટ ખૂબ જ સરળતાથી બનાવો.' },
    { title: t('onboarding.slide3.title' as any) || 'ડેટા ડેશબોર્ડ', desc: t('onboarding.slide3.desc' as any) || 'તમારી મહેનતનો ગ્રાફ અને આંકડા જુઓ.' },
  ];

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      setHasCompletedOnboarding(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden max-w-md mx-auto">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-acc rounded-full blur-[60px] pointer-events-none" />
      
      <GlassCard className="w-full flex flex-col h-[60vh] relative">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-[22px] font-extrabold text-txt font-gujarati uppercase min-w-0 truncate">{slides[slide].title}</h2>
                <div className="h-1 w-12 bg-acc rounded-full" />
              </div>
              <p className="text-sub font-gujarati text-lg">{slides[slide].desc}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-6 mt-auto">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <div 
                key={i} 
                className={`h-2 rounded-full  duration-300 ${i === slide ? 'w-6 bg-acc' : 'w-2 bg-acc'}`}
              />
            ))}
          </div>

          <LiquidButton 
            className="w-full" 
            onClick={handleNext}
          >
            {slide === slides.length - 1 ? (
              <>
                <Check size={18} />
                <span className="font-gujarati">{t('onboarding.btn_start' as any) || 'શરૂ કરો'}</span>
              </>
            ) : (
              <>
                <span className="font-gujarati">{t('onboarding.btn_next' as any) || 'આગળ વધો'}</span>
                <ChevronRight size={18} />
              </>
            )}
          </LiquidButton>
        </div>
      </GlassCard>
    </div>
  );
};

