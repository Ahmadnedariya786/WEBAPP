import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeading } from '../components/ui/PageHeading';
import { HelpCircle, Book, Mail, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

const FAQS = [
  { q: "રિપોર્ટ કેવી રીતે સેવ કરવો?", a: "નવો રિપોર્ટ પેજ પર માહિતી ભરીને નીચે 'સાચવો' બટન પર ક્લિક કરો. આ માહિતી પાછલા રિપોર્ટ્સમાં સચવાઈ જશે." },
  { q: "ડ્રાફ્ટનો અર્થ શું છે?", a: "જો તમે રિપોર્ટ ભરતા હોવ અને અધવચ્ચે એપ બંધ થઈ જાય, તો માહિતી ડ્રાફ્ટ તરીકે સચવાય છે અને ફરી ખોલતા પાછી મળે છે." },
  { q: "રિપોર્ટ Excel માં કેવી રીતે લેવો?", a: "પાછલા રિપોર્ટ્સ પેજ પર કોઈપણ રિપોર્ટ કાર્ડમાં ડાઉનલોડ આઇકન દબાવો. બધા રિપોર્ટ એકસાથે લેવા ઉપરના Excel બટન પર ક્લિક કરો." },
  { q: "હલકાનું નામ કેવી રીતે બદલવું?", a: "નવો રિપોર્ટ પેજ પર હલકાના લિસ્ટમાં 'નવો હલકો ઉમેરો' પર ક્લિક કરી નવું નામ ઉમેરો." }
];

export const Help: React.FC = () => {
  const [faqOpen, setFaqOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap gap-2 justify-between items-center">
        <PageHeading title={t('help.title' as any)} icon={<HelpCircle className="text-acc shrink-0" />} />
      </header>

      <div className="space-y-4">
        {/* FAQ Accordion Container */}
        <div className="space-y-2">
          <GlassCard 
            hoverEffect 
            className={cn("p-5 flex items-center gap-4 cursor-pointer ")}
            onClick={() => setFaqOpen(!faqOpen)}
          >
            <div className="w-12 h-12 rounded-full bg-acc/10 flex items-center justify-center text-acc shrink-0">
              <Book size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-gujarati font-bold text-lg text-txt">{t('help.faq' as any)}</h3>
              <p className="text-sm text-sub font-gujarati mt-1">એપ્લિકેશનનો ઉપયોગ કેવી રીતે કરવો?</p>
            </div>
            <motion.div
              animate={{ rotate: faqOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-sub"
            >
              <ChevronDown size={20} />
            </motion.div>
          </GlassCard>

          <AnimatePresence>
            {faqOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pl-4 pr-2 py-2 space-y-2">
                  {FAQS.map((faq, idx) => {
                    const isOpen = openIndex === idx;
                    return (
                      <GlassCard key={idx} className="p-0 overflow-hidden bg-card">
                        <button
                          onClick={() => toggleFaq(idx)}
                          className="w-full text-left p-4 flex justify-between items-center font-gujarati text-txt font-bold"
                        >
                          {faq.q}
                          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-acc ml-2 shrink-0">
                            <ChevronDown size={16} />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <p className="p-4 pt-0 text-sm font-gujarati text-sub leading-relaxed">
                                {faq.a}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </GlassCard>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Email Support */}
        <a href="mailto:banaskantha.mehnat.support@gmail.com" className="block outline-none">
          <GlassCard hoverEffect className="p-4 flex items-center justify-between bg-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-acc/10 flex items-center justify-center text-acc shrink-0">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="font-bold font-gujarati text-txt">ઈમેલ સપોર્ટ</h3>
                <p className="text-sm text-sub font-num mt-1">banaskantha.mehnat.support@gmail.com</p>
              </div>
            </div>
          </GlassCard>
        </a>

        <div className="text-center pt-8">
          <p className="text-sm text-sub font-num tracking-wider">{t('help.app_version' as any)}</p>
          <p className="text-xs text-sub/50 mt-1 font-gujarati">{t('help.footer' as any)}</p>
        </div>
      </div>
    </div>
  );
};



