import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Loader2, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { supabaseService } from '../../services/supabaseService';
import { useOverlayScrollLock } from '../../lib/useOverlayScrollLock';

export const AuthDialog: React.FC = () => {
  const { authDialogOpen, closeAuthDialog, setSession, authPendingAction } = useAppStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayScrollLock({ isOpen: authDialogOpen, onClose: closeAuthDialog, panelRef });

  React.useEffect(() => {
    const handleToast = (e: any) => showNotification(e.detail);
    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const role = await supabaseService.loginCode(code.trim().toUpperCase());
      if (role) {
        setSession(code.trim().toUpperCase(), role);
        setUnlockSuccess(true);
        // Quick check pop → close after 600 ms
        setTimeout(() => {
          setUnlockSuccess(false);
          closeAuthDialog();
          if (authPendingAction) {
            authPendingAction();
          }
        }, 600);
      } else {
        showNotification('અમાન્ય કોડ ❌');
      }
    } catch (err) {
      showNotification('ભૂલ આવી ❌');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Toast */}
      {showToast && (
        <div className="fixed inset-x-4 bottom-24 z-[100] flex justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="w-full max-w-md rounded-2xl bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-2 shadow-lg border border-brd/10"
          >
            <span className="flex-1 text-sm text-txt font-gujarati font-medium">{toastMessage}</span>
          </motion.div>
        </div>
      )}

      {authDialogOpen && (
        <div
          className="viewport-fixed-overlay bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeAuthDialog(); }}
          id="auth-dialog-overlay"
        >
          {/* Centered dialog */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-[92%] max-w-sm max-h-[85vh] overflow-y-auto neu-raised rounded-3xl p-6 relative pointer-events-auto select-none"
            role="dialog"
            aria-modal="true"
            aria-label="ટીમ કોડ લૉગિન"
            id="auth-dialog-container"
            tabIndex={-1}
          >
            <button
              onClick={closeAuthDialog}
              className="absolute top-4 right-4 text-sub hover:text-txt transition-colors cursor-pointer"
              aria-label="બંધ કરો"
            >
              <X size={20} />
            </button>

              <AnimatePresence mode="wait">
                {unlockSuccess ? (
                  /* ── Quick success check pop ── */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4 py-6"
                  >
                    <div
                      className="w-16 h-16 rounded-full neu-raised flex items-center justify-center neu-check-in"
                      style={{ color: 'rgb(16 185 129)' }}
                    >
                      <CheckCircle size={32} />
                    </div>
                    <p className="font-gujarati font-semibold text-txt text-sm">
                      અનલૉક સફળ ✅
                    </p>
                  </motion.div>
                ) : (
                  /* ── Code entry form ── */
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  >
                    <div className="flex flex-col items-center mb-6">
                      {/* Lock icon bubble — raised circle */}
                      <div className="w-12 h-12 rounded-full neu-raised text-acc flex items-center justify-center mb-4">
                        <Lock size={22} />
                      </div>
                      <h2
                        className="text-xl font-bold font-gujarati text-txt text-center"
                        style={{ textShadow: '1px 1px 2px var(--neu-dark), -1px -1px 1px var(--neu-light)' }}
                      >
                        કોડ દાખલ કરો
                      </h2>
                      <p className="text-sm text-sub mt-2 text-center font-gujarati">
                        આ ક્રિયા માટે ઍક્સેસ કોડ જરૂરી છે.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Neu-inset code input */}
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="MT-XXXX-XXXX"
                        className="w-full app-input rounded-full px-5 py-3.5 outline-none font-num text-center tracking-widest placeholder:tracking-normal placeholder-opacity-50 uppercase focus:ring-2 focus:ring-acc/40 transition-shadow text-sm"
                        disabled={loading}
                        autoFocus
                      />

                      {/* Unlock button — neu-btn for plain-CSS :active tactile press */}
                      <button
                        type="submit"
                        disabled={!code.trim() || loading}
                        className="neu-btn neu-raised w-full rounded-full py-3.5 font-semibold font-gujarati text-acc text-sm transition-shadow disabled:opacity-50"
                      >
                        {loading
                          ? <Loader2 className="animate-spin mx-auto" size={20} />
                          : 'અનલૉક કરો'
                        }
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
