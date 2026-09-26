import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabaseService, SessionExpiredError, isSessionExpiredError } from '../services/supabaseService'
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
  removeReport: (id: string) => Promise<void>
  addCustomHalqa: (halqaName: string) => Promise<void>
  removeCustomHalqa: (id: string) => Promise<void>
  addAdminHalqa: (name: string, is_default: boolean) => Promise<void>
  removeAdminHalqa: (id: string) => Promise<void>
  
  // To keep backward compatibility for anything still expecting string array
  customHalqas: string[]

  // S23: Scan-&-Fill action (never auto-saves)
  fillFromScan: (scanData: any, currentHalqas: any[]) => {
    preFillSnapshot: any;
    matchedHalqa: string | null;
    unmatchedHalqaName: string | null;
    filledKeys: string[];
    newDraft: any;
  }
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
          set({ 
            reports, 
            halqas,
            customHalqas: halqas.filter((h: any) => h.is_custom).map((h: any) => h.name),
            isLoading: false 
          })
        } catch (err) {
          console.error(err)
          set({ isLoading: false })
        }
      },
      
      refreshAll: async () => {
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
        ]);
        set({ 
          reports, 
          halqas,
          customHalqas: halqas.filter((h: any) => h.is_custom).map((h: any) => h.name)
        });
      },
      
      addReport: async (report) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new SessionExpiredError("Unauthorized");
          const saved = await supabaseService.saveReport(report, code);
          set((state) => ({ reports: [saved, ...state.reports] }));
          logActivity('રિપોર્ટ સેવ કર્યો');
        } catch (err) {
          if (isSessionExpiredError(err)) {
            get().setSession(null, null);
            set({ authDialogOpen: true });
          }
          console.error(err);
          throw err;
        }
      },
      
      updateReport: async (id, report) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new SessionExpiredError("Unauthorized");
          const updated = await supabaseService.updateReport(id, report, code);
          set((state) => ({ 
            reports: state.reports.map(r => r.id === id ? updated : r) 
          }));
          logActivity('રિપોર્ટ અપડેટ કર્યો');
        } catch (err) {
          if (isSessionExpiredError(err)) {
            get().setSession(null, null);
            set({ authDialogOpen: true });
          }
          console.error(err);
          throw err;
        }
      },
      
      deleteReport: async (id) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new SessionExpiredError("Unauthorized");
          await supabaseService.deleteReport(id, code);
          set((state) => ({ reports: state.reports.filter(r => r.id !== id) }));
          logActivity('રિપોર્ટ ડિલીટ કર્યો');
        } catch (err) {
          if (isSessionExpiredError(err)) {
            get().setSession(null, null);
            set({ authDialogOpen: true });
          }
          console.error(err);
          throw err;
        }
      },

      removeReport: async (id) => {
        return get().deleteReport(id);
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
            halqas: state.halqas.filter(h => h.id !== id),
            customHalqas: state.customHalqas.filter(name => !state.halqas.find(h => h.id === id && h.name === name))
          }))
        } catch (err) {
          console.error(err)
          throw err
        }
      },

      addAdminHalqa: async (name, is_default) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          const newHalqa = await supabaseService.addAdminHalqa(name, code, is_default)
          set((state) => ({ 
            halqas: [...state.halqas, newHalqa],
            customHalqas: is_default ? state.customHalqas : [...state.customHalqas, name]
          }))
        } catch (err) {
          console.error(err)
          throw err
        }
      },

      removeAdminHalqa: async (id) => {
        try {
          const code = get().sessionCode;
          if (!code) throw new Error("Unauthorized");
          await supabaseService.deleteHalqa(id, code)
          set((state) => ({
            halqas: state.halqas.filter(h => h.id !== id),
            customHalqas: state.customHalqas.filter(name => !state.halqas.find(h => h.id === id && h.name === name))
          }))
        } catch (err) {
          console.error(err)
          throw err
        }
      },

      fillFromScan: (scanData: any, currentHalqas: any[]) => {
        const currentDraft = get().draftReport ? JSON.parse(JSON.stringify(get().draftReport)) : {
          halqa: '',
          date: '',
          stats: { std_10: 0, std_11: 0, std_12: 0, college: 0, engineering: 0, medical: 0, muslim_teachers: 0 },
          activities: {},
          mashwara: '',
          notes: ''
        };

        const preFillSnapshot = JSON.parse(JSON.stringify(currentDraft));
        const newDraft = JSON.parse(JSON.stringify(currentDraft));
        const filledKeys: string[] = [];

        // 1. Halqa Name matching (normalized match: trim + ignore whitespace)
        let matchedHalqa: string | null = null;
        let unmatchedHalqaName: string | null = null;
        const rawHalqa = scanData.halqa_name?.v?.trim();
        if (rawHalqa) {
          const norm = rawHalqa.replace(/\s+/g, '');
          const found = currentHalqas.find((h: any) => {
            const name = typeof h === 'string' ? h : h?.name || '';
            return name.trim().replace(/\s+/g, '') === norm;
          });
          if (found) {
            matchedHalqa = typeof found === 'string' ? found : found.name;
            newDraft.halqa = matchedHalqa;
            filledKeys.push('halqa');
          } else {
            unmatchedHalqaName = rawHalqa;
          }
        }

        // 2. Stats (GOLDEN RULE: write ONLY non-empty values; empty = skip)
        if (!newDraft.stats) {
          newDraft.stats = { std_10: 0, std_11: 0, std_12: 0, college: 0, engineering: 0, medical: 0, muslim_teachers: 0 };
        }
        const statMapping: Record<string, string> = {
          std10: 'std_10',
          std11: 'std_11',
          std12: 'std_12',
          college: 'college',
          engineer: 'engineering',
          medical: 'medical',
          muslim_teachers: 'muslim_teachers'
        };

        for (const [scanKey, draftKey] of Object.entries(statMapping)) {
          const rawVal = scanData.stats?.[scanKey]?.v;
          if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
            const parsedNum = parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10);
            newDraft.stats[draftKey] = isNaN(parsedNum) ? 0 : parsedNum;
            filledKeys.push(`stat.${draftKey}`);
          }
        }

        // 3. 13 Activities (write ONLY non-empty values; empty = skip)
        const ACTIVITY_KEYS = [
          'activity.namaz', 'activity.mashwara_pabandi', 'activity.taleem', 'activity.gasht',
          'activity.panchkosa', 'activity.shabguzari', 'activity.mulaqat_percent', 'activity.school_namaz',
          'activity.jamaat_3', 'activity.jamaat_10', 'activity.jamaat_40', 'activity.jamaat_4m'
        ];

        if (!newDraft.activities) newDraft.activities = {};

        if (Array.isArray(scanData.activities)) {
          scanData.activities.forEach((row: any) => {
            if (row.no >= 1 && row.no <= 12) {
              const actKey = ACTIVITY_KEYS[row.no - 1];
              if (!newDraft.activities[actKey]) {
                newDraft.activities[actKey] = { gujishta: '', azaim: '', maujuda: '' };
              }
              // gujishata -> gujishta
              const gujVal = row.cols?.gujishata?.v;
              if (gujVal !== undefined && gujVal !== null && String(gujVal).trim() !== '') {
                newDraft.activities[actKey].gujishta = String(gujVal).trim();
                filledKeys.push(`${actKey}.gujishta`);
              }
              // agraaham -> azaim
              const azaimVal = row.cols?.agraaham?.v;
              if (azaimVal !== undefined && azaimVal !== null && String(azaimVal).trim() !== '') {
                newDraft.activities[actKey].azaim = String(azaimVal).trim();
                filledKeys.push(`${actKey}.azaim`);
              }
              // mojuda -> maujuda
              const maujVal = row.cols?.mojuda?.v;
              if (maujVal !== undefined && maujVal !== null && String(maujVal).trim() !== '') {
                newDraft.activities[actKey].maujuda = String(maujVal).trim();
                filledKeys.push(`${actKey}.maujuda`);
              }
            } else if (row.no === 13) {
              // Row 13: Mashwara
              const mashVal = row.cols?.mojuda?.v || row.cols?.gujishata?.v;
              if (mashVal !== undefined && mashVal !== null && String(mashVal).trim() !== '') {
                if (!newDraft.activities['mashwara']) {
                  newDraft.activities['mashwara'] = { gujishta: '', azaim: '', maujuda: '' };
                }
                newDraft.activities['mashwara'].maujuda = String(mashVal).trim();
                newDraft.mashwara = String(mashVal).trim();
                filledKeys.push('mashwara');
              }
            }
          });
        }

        // DATA KAVACH: NEVER auto-save to DB, only set draft in state
        set({ draftReport: newDraft });

        return {
          preFillSnapshot,
          matchedHalqa,
          unmatchedHalqaName,
          filledKeys,
          newDraft
        };
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

