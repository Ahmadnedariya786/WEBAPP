import { supabase } from '../lib/supabaseClient';
import type { SavedReport } from '../store/appStore';

if (import.meta.env.DEV) {
  console.log('ENV', { 
    url: import.meta.env.VITE_SUPABASE_URL, 
    hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY), 
    keyLen: (import.meta.env.VITE_SUPABASE_ANON_KEY || '').length 
  });
}

function mapDbToReport(row: any): SavedReport {
  return {
    id: row.id,
    halqa: row.halqa,
    date: row.report_date,
    stats: {
      total: row.total_students,
      std_10: row.std10,
      std_11: row.std11,
      std_12: row.std12,
      college: row.college,
      engineering: row.engineer,
      medical: row.medical,
      muslim_teachers: row.muslim_teachers,
    },
    activities: row.activities,
    mashwara: row.mashwara_text,
    notes: row.special_notes,
  };
}

function mapReportToDb(r: SavedReport): any {
  return {
    ...(r.id && r.id.length > 20 ? { id: r.id } : {}),
    halqa: r.halqa,
    report_date: r.date,
    total_students: r.stats?.total || 0,
    std10: r.stats?.std_10 || 0,
    std11: r.stats?.std_11 || 0,
    std12: r.stats?.std_12 || 0,
    college: r.stats?.college || 0,
    engineer: r.stats?.engineering || 0,
    medical: r.stats?.medical || 0,
    muslim_teachers: r.stats?.muslim_teachers || 0,
    activities: r.activities || [],
    mashwara_text: r.mashwara || '',
    special_notes: r.notes || '',
  };
}

export const supabaseService = {
  async listReports() {
    const { data, error } = await supabase.from('reports').select('*').order('report_date', { ascending: false });
    if (error) {
      console.error('listReports ERROR:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      throw error;
    }
    return data.map(mapDbToReport);
  },
  async saveReport(r: SavedReport, code: string) {
    const dbRow = mapReportToDb(r);
    const { data, error } = await supabase.rpc('fn_save_report', { p_code: code, p_payload: dbRow });
    if (error) {
      console.error('saveReport ERROR:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      throw error;
    }
    return mapDbToReport(data);
  },
  async updateReport(id: string, r: SavedReport, code: string) {
    const dbRow = mapReportToDb(r);
    // Since fn_save_report handles both insert and update (based on id presence in payload), we can just use it
    dbRow.id = id;
    const { data, error } = await supabase.rpc('fn_save_report', { p_code: code, p_payload: dbRow });
    if (error) throw error;
    return mapDbToReport(data);
  },
  async deleteReport(id: string, code: string) {
    const { error } = await supabase.rpc('fn_delete_report', { p_code: code, p_id: id });
    if (error) {
      console.error('deleteReport ERROR:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      throw error;
    }
  },
  async listHalqas() {
    const { data, error } = await supabase.from('halqas').select('id, name, is_custom').order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },
  async addHalqa(name: string, adminCode: string) {
    const { data, error } = await supabase.rpc('fn_save_halqa', { p_admin: adminCode, p_payload: { name, is_custom: true } });
    if (error) throw error;
    return data;
  },
  async addAdminHalqa(name: string, adminCode: string, is_default: boolean) {
    const { data, error } = await supabase.rpc('fn_save_halqa', { p_admin: adminCode, p_payload: { name, is_custom: !is_default } });
    if (error) throw error;
    return data;
  },
  async deleteHalqa(id: string, adminCode: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    const { error } = await supabase.rpc('fn_delete_halqa', { p_admin: adminCode, p_id: id });
    if (error) throw error;
  },
  async getSetting(key: string) {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return data?.value || null;
  },
  async setSetting(key: string, value: any, adminCode: string) {
    const { error } = await supabase.rpc('fn_update_settings', { p_admin: adminCode, p_payload: { key, value } });
    if (error) throw error;
  },
  async setAdminCode(oldCode: string | null, newCode: string) {
    const { data, error } = await supabase.rpc('fn_set_admin_code', { p_old: oldCode, p_new: newCode });
    if (error) throw error;
    return data as boolean;
  },
  async checkAdminConfigured(): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('fn_set_admin_code', { p_old: null, p_new: null });
      return data === false;
    } catch {
      return true;
    }
  },
  async loginCode(code: string) {
    const { data, error } = await supabase.rpc('fn_login_code', { p_code: code });
    if (error) throw error;
    return data as 'admin' | 'team' | null;
  },
  async generateCode(adminCode: string, label: string) {
    const { data, error } = await supabase.rpc('fn_generate_code', { p_admin: adminCode, p_label: label });
    if (error) throw error;
    return data as string;
  },
  async listCodes(adminCode: string) {
    const { data, error } = await supabase.rpc('fn_list_codes', { p_admin: adminCode });
    if (error) throw error;
    return data;
  },
  async revokeCode(adminCode: string, id: string) {
    const { data, error } = await supabase.rpc('fn_revoke_code', { p_admin: adminCode, p_id: id });
    if (error) throw error;
    return data as boolean;
  },
  async purgeRevoked(adminCode: string) {
    const { data, error } = await supabase.rpc('fn_purge_revoked', { p_admin: adminCode });
    if (error) throw error;
    return data as number;
  }
};

/** Returns true when the error is the DUPLICATE_REPORT signal from fn_save_report */
export function isDuplicateReportError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as any)?.message || '';
  return msg.startsWith('DUPLICATE_REPORT:') || msg.includes('DUPLICATE_REPORT');
}

export function mapSupabaseError(err: unknown): string {
  if (!err) return 'અજ્ઞાત ભૂલ';
  const anyErr = err as any;
  const msg = anyErr?.message || String(err);
  const code = anyErr?.code;
  if (code === '23505' || msg.includes('duplicate') || msg.includes('unique constraint')) return 'આ નામનો હલકો પહેલેથી છે ✅';
  if (msg.includes('Unauthorized')) return 'કોડ માન્ય નથી અથવા રદ થયેલ છે ❌';
  return 'ભૂલ આવી: નેટવર્ક ચકાસો';
}
