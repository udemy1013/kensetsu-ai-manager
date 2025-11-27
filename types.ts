
export interface AIConstraints {
  work_day?: string; // e.g., "Mon-only", "Tue-Fri"
  days?: string[]; // e.g., ["Mon", "Tue"]
  ng_reason?: string; // e.g., "1F店舗営業のため"
  notes?: string;
  key?: string;
}

export interface FacilitySpecs {
  tank_capacity?: string; // e.g., "20t"
  pump_type?: string; // e.g., "Submersible"
  access_info?: string; // e.g., "Key at reception"
}

export interface Facility {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  ai_constraints: AIConstraints;
  ai_notes: string[]; // Historical data extracted by AI
  specs?: FacilitySpecs; // Technical specs
}

export interface Staff {
  id: string;
  name: string;
  role: 'Worker' | 'Manager'; // Can be used for display
  type: 'Internal' | 'External'; // For cost calculation
  cost: number; // Daily cost or spot cost
  qualifications: string[]; // e.g. ['Oxygen', 'Foreman']
  avatar?: string;
  unavailable_dates?: string[]; // YYYY-MM-DD
  unavailable_reason?: Record<string, string>; // { "2025-06-04": "Paid Leave" }
  max_concurrent_work: number; // Capacity limit (e.g., 1 for Internal, 3 for External)
}

export type ProjectStatus = 'Draft' | 'Scheduled' | 'Completed' | 'Invoiced';

export interface ProjectTimeConstraints {
  water_suspension_start?: string; // "13:00"
  water_suspension_end?: string; // "15:00"
}

export interface Project {
  id: string;
  facility_id: string;
  contract_type: 'Regular' | 'Spot';
  status: ProjectStatus;
  amount: number;
  target_month: string; // "YYYY-MM"
  title: string;
  required_qualification?: string; // Constraint for assignment
  required_headcount?: number; // Recommended number of staff
  time_constraints?: ProjectTimeConstraints;
}

export interface ScheduleEvent {
  id: string;
  project_id: string;
  date: string; // "YYYY-MM-DD"
  staff_ids: string[]; // Assigned resources (Multiple)
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  severity?: 'warning' | 'error' | 'info';
  details?: string;
}

// スケジューリングルール
export type ScheduleRuleType =
  | 'no_same_project'  // 同じプロジェクトに入れない
  | 'no_same_day'      // 同じ日に入れない
  | 'prefer_together'  // できれば一緒に入れる
  | 'avoid_facility'   // 特定施設を避ける
  | 'custom';          // カスタムルール（AI解釈）

export interface ScheduleRule {
  id: string;
  type: ScheduleRuleType;
  staffNames: string[];  // 対象スタッフ名
  facilityName?: string; // 施設制約の場合
  description: string;   // ルールの説明
  createdAt: string;     // 作成日時
  customCondition?: string; // カスタムルール用: 自然言語の条件文
}
