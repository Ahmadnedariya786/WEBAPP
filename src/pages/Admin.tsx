import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../i18n';
import { GlassCard } from '../components/ui/GlassCard';
import { LiquidButton } from '../components/ui/LiquidButton';
import { Shield, Users, Activity, Database, Lock, ChevronLeft, CheckCircle, Key, KeyRound, Trash2, Copy, Share2, LogOut, MapPin, Plus } from 'lucide-react';
import { getLogs, clearLogs, type SystemLog, logActivity, cn } from '../lib/utils';
import { useAppStore } from '../store/appStore';
import { supabaseService } from '../services/supabaseService';
import { useNavigate } from 'react-router-dom';

export const Admin: React.FC = () => {
  const { sessionCode, sessionRole, setSession, reports, halqas } = useAppStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);
  
  const [activeScreen, setActiveScreen] = useState<'main' | 'users' | 'logs' | 'halqas'>('main');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Users screen state
  const [codes, setCodes] = useState<any[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  
  // Halqa Management State
  const [newAdminHalqa, setNewAdminHalqa] = useState('');
  const [halqaToDelete, setHalqaToDelete] = useState<{ id: string, name: string } | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    try {
      const code = password.trim();
      const initSuccess = await supabaseService.setAdminCode(null, code);
      if (initSuccess) {
        // First-run: admin code just set
        setIsFirstRun(true);
        setLoginSuccess(true);
        setTimeout(() => {
          setSession(code, 'admin');
        }, 800);
      } else {
        const role = await supabaseService.loginCode(code);
        if (role === 'admin') {
          setLoginSuccess(true);
          setError(false);
          setTimeout(() => {
            setSession(code, role);
          }, 800);
        } else {
          setError(true);
          setShakeInput(true);
          setPassword('');
          showNotification('અમાન્ય પાસવર્ડ ❌');
        }
      }
    } catch (err) {
      setError(true);
      setShakeInput(true);
      showNotification('ભૂલ આવી ❌');
    }
    setIsLoading(false);
  };

  const loadCodes = async () => {
    if (sessionRole !== 'admin' || !sessionCode) return;
    try {
      const data = await supabaseService.listCodes(sessionCode);
      setCodes(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Probe first-run status on mount
  useEffect(() => {
    let mounted = true;
    supabaseService.checkAdminConfigured().then((isConfigured) => {
      if (mounted) setIsFirstRun(!isConfigured);
    }).catch(() => {/* ignore */});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      if (sessionRole === 'admin' && sessionCode) {
        try {
          const role = await supabaseService.loginCode(sessionCode);
          if (role !== 'admin' && mounted) {
            setSession(null, null);
          }
        } catch {
          if (mounted) setSession(null, null);
        }
      }
    };
    checkAuth();
    return () => { mounted = false; };
  }, [sessionCode, sessionRole, setSession]);


  useEffect(() => {
    if (activeScreen === 'users' && sessionRole === 'admin') {
      loadCodes();
    }
  }, [activeScreen, sessionRole]);

  const handleLogout = () => {
    if (window.confirm('શું તમે ખરેખર લૉગઆઉટ કરવા માંગો છો?')) {
      setSession(null, null);
      navigate('/');
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeLabel.trim() || !sessionCode) return;
    setIsLoading(true);
    try {
      const code = await supabaseService.generateCode(sessionCode, newCodeLabel.trim());
      setGeneratedCode(code);
      setNewCodeLabel('');
      await loadCodes();
    } catch (err) {
      showNotification('ભૂલ આવી ❌');
    }
    setIsLoading(false);
  };

  const handleRevokeCode = async (id: string) => {
    if (!sessionCode) return;
    if (!window.confirm('શું તમે ખરેખર આ કોડ રદ કરવા માંગો છો?')) return;
    try {
      await supabaseService.revokeCode(sessionCode, id);
      showNotification('કોડ રદ કરાયેલ છે');
      loadCodes();
    } catch (err) {
      showNotification('ભૂલ આવી ❌');
    }
  };

  const handlePurgeRevoked = async () => {
    if (!sessionCode) return;
    if (!window.confirm('બધા રદ થયેલા કોડ કાયમ માટે ભૂંસાશે. ચાલુ રાખવું છે?')) return;
    setIsPurging(true);
    try {
      const n = await supabaseService.purgeRevoked(sessionCode);
      showNotification(`${n} જૂના કોડ સાફ થયા ✅`);
      await loadCodes();
    } catch (err) {
      showNotification('ભૂલ આવી ❌');
    }
    setIsPurging(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('કોપી થઈ ગયું ✅');
  };

  const handleBackup = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      reports,
      halqas,
      settings: {}
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    (window as any).AndroidPrepareDownload?.(filename, 'application/json');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    logActivity('ડેટા બેકઅપ ડાઉનલોડ');
    showNotification('બેકઅપ ડાઉનલોડ થયું ✅');
  };

  const openLogs = () => {
    setLogs(getLogs());
    setActiveScreen('logs');
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
    showNotification('લૉગ્સ સાફ થયા ✅');
  };

  if (sessionRole === 'team') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-6">
        <GlassCard className="w-full max-w-sm p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-acc/10 rounded-full flex items-center justify-center mx-auto text-acc mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-bold font-gujarati text-txt">ઍક્સેસ નથી</h2>
          <p className="text-sm font-gujarati text-sub mb-6">આ પેજ માત્ર એડમિન માટે છે.</p>
          <LiquidButton onClick={() => window.history.back()} className="w-full" type="button">
            પાછા જાઓ
          </LiquidButton>
        </GlassCard>
      </div>
    );
  }

  if (!sessionRole) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        {/* Toast */}
        <AnimatePresence>
          {showToast && (
            <div className="fixed inset-x-4 bottom-24 z-[80] flex justify-center pointer-events-none">
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
        </AnimatePresence>

        {/* Embossed gate — rounded card on mobile and desktop */}
        <div
          className="admin-dialog-card relative flex flex-col items-center justify-center p-6 sm:p-7 w-full max-w-[340px] rounded-[2rem]"
          style={{ minHeight: '280px' }}
        >
          <AnimatePresence mode="wait">
            {loginSuccess ? (
              /* ── SUCCESS STATE ── */
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 py-2"
              >
                <div
                  className="w-16 h-16 rounded-full admin-dialog-icon flex items-center justify-center neu-check-in"
                  style={{ color: 'rgb(16 185 129)' }}
                >
                  <CheckCircle size={36} />
                </div>
                <p className="font-gujarati font-semibold admin-dialog-title text-center text-sm">
                  સ્વાગત છે! લૉગિન સફળ
                </p>
              </motion.div>
            ) : (
              /* ── LOGIN / FIRST-RUN FORM ── */
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
                className="w-full flex flex-col items-center gap-5"
              >
                {/* Lock icon bubble */}
                <div className="w-12 h-12 rounded-full admin-dialog-icon flex items-center justify-center">
                  <Lock size={22} />
                </div>

                {/* Title & Subtitle — first-run vs login */}
                <div className="text-center">
                  <h2 className="admin-dialog-title text-lg font-bold font-gujarati leading-snug">
                    {isFirstRun ? 'એડમિન પાસવર્ડ સેટ કરો' : 'એડમિન પાસવર્ડ દાખલ કરો'}
                  </h2>
                  <p className="admin-dialog-sub text-xs font-gujarati mt-1.5 leading-relaxed">
                    {isFirstRun
                      ? 'પ્રથમ વખત — નવો પાસવર્ડ બનાવો'
                      : 'લૉગિન કરવા માટે સાચો પાસવર્ડ દાખલ કરો'}
                  </p>
                </div>

                {/* Form */}
                <form
                  onSubmit={handleLogin}
                  className={`w-full space-y-3.5 ${shakeInput ? 'neu-shake' : ''}`}
                  onAnimationEnd={() => setShakeInput(false)}
                >
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(false); }}
                    placeholder="•••••••••"
                    className={[
                      'admin-dialog-input w-full rounded-full px-5 py-3.5 outline-none',
                      'text-center font-num tracking-widest placeholder:tracking-normal',
                      'focus:ring-2 focus:ring-acc/40 transition-shadow text-sm',
                      error ? 'ring-2 ring-danger/60' : '',
                    ].join(' ')}
                    disabled={isLoading}
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={isLoading || !password.trim()}
                    className="admin-dialog-btn w-full rounded-full py-3.5 font-semibold font-gujarati text-sm flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    {isLoading ? '...' : isFirstRun ? 'સેટ કરો' : 'લૉગિન કરો'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6 pb-12 relative">
      <AnimatePresence>
        {showToast && (
          <div className="fixed inset-x-4 bottom-24 z-[80] flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="w-full max-w-md rounded-2xl bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-2 shadow-lg border border-brd/10"
            >
              <CheckCircle size={18} className="text-acc2 shrink-0" />
              <span className="flex-1 text-sm text-txt font-gujarati font-medium">{toastMessage}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeScreen === 'main' && (
        <div className="space-y-6">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-3">
            <Shield className="text-acc shrink-0" />
            <h2 className="text-2xl font-bold font-gujarati truncate min-w-0">
              {t('admin.dashboard_title' as any)}
            </h2>
            <div className="flex-1 min-w-0"></div>
            <button onClick={handleLogout} className="h-9 px-3 shrink-0 rounded-full text-sm font-semibold font-gujarati bg-card hover:bg-card/80 border border-brd/10 text-txt transition-colors inline-flex items-center gap-1.5 whitespace-nowrap">
              <LogOut className="w-4 h-4 shrink-0" />
              લૉગઆઉટ
            </button>
            <div className="basis-full h-0 m-0 p-0 hidden sm:block"></div>
            <span className="bg-acc2/10 text-acc2 border border-acc2/20 px-2 py-0.5 rounded-full text-xs font-gujarati font-medium whitespace-nowrap inline-flex items-center gap-1 shrink-0 order-last sm:order-none w-full sm:w-auto mt-1 sm:mt-0">
              એડમિન લૉગિન <CheckCircle className="w-4 h-4 shrink-0" />
            </span>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <GlassCard onClick={() => setActiveScreen('users')} hoverEffect className="cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] max-h-[220px]">
              <Users size={32} className="text-acc" />
              <span className="font-gujarati font-medium text-sm inline-flex items-center gap-1.5"><Key className="w-4 h-4" /> પાસવર્ડ મેનેજ કરો</span>
            </GlassCard>

            <GlassCard onClick={() => setActiveScreen('halqas')} hoverEffect className="cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] max-h-[220px]">
              <MapPin size={32} className="text-sub" />
              <span className="font-gujarati font-medium text-sm inline-flex items-center gap-1.5">હલકા સંચાલન</span>
            </GlassCard>

            <GlassCard onClick={openLogs} hoverEffect className="cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] max-h-[220px]">
              <Activity size={32} className="text-sub" />
              <span className="font-gujarati font-medium text-sm">{t('admin.system_logs' as any)}</span>
            </GlassCard>

            <GlassCard onClick={handleBackup} hoverEffect className="cursor-pointer rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[160px] max-h-[220px]">
              <Database size={32} className="text-sub" />
              <span className="font-gujarati font-medium text-sm">{t('settings.data_backup' as any)}</span>
            </GlassCard>
          </div>
        </div>
      )}

      {activeScreen === 'users' && (
        <div className="space-y-6 relative">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => setActiveScreen('main')} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full glass-panel text-sub">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-bold font-gujarati truncate min-w-0">{t('admin.manage_users' as any)}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {codes.some(c => c.revoked_at) && (
                <LiquidButton
                  onClick={handlePurgeRevoked}
                  size="sm"
                  variant="danger"
                  className="font-gujarati flex gap-1 bg-acc/10 text-acc border-acc/20 hover:bg-acc hover:text-white shrink-0"
                  disabled={isPurging}
                >
                  <Trash2 className="w-4 h-4 shrink-0" /> {isPurging ? 'સાફ...' : 'લિસ્ટ સાફ કરો'}
                </LiquidButton>
              )}
              <LiquidButton onClick={() => setShowGenerateModal(true)} className="inline-flex items-center justify-center gap-2 px-4 min-h-10 rounded-full text-sm font-semibold font-gujarati w-auto shrink-0">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap leading-tight py-1">નવો પાસવર્ડ</span>
              </LiquidButton>
            </div>
          </header>
          
          <div className="space-y-4">
            {codes.map(c => (
              <GlassCard key={c.id} className={`p-4 flex items-center justify-between ${c.revoked_at ? 'opacity-50 grayscale' : ''}`}>
                <div>
                  <div className="font-gujarati font-bold text-txt flex items-center gap-2">
                    {c.label}
                    {c.revoked_at && <span className="bg-acc/10 text-acc border border-acc/20 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap">રદ થયેલ</span>}
                  </div>
                  <div className="font-num text-sm text-sub mt-1">
                    {c.masked || 'MT-****-****'} 
                    <span className="font-gujarati ml-2 text-xs">({new Date(c.created_at).toLocaleDateString('en-IN')})</span>
                  </div>
                </div>
                {!c.revoked_at ? (
                  <button onClick={() => handleRevokeCode(c.id)} className="w-10 h-10 rounded-full bg-acc/10 text-acc flex items-center justify-center hover:bg-acc hover:text-white transition-colors">
                    <Trash2 size={18} />
                  </button>
                ) : (
                  <div className="text-xs text-acc font-gujarati text-right">
                    {new Date(c.revoked_at).toLocaleDateString('en-IN')}
                  </div>
                )}
              </GlassCard>
            ))}
            {codes.length === 0 && (
              <div className="text-center text-sub py-8 font-gujarati">કોઈ ટીમ કોડ નથી</div>
            )}
          </div>

          <AnimatePresence>
            {showGenerateModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !generatedCode) setShowGenerateModal(false); }}>
                <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="w-[92%] max-w-sm rounded-2xl bg-card p-5 text-center shadow-2xl border border-brd/10">
                  {generatedCode ? (
                    <div className="space-y-6">
                      <div className="w-16 h-16 bg-acc2/10 text-acc2 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle size={32} />
                      </div>
                      <div>
                        <h3 className="font-gujarati font-bold text-lg text-txt">નવો કોડ તૈયાર છે</h3>
                        <p className="text-sub text-sm font-gujarati mt-1">આ કોડ એક જ વાર દેખાશે. યુઝરને મોકલી આપો.</p>
                      </div>
                      <div className="bg-card/50 py-3 px-4 rounded-xl border border-brd/10 font-num text-xl font-bold tracking-widest text-txt">
                        {generatedCode}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <LiquidButton variant="neutral" onClick={() => copyToClipboard(generatedCode)}>
                          <Copy size={18} className="mr-2" /> કૉપિ
                        </LiquidButton>
                        <LiquidButton onClick={() => {
                          const text = `તમારો રિપોર્ટિંગ કોડ: ${generatedCode}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                        }}>
                          <Share2 size={18} className="mr-2" /> શેર
                        </LiquidButton>
                      </div>
                      <button onClick={() => { setGeneratedCode(null); setShowGenerateModal(false); }} className="text-sm font-gujarati text-sub underline pt-2 inline-block">બંધ કરો</button>
                    </div>
                  ) : (
                    <form onSubmit={handleGenerateCode} className="space-y-4">
                      <h3 className="font-gujarati font-bold text-lg text-txt">નવો પાસવર્ડ બનાવો</h3>
                      <input
                        type="text"
                        value={newCodeLabel}
                        onChange={e => setNewCodeLabel(e.target.value)}
                        placeholder="કોડ કોને આપ્યો? નામ લખો"
                        className="w-full app-input rounded-xl px-4 py-3 outline-none font-gujarati focus:ring-2 focus:ring-acc/40 placeholder-opacity-50"
                        required
                        autoFocus
                      />
                      <div className="flex gap-3 pt-2">
                        <LiquidButton type="button" variant="neutral" className="flex-1" onClick={() => setShowGenerateModal(false)}>
                          રદ કરો
                        </LiquidButton>
                        <LiquidButton type="submit" className="flex-1" disabled={isLoading || !newCodeLabel.trim()}>
                          બનાવો
                        </LiquidButton>
                      </div>
                    </form>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeScreen === 'logs' && (
        <div className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => setActiveScreen('main')} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full glass-panel text-sub">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-2xl font-bold font-gujarati truncate min-w-0">{t('admin.system_logs' as any)}</h2>
            </div>
          </header>
          
          <GlassCard className="p-4 space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-brd/10">
              <span className="font-gujarati font-medium text-sub">છેલ્લા 50 લૉગ્સ</span>
              <LiquidButton variant="danger" onClick={handleClearLogs} className="py-2 px-4 text-sm font-gujarati">
                લૉગ્સ સાફ કરો
              </LiquidButton>
            </div>
            
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-sub font-gujarati">કોઈ લૉગ્સ નથી</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-card/40 border border-brd/5">
                    <span className="font-gujarati font-medium text-txt">{log.action}</span>
                    <span className="font-num text-xs text-sub">
                      {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {activeScreen === 'halqas' && (
        <div className="space-y-6 relative">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => setActiveScreen('main')} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full glass-panel text-sub">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-bold font-gujarati truncate min-w-0">હલકા સંચાલન</h2>
            </div>
          </header>

          <GlassCard className="p-4 space-y-4">
            <h3 className="font-gujarati font-bold text-txt">નવો ડિફોલ્ટ હલકો ઉમેરો</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newAdminHalqa}
                onChange={e => setNewAdminHalqa(e.target.value)}
                placeholder="હલકાનું નામ"
                className="flex-1 min-w-0 app-input rounded-xl px-4 py-2 outline-none font-gujarati focus:ring-2 focus:ring-acc/40 placeholder-opacity-50"
              />
              <LiquidButton
                onClick={async () => {
                  if (!newAdminHalqa.trim()) return;
                  setIsLoading(true);
                  try {
                    await useAppStore.getState().addAdminHalqa(newAdminHalqa.trim(), true);
                    useAppStore.getState().refreshAll();
                    setNewAdminHalqa('');
                    showNotification('નવો હલકો ઉમેરાયો ✅');
                  } catch (err: any) {
                    showNotification('ભૂલ આવી: ' + (err.message || 'અજ્ઞાત ભૂલ'));
                  }
                  setIsLoading(false);
                }}
                disabled={isLoading || !newAdminHalqa.trim()}
                className="w-11 h-11 shrink-0 p-0 flex items-center justify-center"
              >
                <Plus size={20} />
              </LiquidButton>
            </div>
          </GlassCard>

          <div className="space-y-3">
            {halqas.map((h: any) => (
              <GlassCard key={h.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-gujarati font-bold text-txt text-lg">{h.name}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-gujarati border",
                    !h.is_custom 
                      ? "bg-acc/10 text-acc border-acc/20" 
                      : "bg-sub/10 text-sub border-sub/20"
                  )}>
                    {!h.is_custom ? 'ડિફોલ્ટ' : 'ટીમ'}
                  </span>
                </div>
                <button
                  onClick={() => setHalqaToDelete({ id: h.id, name: h.name })}
                  className="w-11 h-11 rounded-full bg-danger/10 text-danger flex items-center justify-center hover:bg-danger hover:text-white transition-colors shrink-0"
                >
                  <Trash2 size={20} />
                </button>
              </GlassCard>
            ))}
          </div>

          <AnimatePresence>
            {halqaToDelete && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setHalqaToDelete(null); }}>
                <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="w-[92%] max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-brd/10 space-y-5">
                  <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-2">
                    <Trash2 size={24} />
                  </div>
                  <h3 className="font-gujarati font-bold text-lg text-txt text-center leading-tight">
                    શું તમે ખરેખર '{halqaToDelete.name}' કાઢી નાખવા માંગો છો?
                  </h3>
                  
                  <div className="bg-danger/5 border border-danger/20 p-3 rounded-lg text-danger font-gujarati text-sm leading-relaxed text-center">
                    <span className="font-bold">ચેતવણી:</span> આ હલકામાં રિપોર્ટ્સ હોઈ શકે છે — રિપોર્ટ્સ ક્યારેય નહીં કાઢી નાખવામાં આવે, ફક્ત હલકો દૂર થશે.
                  </div>

                  <div className="flex gap-3 pt-2">
                    <LiquidButton type="button" variant="neutral" className="flex-1 font-gujarati font-semibold" onClick={() => setHalqaToDelete(null)}>
                      રદ કરો
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      variant="danger"
                      className="flex-1 font-gujarati font-semibold bg-danger text-white border-danger hover:bg-danger/90"
                      disabled={isLoading}
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await useAppStore.getState().removeAdminHalqa(halqaToDelete.id);
                          useAppStore.getState().refreshAll();
                          setHalqaToDelete(null);
                          showNotification('હલકો ડિલીટ થયો ✅');
                        } catch (err: any) {
                          showNotification('ભૂલ આવી: ' + (err.message || 'અજ્ઞાત ભૂલ'));
                        }
                        setIsLoading(false);
                      }}
                    >
                      {isLoading ? '...' : 'હા, કાઢી નાખો'}
                    </LiquidButton>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
