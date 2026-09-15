import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import { Layout } from './components/layout/Layout';
import { AuthDialog } from './components/auth/AuthDialog';

// Pages
import { Onboarding } from './pages/Onboarding';
import { NewReport } from './pages/NewReport';
import { PastReports } from './pages/PastReports';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';
import { Gallery } from './pages/Gallery';

function App() {
  const { hasCompletedOnboarding, loadData } = useAppStore();
  const [showGreeting] = useState(() => !sessionStorage.getItem('mt_greeted'));
  
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    sessionStorage.setItem('mt_greeted', '1');
  }, []);

  return (
    <>
      {showGreeting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg pointer-events-none" style={{ animation: 'fadeOut 0.3s ease 1.3s forwards' }}>
          <div className="glass-panel w-[86%] max-w-md mx-auto rounded-3xl p-6 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center">
            <h1 className="font-bold font-gujarati text-txt mb-2 text-center leading-tight text-balance" style={{ fontSize: 'clamp(1.6rem, 7vw, 3rem)' }}>અસ્સલામુ અલયકુમ</h1>
            <span className="block text-center text-xs tracking-[0.2em] text-sub uppercase font-num mt-2">ASSALAMU ALAYKUM</span>
          </div>
        </div>
      )}
      <BrowserRouter>
      <Routes>
        {/* Gallery available for demo */}
        <Route path="/gallery" element={<Gallery />} />
        
        {/* Main App Routes */}
        {hasCompletedOnboarding ? (
          <Route element={<Layout />}>
            <Route path="/" element={<NewReport />} />
            <Route path="/past-reports" element={<PastReports />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Onboarding />} />
        )}
      </Routes>
      <AuthDialog />
    </BrowserRouter>
    </>
  );
}
export default App;
