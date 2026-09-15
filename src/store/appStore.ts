import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabaseService } from '../services/supabaseService'
import { logActivity } from '../lib/utils'

export interface SavedReport {
  id: string;
  halqa: string;
  date: string;
  stats: any;
  activities: any;
  mashwara: string;
  notes: string;
}

interface AppState {
  hasCompletedOnboarding: boolean
  setHasCompletedOnboarding: (val: boolean) => void
  draftReport: any | null
  setDraftReport: (draft: any) => void
  clearDraft: () => void
  
  sessionCode: string | null
  sessionRole: 'admin' | 'team' | null
  setSession: (code: string | null, role: 'admin' | 'team' | null) => void
  
  authDialogOpen: boolean
  authPendingAction: (() => void) | null
  requireAuth: (action: () => void) => void
  closeAuthDialog: () => void
  
  // App data (Supabase)
  isLoading: boolean
  reports: SavedReport[]
  halqas: any[]
  
  loadData: () => Promise<void>
  refreshAll: () => Promise<void>
  addReport: (report: SavedReport) => Promise<void>
  updateReport: (id: string, report: SavedReport) => Promise<void>
  deleteReport: (id: string) => Promise<void>
  addCustomHalqa: (halqaName: string) => Promise<void>
  removeCustomHalqa: (id: string) => Promise<void>
  
  // To keep backward compatibility for anything still expecting string array
  customHalqas: string[]
}

const getInitialSession = () => {
  try {
    const raw = localStorage.getItem('mt_session');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { code: null, role: null };
};

const initialSession = getInitialSession();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: localStorage.getItem('mt_onboarded') === '1',
      setHasCompletedOnboarding: (val) => {
        localStorage.setItem('mt_onboarded', val ? '1' : '0');
        set({ hasCompletedOnboarding: val });
      },
      
      draftReport: null,
      setDraftReport: (draft) => set({ draftReport: draft }),
      clearDraft: () => set({ draftReport: null }),
      
      sessionCode: initialSession.code,
      sessionRole: initialSession.role,
      setSession: (code, role) => {
        if (code && role) {
          localStorage.setItem('mt_session', JSON.stringify({ code, role }));
        } else {
          localStorage.removeItem('mt_session');
        }
        set({ sessionCode: code, sessionRole: role });
      },
      
      authDialogOpen: false,
      authPendingAction: null,
      requireAuth: (action) => {
        const { sessionCode, sessionRole } = get()
        if (sessionCode && sessionRole) {
          action()
        } else {
          set({ authDialogOpen: true, authPendingAction: action })
        }
      },
      closeAuthDialog: () => set({ authDialogOpen: false, authPendingAction: null }),
      
      isLoading: true,
      reports: [],
      halqas: [],
      customHalqas: [],
      
      loadData: async () => {
        set({ isLoading: true })
        try {
          const code = get().sessionCode;
          if (code) {
            try {
              const role = await supabaseService.loginCode(code);
              if (!role) {
                get().setSession(null, null);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'કોડ રદ થયેલ છે — ફરી દાખલ કરો' }));
              } else {
                get().setSession(code, role);
              }
            } catch (err) {
              get().setSession(null, null);
              window.dispatchEvent(new CustomEvent('app-toast', { detail: 'કોડ રદ થયેલ છે — ફરી દાખલ કરો' }));
            }
          }
          const [reports, halqas] = await Promise.all([
            supabaseService.listReports(),
            supabaseService.listHalqas()
          ])
          const DEFAULT_HALQAS = ['પાલનપુર', 'ડીસા', 'ધાનેરા', 'થરાદ'];
          set({ 
            reports, 
            halqas,
            customHalqas: halqas.filter(h => !DEFAULT_HALQAS.includes(h.name)).map(h => h.name),
            isLoading: false 
          })
        } catch (err) {
          console.error(err)
          set({ isLoading: false })
        }
      },
      
      refreshAll: async () => {
        try {
          const code = get().sessionCode;
          if (code) {
            try {
              const role = await supabaseService.loginCode(code);
              if (!role) {
                get().setSession(null, null);
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'કોડ રદ થયેલ છે — ફરી દાખલ કરો' }));
              } else {
                get().setSession(code, role);
              }
            } catch (err) {
              get().setSession(null, null);
            }
          }
          const [reports, halqas] = await Promise.all([
            supabaseService.listReports(),
            supabaseService.listHalqas()
          ])
          const DEFAULT_HALQAS = ['પાલનપુર', 'ડીસા', 'ધાનેરા', 'થરાદ'];
          set({ 
            reports, 
            halqas,
            customHalqas: halqas.filter(h => !DEFAULT_HALQAS.includes(h.name)).map(h => h.name)
          })
        } catch (err) {
          console.error(err)
        }
      },
      
      addReport: async (report) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          const saved = await supabaseService.saveReport(report, code)
          set((state) => ({ reports: [saved, ...state.reports] }))
          logActivity('રિપોર્ટ સેવ કર્યો');
        } catch (err) {
          console.error(err)
          throw err
        }
      },
      
      updateReport: async (id, report) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          const updated = await supabaseService.updateReport(id, report, code)
          set((state) => ({ 
            reports: state.reports.map(r => r.id === id ? updated : r) 
          }))
          logActivity('રિપોર્ટ અપડેટ કર્યો');
        } catch (err) {
          console.error(err)
          throw err
        }
      },
      
      deleteReport: async (id) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          await supabaseService.deleteReport(id, code)
          set((state) => ({ reports: state.reports.filter(r => r.id !== id) }))
          logActivity('રિપોર્ટ ડિલીટ કર્યો');
        } catch (err) {
          console.error(err)
          throw err
        }
      },
      
      addCustomHalqa: async (name) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          const newHalqa = await supabaseService.addHalqa(name, code)
          set((state) => ({ 
            halqas: [...state.halqas, newHalqa],
            customHalqas: [...state.customHalqas, name]
          }))
        } catch (err) {
          console.error(err)
          throw err
        }
      },
      
      removeCustomHalqa: async (id) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          await supabaseService.deleteHalqa(id, code)
          set((state) => ({
            halqas: state.halqas.filter(h => h.id !== id)
          }))
        } catch (err) {
          console.error(err)
          throw err
        }
      }
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        draftReport: state.draftReport,
      })
    }
  )
)

