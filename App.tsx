
import React, { useState } from 'react';
import {
  Project,
  Facility,
  ScheduleEvent,
  ValidationResult,
  Staff,
  ScheduleRule
} from './types';
import { 
  MOCK_FACILITIES, 
  MOCK_STAFF, 
  INITIAL_PROJECTS 
} from './constants';
import { autoAssignScheduleStream, validateScheduleMove, StreamEvent } from './services/geminiService';
import DashboardView from './components/DashboardView';
import CalendarView from './components/CalendarView';
import FacilityModal from './components/FacilityModal';
import { LayoutDashboard, Calendar as CalendarIcon, Bot, Zap } from 'lucide-react';

// 初期デモ用ルール
const INITIAL_RULES: ScheduleRule[] = [
  {
    id: 'rule_demo_1',
    type: 'no_same_project',
    staffNames: ['大鹿', '寺田'],
    description: '大鹿と寺田は同じ現場に入れない（両者職長のため指揮系統混乱防止）',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'rule_demo_2',
    type: 'no_same_project',
    staffNames: ['尾川', '児山'],
    description: '尾川と児山は同じ現場に入れない（経験者不在防止）',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'rule_demo_3',
    type: 'avoid_facility',
    staffNames: ['大田'],
    facilityName: 'ライオンズマンション',
    description: '大田はライオンズマンションに入れない（過去クレーム対応）',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'rule_demo_4',
    type: 'prefer_together',
    staffNames: ['大鹿', '尾川'],
    description: '大鹿と尾川はできれば一緒に（OJT指導中）',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'rule_demo_5',
    type: 'custom',
    staffNames: ['大鹿'],
    description: '大鹿は火曜日は午後のみ',
    customCondition: '大鹿は火曜日は午後のみ出勤可能。火曜日の午前中に予定を入れないでください。',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'rule_demo_6',
    type: 'custom',
    staffNames: ['尾川'],
    description: '尾川は職長同伴必須',
    customCondition: '尾川は必ず職長資格を持つスタッフ（大鹿または寺田）と一緒に配置してください。単独での現場入りは禁止です。',
    createdAt: '2025-01-01T00:00:00.000Z'
  }
];

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar'>('dashboard');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [facilities] = useState<Facility[]>(MOCK_FACILITIES);
  const [staffList] = useState<Staff[]>(MOCK_STAFF);
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  
  // UI State
  const [isLoadingGen, setIsLoadingGen] = useState(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);

  // ルール状態（localStorageから読み込み、なければ初期ルールを使用）
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>(() => {
    try {
      const saved = localStorage.getItem('scheduleRules');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : INITIAL_RULES;
      }
      return INITIAL_RULES;
    } catch {
      return INITIAL_RULES;
    }
  });

  // ルール保存提案の状態
  const [pendingRule, setPendingRule] = useState<{
    type: string;
    staffNames: string[];
    description: string;
  } | null>(null);

  // ルールを保存
  const saveRule = (rule: Omit<ScheduleRule, 'id' | 'createdAt'>) => {
    const newRule: ScheduleRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updatedRules = [...scheduleRules, newRule];
    setScheduleRules(updatedRules);
    localStorage.setItem('scheduleRules', JSON.stringify(updatedRules));
    setPendingRule(null);

    setValidationResult({
      valid: true,
      severity: 'info',
      message: `ルールを保存しました: ${rule.description}`
    });
    setTimeout(() => setValidationResult(null), 5000);
  };

  // ルールを削除
  const deleteRule = (ruleId: string) => {
    const updatedRules = scheduleRules.filter(r => r.id !== ruleId);
    setScheduleRules(updatedRules);
    localStorage.setItem('scheduleRules', JSON.stringify(updatedRules));
  };

  // ルールを更新
  const updateRule = (rule: ScheduleRule) => {
    const updatedRules = scheduleRules.map(r =>
      r.id === rule.id ? rule : r
    );
    setScheduleRules(updatedRules);
    localStorage.setItem('scheduleRules', JSON.stringify(updatedRules));

    setValidationResult({
      valid: true,
      severity: 'info',
      message: `ルールを更新しました: ${rule.description}`
    });
    setTimeout(() => setValidationResult(null), 3000);
  };
  
  // Modal State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Scene 1: Generate Emergency/Extra Jobs (since regular are pre-loaded)
  const handleGenerateNextMonth = () => {
    setIsLoadingGen(true);
    // Simulate API delay
    setTimeout(() => {
      const newProjects: Project[] = [
        {
          id: `p_emerg_1_${Date.now()}`,
          facility_id: 'f4', // AEON (Night)
          contract_type: 'Spot',
          status: 'Draft',
          amount: 500000,
          target_month: '2025-06',
          title: '【緊急】ポンプ故障対応 (豊洲)',
          required_qualification: '職長',
          required_headcount: 4,
          time_constraints: {
              water_suspension_start: "23:00",
              water_suspension_end: "05:00"
          }
        },
        {
          id: `p_emerg_2_${Date.now()}`,
          facility_id: 'f7', // Factory (Oxygen)
          contract_type: 'Spot',
          status: 'Draft',
          amount: 150000,
          target_month: '2025-06',
          title: '【緊急】漏水調査 (京浜工場)',
          required_qualification: '酸素欠乏危険作業主任者',
          required_headcount: 2
        }
      ];
      setProjects(prev => [...prev, ...newProjects]);
      setIsLoadingGen(false);
      // Switch to calendar to prompt next step
      setActiveTab('calendar'); 
    }, 800);
  };

  // Scene 2: AI Auto Assign with Load Balancing & Team Formation
  const handleAutoSchedule = async () => {
    setIsAutoScheduling(true);
    setValidationResult(null); // 前回のエラーをクリア

    // Filter draft projects
    const draftProjects = projects.filter(p => p.status === 'Draft');

    // ストリーミングイベントハンドラ
    const handleStreamEvent = (event: StreamEvent) => {
      switch (event.type) {
        case 'start':
        case 'chunk':
          // ログ表示は削除済み
          break;
        case 'error':
          setValidationResult({
            valid: false,
            severity: 'error',
            message: event.message || 'AIエラーが発生しました'
          });
          setTimeout(() => setValidationResult(null), 8000);
          break;
        case 'complete':
          // 完了時は何もしない（recommendationsで処理）
          break;
      }
    };

    // カスタムルールを抽出
    const customRules = scheduleRules
      .filter(r => r.type === 'custom' && r.customCondition)
      .map(r => r.customCondition!);

    // Call Gemini for Dates (Streaming)
    const recommendations = await autoAssignScheduleStream(draftProjects, facilities, '2025-06', customRules, handleStreamEvent);

    // エラーハンドリング（空の場合）
    if (recommendations.length === 0 && draftProjects.length > 0) {
      setIsAutoScheduling(false);
      return;
    }
    
    // Apply recommendations with Team Formation Logic
    const newSchedules: ScheduleEvent[] = [];
    const updatedProjects = [...projects];
    
    // Track load to distribute
    const staffLoad: Record<string, number> = {};
    staffList.forEach(s => staffLoad[s.id] = 0);

    recommendations.forEach(rec => {
        // Find project
        const project = updatedProjects.find(p => p.id === rec.projectId);
        if (!project) return;

        const needed = project.required_headcount || 1;
        const assignedTeamIds: string[] = [];

        // ルール適用: 同じプロジェクトに入れないスタッフの組み合わせをチェック
        const noSameProjectRules = scheduleRules.filter(r => r.type === 'no_same_project');
        const avoidFacilityRules = scheduleRules.filter(r => r.type === 'avoid_facility');
        const preferTogetherRules = scheduleRules.filter(r => r.type === 'prefer_together');

        // 施設情報を取得
        const facility = facilities.find(f => f.id === project.facility_id);

        // スタッフが施設に入れるかチェック（avoid_facility）
        const canAssignToFacility = (staffId: string): boolean => {
          const staff = staffList.find(s => s.id === staffId);
          if (!staff || !facility) return true;

          for (const rule of avoidFacilityRules) {
            const isStaffInRule = rule.staffNames.some(name => staff.name.includes(name));
            const isFacilityMatch = facility.name.includes(rule.facilityName || '');
            if (isStaffInRule && isFacilityMatch) {
              console.log(`[Rule Applied] ${staff.name} は ${facility.name} に入れません (${rule.description})`);
              return false;
            }
          }
          return true;
        };

        // スタッフが他のスタッフと同じチームに入れるかチェック
        const canAssignTogether = (staffId: string, currentTeam: string[]): boolean => {
          const staff = staffList.find(s => s.id === staffId);
          if (!staff) return true;

          for (const rule of noSameProjectRules) {
            const staffNamesInRule = rule.staffNames;
            // このスタッフがルールに含まれているか
            const isStaffInRule = staffNamesInRule.some(name => staff.name.includes(name));
            if (!isStaffInRule) continue;

            // 現在のチームにルールで禁止されている相手がいるか
            for (const teamMemberId of currentTeam) {
              const teamMember = staffList.find(s => s.id === teamMemberId);
              if (!teamMember) continue;

              const isTeamMemberInRule = staffNamesInRule.some(name => teamMember.name.includes(name));
              if (isTeamMemberInRule) {
                console.log(`[Rule Applied] ${staff.name} と ${teamMember.name} は同じプロジェクトに入れません (${rule.description})`);
                return false; // このスタッフは追加できない
              }
            }
          }
          return true;
        };

        // 優先ペアを取得（prefer_together）
        const getPreferredPartners = (staffId: string): string[] => {
          const staff = staffList.find(s => s.id === staffId);
          if (!staff) return [];

          const partners: string[] = [];
          for (const rule of preferTogetherRules) {
            const isStaffInRule = rule.staffNames.some(name => staff.name.includes(name));
            if (isStaffInRule) {
              for (const name of rule.staffNames) {
                if (!staff.name.includes(name)) {
                  const partner = staffList.find(s => s.name.includes(name));
                  if (partner && !partners.includes(partner.id)) {
                    partners.push(partner.id);
                  }
                }
              }
            }
          }
          return partners;
        };

        // --- Heuristic: Team Assignment ---
        // 1. Filter qualified candidates + avoid_facility check
        let candidates = staffList.filter(s =>
            (!project.required_qualification || s.qualifications.includes(project.required_qualification)) &&
            canAssignToFacility(s.id)
        );

        // 2. Sort candidates by load (least busy first)
        candidates.sort((a, b) => staffLoad[a.id] - staffLoad[b.id]);

        // 3. Pick Top N available (simplified: not checking date availability in this loop for speed)
        // In real app, check unavailable_dates here too
        for (const candidate of candidates) {
            if (assignedTeamIds.length < needed) {
                // ルールチェック: 既存のチームメンバーと一緒に入れるか
                if (canAssignTogether(candidate.id, assignedTeamIds)) {
                  assignedTeamIds.push(candidate.id);
                  staffLoad[candidate.id] = (staffLoad[candidate.id] || 0) + 1;

                  // prefer_together: 優先ペアがいれば次に追加を試みる
                  if (assignedTeamIds.length < needed) {
                    const preferredPartners = getPreferredPartners(candidate.id);
                    for (const partnerId of preferredPartners) {
                      if (assignedTeamIds.length >= needed) break;
                      if (assignedTeamIds.includes(partnerId)) continue;

                      const partner = candidates.find(c => c.id === partnerId);
                      if (partner && canAssignTogether(partnerId, assignedTeamIds) && canAssignToFacility(partnerId)) {
                        assignedTeamIds.push(partnerId);
                        staffLoad[partnerId] = (staffLoad[partnerId] || 0) + 1;
                        console.log(`[Rule Applied] ${candidate.name} と ${partner.name} を優先的にペアリング (prefer_together)`);
                      }
                    }
                  }
                }
            }
        }

        // If we ran out of qualified people, just pick anyone for POC to avoid empty
        if (assignedTeamIds.length < needed) {
             const leftovers = staffList.filter(s => !assignedTeamIds.includes(s.id) && canAssignToFacility(s.id));
             leftovers.sort((a, b) => staffLoad[a.id] - staffLoad[b.id]);
             for (const extra of leftovers) {
                 if (assignedTeamIds.length < needed) {
                     // ルールチェック: 既存のチームメンバーと一緒に入れるか
                     if (canAssignTogether(extra.id, assignedTeamIds)) {
                       assignedTeamIds.push(extra.id);
                     }
                 }
             }
        }

        // Create schedule event
        newSchedules.push({
            id: `evt_${Date.now()}_${rec.projectId}`,
            project_id: rec.projectId,
            date: rec.recommendedDate,
            staff_ids: assignedTeamIds
        });

        // Update project status
        const pIndex = updatedProjects.findIndex(p => p.id === rec.projectId);
        if (pIndex !== -1) {
            updatedProjects[pIndex] = { ...updatedProjects[pIndex], status: 'Scheduled' };
        }
    });

    setSchedules(prev => [...prev, ...newSchedules]);
    setProjects(updatedProjects);
    setIsAutoScheduling(false);

    // スケジュール作成後、チャットモードに切り替え
    if (newSchedules.length > 0) {
      setIsChatMode(true);
    }
  };

  // チャットからのアクション（日程変更、スタッフ変更など）を処理
  const handleChatAction = (action: {
    action: string;
    projectId?: string;
    newDate?: string;
    staffName?: string;
    removeStaffName?: string;
    addStaffName?: string;
    reason?: string;
    suggestRule?: {
      type: string;
      staffNames: string[];
      description: string;
    };
  } | Array<{ action: string; projectId?: string; staffName?: string; reason?: string; suggestRule?: any }>) => {

    // 配列の場合は各アクションを処理
    const actions = Array.isArray(action) ? action : [action];
    let staffNamesInvolved: string[] = [];

    actions.forEach(act => {
      if (act.action === 'reschedule' && act.projectId && (act as any).newDate) {
        setSchedules(prev => prev.map(s =>
          s.project_id === act.projectId
            ? { ...s, date: (act as any).newDate! }
            : s
        ));
        setValidationResult({
          valid: true,
          severity: 'info',
          message: `スケジュールを ${(act as any).newDate} に変更しました`
        });
      }

      if (act.action === 'remove_staff' && act.projectId && act.staffName) {
        const staffToRemove = staffList.find(s => s.name.includes(act.staffName!));
        if (staffToRemove) {
          setSchedules(prev => prev.map(s =>
            s.project_id === act.projectId
              ? { ...s, staff_ids: s.staff_ids.filter(id => id !== staffToRemove.id) }
              : s
          ));
          staffNamesInvolved.push(act.staffName!);
          setValidationResult({
            valid: true,
            severity: 'info',
            message: `${act.staffName} をプロジェクトから外しました`
          });
        }
      }

      if (act.action === 'swap_staff' && act.projectId) {
        const removeStaff = staffList.find(s => s.name.includes((act as any).removeStaffName || ''));
        const addStaff = staffList.find(s => s.name.includes((act as any).addStaffName || ''));

        if (removeStaff && addStaff) {
          setSchedules(prev => prev.map(s => {
            if (s.project_id === act.projectId) {
              const newStaffIds = s.staff_ids.filter(id => id !== removeStaff.id);
              if (!newStaffIds.includes(addStaff.id)) {
                newStaffIds.push(addStaff.id);
              }
              return { ...s, staff_ids: newStaffIds };
            }
            return s;
          }));
          setValidationResult({
            valid: true,
            severity: 'info',
            message: `${(act as any).removeStaffName} → ${(act as any).addStaffName} に変更しました`
          });
        }
      }

      // ルール提案があれば設定
      if ((act as any).suggestRule) {
        setPendingRule((act as any).suggestRule);
      }
    });

    setTimeout(() => setValidationResult(null), 5000);
  };

  // Scene 3: Drag & Drop with Multi-Assign Logic
  const handleDropEvent = async (projectId: string, date: string, targetStaffId: string, isCopy: boolean) => {
    const project = projects.find(p => p.id === projectId);
    const facility = facilities.find(f => f.id === project?.facility_id);
    const targetStaff = staffList.find(s => s.id === targetStaffId);

    if (!project || !facility || !targetStaff) return;

    // --- Layer 1: Qualification Check (Target Staff) ---
    if (project.required_qualification && !targetStaff.qualifications.includes(project.required_qualification)) {
        setValidationResult({
            valid: false,
            severity: 'error',
            message: `⚠️ 資格不足: ${targetStaff.name} は "${project.required_qualification}" を保持していません。`
        });
        setTimeout(() => setValidationResult(null), 4000);
        return; // BLOCK ACTION
    }

    // --- Layer 2: Complex Overlap Logic (Patterns A, B, C) ---
    // Get all events for the target staff on the target date
    const targetStaffEvents = schedules.filter(s => 
        s.date === date && 
        s.staff_ids.includes(targetStaffId) &&
        s.project_id !== projectId // Exclude self if strictly moving within same day
    );

    let isBlocked = false;
    let infoMessage = "";

    if (targetStaffEvents.length > 0) {
        if (targetStaff.type === 'External') {
            // Pattern A: External Capacity Check
            const currentCount = targetStaffEvents.length;
            const maxCapacity = targetStaff.max_concurrent_work || 1;
            
            // Note: We are adding 1 new project.
            if (currentCount + 1 > maxCapacity) {
                 setValidationResult({
                    valid: false,
                    severity: 'error',
                    message: `⚠️ この外注先は手一杯です (現在: ${currentCount}件 / 上限: ${maxCapacity}件)`
                });
                setTimeout(() => setValidationResult(null), 4000);
                return; // BLOCK
            }
        } else {
            // Internal Staff Logic
            // Pattern B: Same Facility Check
            // Check if ALL overlapping events are at the same facility as the new project
            const isAllSameFacility = targetStaffEvents.every(evt => {
                const existingProject = projects.find(p => p.id === evt.project_id);
                return existingProject?.facility_id === facility.id;
            });

            if (isAllSameFacility) {
                // Allow, but inform
                infoMessage = "ℹ️ 同一施設内の作業として登録しました";
            } else {
                // Pattern C: Impossible Move
                 setValidationResult({
                    valid: false,
                    severity: 'error',
                    message: '⚠️ 時間が重複しており、別の場所への移動が不可能です'
                });
                setTimeout(() => setValidationResult(null), 4000);
                return; // BLOCK
            }
        }
    }

    // --- Proceed with State Update if not blocked ---
    let updatedSchedules = [...schedules];
    
    // Find existing event for this project (if any)
    const existingEventIndex = updatedSchedules.findIndex(s => s.project_id === projectId);
    const existingEvent = updatedSchedules[existingEventIndex];

    if (!existingEvent) {
        // CASE A: New Assignment from Draft List
        updatedSchedules.push({
            id: `evt_${Date.now()}`,
            project_id: projectId,
            date: date,
            staff_ids: [targetStaffId]
        });
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: 'Scheduled' } : p));
    } else {
        // CASE B: Moving Existing Event
        const oldDate = existingEvent.date;
        const isDateChanged = oldDate !== date;

        if (isCopy) {
            // COPY MODE: Add member
            
            if (isDateChanged) {
                // Move entire event to new date AND add the new person
                 updatedSchedules[existingEventIndex] = {
                    ...existingEvent,
                    date: date,
                    staff_ids: [...new Set([...existingEvent.staff_ids, targetStaffId])] // Dedup
                };
            } else {
                // Same date, just add person
                updatedSchedules[existingEventIndex] = {
                    ...existingEvent,
                    staff_ids: [...new Set([...existingEvent.staff_ids, targetStaffId])]
                };
            }
        } else {
            // MOVE MODE: Reassign (Swap or Move)
            // No-Ctrl = Reset team to just this person (Standard Drag behavior)
            
            updatedSchedules[existingEventIndex] = {
                ...existingEvent,
                date: date, // Update date
                staff_ids: [targetStaffId] // Reset team to just this person (Standard Drag behavior)
            };
        }
    }

    setSchedules(updatedSchedules);

    // --- Validation Results Notification ---
    if (infoMessage) {
         setValidationResult({
             valid: true,
             severity: 'info',
             message: infoMessage
         });
         setTimeout(() => setValidationResult(null), 3000);
    }

    // --- Validation Checks on New State (Headcount) ---
    const newEvent = updatedSchedules.find(s => s.project_id === projectId);
    const currentHeadcount = newEvent?.staff_ids.length || 0;
    const requiredHeadcount = project.required_headcount || 1;

    // Headcount Check
    if (currentHeadcount < requiredHeadcount && !infoMessage) {
         setValidationResult({
             valid: false,
             severity: 'warning',
             message: `⚠️ 人数不足: ${currentHeadcount}/${requiredHeadcount} 名アサイン中。Ctrl+ドラッグでメンバーを追加してください。`
         });
         setTimeout(() => setValidationResult(null), 5000);
    }

    // 3. AI Constraint Check (Facility) - Only if date changed
    const isDateChanged = existingEvent ? existingEvent.date !== date : true;
    if (isDateChanged) {
         const result = await validateScheduleMove(facility, date);
         if (!result.valid) {
            setValidationResult({
                valid: false,
                severity: 'warning',
                message: result.message
            });
            setTimeout(() => setValidationResult(null), 5000);
         }
    }
  };

  // Helpers for Modal
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
  const selectedFacility = selectedProject ? facilities.find(f => f.id === selectedProject.facility_id) || null : null;
  const selectedSchedule = selectedProject ? schedules.find(s => s.project_id === selectedProject.id) || null : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Kensetsu<span className="text-indigo-600">AI</span> Manager</h1>
          <span className="ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-mono border border-gray-200">POC v0.3 Multi-Assign</span>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'dashboard' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <LayoutDashboard className="w-4 h-4" />
                管理一覧
            </button>
            <button
                onClick={() => setActiveTab('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all relative ${
                    activeTab === 'calendar' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <CalendarIcon className="w-4 h-4" />
                AIスケジュール
                {projects.filter(p => p.status === 'Draft').length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                     {projects.filter(p => p.status === 'Draft').length}
                   </span>
                )}
            </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6 relative">
         <div className="max-w-full mx-auto h-full"> {/* Expanded width for timeline */}
            {activeTab === 'dashboard' ? (
                <div className="h-full flex flex-col">
                    <div className="mb-4 flex justify-between items-end">
                       <p className="text-sm text-gray-500">
                          {projects.length} 件のプロジェクト ({projects.filter(p => p.status === 'Draft').length} 件が未定)
                       </p>
                       <button
                          onClick={handleGenerateNextMonth}
                          disabled={isLoadingGen}
                          className={`flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-md shadow-sm transition-all ${isLoadingGen ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isLoadingGen ? (
                            <span className="animate-spin mr-2">⟳</span>
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          緊急案件取り込み
                        </button>
                    </div>
                    <DashboardView 
                        projects={projects} 
                        facilities={facilities}
                        onGenerateNextMonth={handleGenerateNextMonth}
                        isLoading={isLoadingGen}
                    />
                </div>
            ) : (
                <CalendarView
                    projects={projects}
                    schedules={schedules}
                    facilities={facilities}
                    staffList={staffList}
                    onAutoSchedule={handleAutoSchedule}
                    onDropEvent={handleDropEvent}
                    onProjectClick={setSelectedProjectId}
                    isAutoScheduling={isAutoScheduling}
                    validationResult={validationResult}
                    isChatMode={isChatMode}
                    onChatAction={handleChatAction}
                    onBackToList={() => setIsChatMode(false)}
                    pendingRule={pendingRule}
                    onSaveRule={(rule) => saveRule({ ...rule, type: rule.type as any })}
                    onDismissRule={() => setPendingRule(null)}
                    rules={scheduleRules}
                    onAddRule={(rule) => saveRule({ ...rule, type: rule.type as any })}
                    onUpdateRule={updateRule}
                    onDeleteRule={deleteRule}
                />
            )}
         </div>
      </main>

      {/* Facility Detail Modal */}
      {selectedProjectId && (
        <FacilityModal 
            project={selectedProject}
            facility={selectedFacility}
            schedule={selectedSchedule}
            onClose={() => setSelectedProjectId(null)}
            staffList={staffList}
        />
      )}
    </div>
  );
};

export default App;
