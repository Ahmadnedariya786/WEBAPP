export interface LeafField {
  v: string | null;
  ok: boolean;
}

export interface ExtractedActivity {
  no: number;
  gujishata?: LeafField;
  agraaham?: LeafField;
  mojuda?: LeafField;
}

export interface ExtractedReport {
  halqa_name: LeafField;
  student_count: LeafField;
  std10: LeafField;
  std11: LeafField;
  std12: LeafField;
  college: LeafField;
  engineer: LeafField;
  medical: LeafField;
  muslim_teachers: LeafField;
  activities: ExtractedActivity[];
  mulakat_percent?: LeafField;
  schools_prayer?: LeafField;
  jamat_3din?: LeafField;
  jamat_10din?: LeafField;
  // Optional list of unmapped/skipped columns detected in the sheet
  skipped_columns?: string[];
}

export interface EditableStatField {
  key: string;
  label: string;
  v: string;
  ok: boolean;
}

export interface EditableActivityRow {
  no: number;
  key: string;
  name: string;
  cols: Record<string, { v: string; ok: boolean }>;
}

export interface ColumnHeaderDef {
  key: string;
  label: string;
}

export interface ReviewData {
  halqa_name: { v: string; ok: boolean };
  stats: Record<string, { v: string; ok: boolean }>;
  columnKeys: ColumnHeaderDef[];
  activities: EditableActivityRow[];
  skipped_columns: string[];
}
