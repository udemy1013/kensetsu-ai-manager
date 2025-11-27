
import React, { useState } from 'react';
import { Project, ScheduleEvent, Facility, Staff, ValidationResult, ScheduleRule } from '../types';
import { Sparkles, AlertTriangle, Calendar as CalendarIcon, GripVertical, Wallet, ShieldAlert, Droplets, Info, Ban, Users, UserPlus, FileText, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isWeekend } from 'date-fns';
import { ja } from 'date-fns/locale';
import ChatPanel from './ChatPanel';
import RuleManagementPanel from './RuleManagementPanel';

interface ChatAction {
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
}

interface PendingRule {
  type: string;
  staffNames: string[];
  description: string;
}

interface CalendarViewProps {
  projects: Project[];
  schedules: ScheduleEvent[];
  facilities: Facility[];
  staffList: Staff[];
  onAutoSchedule: () => void;
  onDropEvent: (projectId: string, date: string, staffId: string, isCopy: boolean) => void;
  onProjectClick: (projectId: string) => void;
  isAutoScheduling: boolean;
  validationResult: ValidationResult | null;
  isChatMode: boolean;
  onChatAction: (action: ChatAction | ChatAction[]) => void;
  onBackToList: () => void;
  pendingRule: PendingRule | null;
  onSaveRule: (rule: PendingRule) => void;
  onDismissRule: () => void;
  // ルール管理用props
  rules: ScheduleRule[];
  onAddRule: (rule: Omit<ScheduleRule, 'id' | 'createdAt'>) => void;
  onUpdateRule: (rule: ScheduleRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  projects,
  schedules,
  facilities,
  staffList,
  onAutoSchedule,
  onDropEvent,
  onProjectClick,
  isAutoScheduling,
  validationResult,
  isChatMode,
  onChatAction,
  onBackToList,
  pendingRule,
  onSaveRule,
  onDismissRule,
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule
}) => {
  const [currentDate] = useState(new Date(2025, 5, 1)); // June 2025
  const [sidebarTab, setSidebarTab] = useState<'projects' | 'rules'>('projects');
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 経過時間のカウントアップ
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAutoScheduling) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoScheduling]);

  // Track Ctrl key for "Copy/Add Member" mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Filter projects that need scheduling (Draft status)
  const unscheduledProjects = projects.filter(p => p.status === 'Draft');

  // Calendar Timeline Generation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // --- Logic for Drag & Drop ---

  const handleDragStart = (e: React.DragEvent, project: Project) => {
    e.dataTransfer.setData('projectId', project.id);
    // e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
    setDraggedProject(project);
    setHoveredProjectId(project.id);
  };

  const handleDragEnd = () => {
      setDraggedProject(null);
      setHoveredProjectId(null);
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    // Visual feedback for Copy mode
    e.dataTransfer.dropEffect = e.ctrlKey || e.metaKey ? 'copy' : 'move';
  };

  const handleDrop = (e: React.DragEvent, date: Date, staffId: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    const isCopy = e.ctrlKey || e.metaKey;

    if (projectId) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onDropEvent(projectId, dateStr, staffId, isCopy);
    }
    setDraggedProject(null);
    setHoveredProjectId(null);
  };

  // --- AI Suggestion Logic (Visual Only) ---
  const isRecommendedResource = (staff: Staff, project: Project | null) => {
    if (!project) return false;
    
    // 1. Hard Qualification Check
    if (project.required_qualification) {
        if (!staff.qualifications.includes(project.required_qualification)) return false;
    }
    
    // 2. Soft "AI" matching
    if (project.contract_type === 'Regular' && staff.type === 'Internal') return true;
    if (project.contract_type === 'Spot' && staff.type === 'External') return true;

    return false;
  };

  // チャット用のスケジュールコンテキストを作成
  const chatScheduleContext = schedules.map(s => {
    const project = projects.find(p => p.id === s.project_id);
    const facility = facilities.find(f => f.id === project?.facility_id);
    const staffNames = s.staff_ids.map(id => {
      const staff = staffList.find(st => st.id === id);
      return staff?.name || `不明(${id})`;
    });
    // デバッグ
    console.log(`[CalendarView] Schedule ${s.project_id}: staff_ids=${JSON.stringify(s.staff_ids)}, staffNames=${JSON.stringify(staffNames)}`);
    return {
      projectId: s.project_id,
      projectTitle: project?.title || '',
      facilityName: facility?.name || '',
      date: s.date,
      staffNames: staffNames
    };
  });

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar: Chat or Unscheduled List */}
      {isChatMode ? (
        <ChatPanel
          schedules={chatScheduleContext}
          onAction={onChatAction}
          onBackToList={onBackToList}
          pendingRule={pendingRule}
          onSaveRule={onSaveRule}
          onDismissRule={onDismissRule}
        />
      ) : (
      <div className="w-80 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col shrink-0 relative">
        {/* タブヘッダー */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setSidebarTab('projects')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative ${
              sidebarTab === 'projects'
                ? 'text-indigo-600 bg-indigo-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            未割当案件
            {unscheduledProjects.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                sidebarTab === 'projects' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {unscheduledProjects.length}
              </span>
            )}
            {sidebarTab === 'projects' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
          <button
            onClick={() => setSidebarTab('rules')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative ${
              sidebarTab === 'rules'
                ? 'text-purple-600 bg-purple-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            ルール
            {rules.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                sidebarTab === 'rules' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {rules.length}
              </span>
            )}
            {sidebarTab === 'rules' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
        </div>

        {/* タブコンテンツ */}
        {sidebarTab === 'projects' ? (
          <>
            <div className="p-3 border-b border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">スタッフの行へドラッグしてください</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {unscheduledProjects.length > 0 ? (
                unscheduledProjects.map(project => {
                    const facility = facilities.find(f => f.id === project.facility_id);
                    return (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project)}
                        onDragEnd={handleDragEnd}
                        onMouseEnter={() => setHoveredProjectId(project.id)}
                        onMouseLeave={() => setHoveredProjectId(null)}
                        className={`p-3 bg-white border rounded-md shadow-sm cursor-grab transition-all group relative
                            ${hoveredProjectId === project.id ? 'border-indigo-500 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 hover:border-indigo-400'}
                        `}
                      >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-800">{project.title}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    {facility?.name}
                                </p>
                            </div>
                            <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                        </div>
                         <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`text-[10px] px-1 rounded border ${project.contract_type === 'Regular' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                {project.contract_type === 'Regular' ? '定期' : 'スポット'}
                            </span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded border border-gray-200 flex items-center gap-0.5">
                                <Users className="w-2 h-2" />
                                {project.required_headcount}名
                            </span>
                            {project.required_qualification && (
                                 <span className="text-[10px] bg-red-50 text-red-700 px-1 rounded border border-red-200 flex items-center gap-0.5">
                                    <ShieldAlert className="w-2 h-2" />
                                    {project.required_qualification}
                                 </span>
                            )}
                        </div>
                      </div>
                    )
                })
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                    全ての案件が割り当て済みです！
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50">
               <button
                 onClick={onAutoSchedule}
                 disabled={isAutoScheduling || unscheduledProjects.length === 0}
                 className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-md shadow hover:opacity-90 transition-opacity disabled:opacity-50"
               >
                 {isAutoScheduling ? (
                   <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    AI分析中...
                   </>
                 ) : (
                   <>
                    <Sparkles className="w-4 h-4" />
                    AI自動アサイン
                   </>
                 )}
               </button>
               {isAutoScheduling && (
                 <div className="mt-2 space-y-2">
                   <div className="flex items-center justify-center gap-2">
                     <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                       <div
                         className="h-full bg-indigo-500 transition-all duration-1000 ease-linear"
                         style={{ width: `${Math.min((elapsedTime / 30) * 100, 100)}%` }}
                       />
                     </div>
                   </div>

                 </div>
               )}
            </div>
          </>
        ) : (
          <RuleManagementPanel
            rules={rules}
            staffList={staffList}
            facilities={facilities}
            onAddRule={onAddRule}
            onUpdateRule={onUpdateRule}
            onDeleteRule={onDeleteRule}
          />
        )}
      </div>
      )}

      {/* Main Calendar Area (Resource Timeline) */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        
        {/* Floating Validation Toast */}
        {validationResult && (
            <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 w-3/4 max-w-lg animate-bounce-in border ${
                validationResult.severity === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
                validationResult.severity === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
                {validationResult.severity === 'error' && <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />}
                {validationResult.severity === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600 mt-0.5" />}
                {validationResult.severity === 'info' && <Info className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />}
                
                <div>
                    <h4 className="font-bold text-sm">
                        {validationResult.valid && validationResult.severity !== 'info' ? 'アサイン情報' : 
                         validationResult.severity === 'info' ? 'お知らせ' : 'スケジュール警告'}
                    </h4>
                    <p className="text-sm mt-1">{validationResult.message}</p>
                </div>
            </div>
        )}

        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-20">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-gray-500" />
                {format(currentDate, 'yyyy年 MMMM', { locale: ja })} - リソースビュー
            </h2>
             <div className="flex items-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-50 border border-yellow-200"></div> 推奨</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 pattern-diagonal-lines"></div> 不可・休暇</div>
                <div className="flex items-center gap-1 text-indigo-600 font-medium">
                    <span className="border border-gray-200 rounded px-1 text-[10px]">Ctrl</span> + ドラッグでメンバー追加
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto relative custom-scrollbar">
            <div className="min-w-[3800px] h-full flex flex-col"> {/* Increased width for better daily column size */}
                
                {/* Header Row: Dates */}
                <div className="flex border-b border-gray-200 sticky top-0 bg-gray-50 z-40">
                    <div className="w-52 shrink-0 p-3 font-semibold text-xs text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0 border-r border-gray-200 z-50">
                        リソース / スタッフ
                    </div>
                    {daysInMonth.map((day) => (
                        <div key={format(day, 'yyyy-MM-dd')} className={`flex-1 min-w-[120px] text-center py-2 text-xs font-medium border-r border-gray-200 ${isWeekend(day) ? 'bg-gray-100/50' : ''} ${isToday(day) ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'}`}>
                            {format(day, 'd', { locale: ja })}
                            <div className="text-[9px] opacity-75">{format(day, 'EEE', { locale: ja })}</div>
                        </div>
                    ))}
                </div>

                {/* Body Rows: Staff */}
                <div className="divide-y divide-gray-200">
                    {staffList.map((staff) => {
                        const isRecommended = isRecommendedResource(staff, draggedProject);
                        
                        return (
                            <div key={staff.id} className={`flex group transition-colors min-h-[100px] ${isRecommended ? 'bg-yellow-50/60' : 'bg-white'}`}>
                                {/* Row Header: Staff Info */}
                                <div className="w-52 shrink-0 p-3 border-r border-gray-200 sticky left-0 z-30 flex items-center gap-3 bg-inherit">
                                    <div className="relative">
                                        <img src={staff.avatar} alt={staff.name} className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200" />
                                        {staff.type === 'External' && (
                                            <div className="absolute -bottom-1 -right-1 bg-green-100 text-green-700 text-[8px] px-1 rounded-full border border-green-200 font-bold">外注</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 leading-tight">{staff.name}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {staff.qualifications.map(q => (
                                                <span key={q} className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">{q.substring(0,2)}..</span>
                                            ))}
                                        </div>
                                        <div className="text-[9px] text-gray-400 mt-1">
                                            同時稼働上限: {staff.max_concurrent_work || 1}
                                        </div>
                                    </div>
                                </div>

                                {/* Calendar Cells */}
                                {daysInMonth.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    // Check availability
                                    const isUnavailable = staff.unavailable_dates?.includes(dateStr);
                                    const unavailableReason = staff.unavailable_reason?.[dateStr];

                                    // Find events for this staff on this day
                                    // NOTE: We check if staff_ids array includes this staff's ID
                                    const dayEvents = schedules.filter(s => s.date === dateStr && s.staff_ids.includes(staff.id));

                                    return (
                                        <div
                                            key={`${staff.id}-${dateStr}`}
                                            onDragOver={!isUnavailable ? handleDragOver : undefined}
                                            onDrop={!isUnavailable ? (e) => handleDrop(e, day, staff.id) : undefined}
                                            className={`
                                                flex-1 min-w-[120px] border-r border-gray-100 p-1 relative transition-colors flex flex-col gap-1
                                                ${isWeekend(day) ? 'bg-gray-50/50' : ''}
                                                ${isUnavailable ? 'bg-gray-100 cursor-not-allowed' : (draggedProject && isRecommended ? 'hover:bg-yellow-100 cursor-copy' : 'hover:bg-indigo-50/30')}
                                            `}
                                        >
                                            {/* Unavailable Block */}
                                            {isUnavailable && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                                    <span className="transform -rotate-45 text-[9px] font-bold text-gray-500 whitespace-nowrap">{unavailableReason || '休暇'}</span>
                                                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxwYXRoIGQ9Ik0wIDBMNCA0Wk00IDBMMCA0WiIgc3Ryb2tlPSIjZTRlNGU3IiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+')] opacity-50"></div>
                                                </div>
                                            )}

                                            {/* Events */}
                                            {dayEvents.map(event => {
                                                const project = projects.find(p => p.id === event.project_id);
                                                const facility = facilities.find(f => f.id === project?.facility_id);
                                                if (!project) return null;

                                                const isHighlighted = hoveredProjectId === project.id;
                                                const currentHeadcount = event.staff_ids.length;
                                                const requiredHeadcount = project.required_headcount || 1;
                                                const isHeadcountShort = currentHeadcount < requiredHeadcount;
                                                
                                                // Find teammates
                                                const teamMates = event.staff_ids
                                                    .filter(id => id !== staff.id)
                                                    .map(id => staffList.find(st => st.id === id))
                                                    .filter(Boolean);

                                                return (
                                                    <div
                                                        key={`${event.id}_${staff.id}`}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, project)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={(e) => { e.stopPropagation(); onProjectClick(project.id); }}
                                                        onMouseEnter={() => setHoveredProjectId(project.id)}
                                                        onMouseLeave={() => setHoveredProjectId(null)}
                                                        className={`
                                                            group relative text-[10px] p-1.5 rounded border shadow-sm cursor-grab truncate transition-all z-10
                                                            ${project.status === 'Scheduled' ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-green-100 border-green-300 text-green-900'}
                                                            ${isHighlighted ? 'ring-2 ring-indigo-500 ring-offset-1 z-20 scale-[1.02] shadow-lg' : ''}
                                                            ${isHeadcountShort ? 'border-l-4 border-l-red-500' : ''}
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 truncate">
                                                                <span className="truncate font-medium">{project.title.replace(/^(6月|5月)\s/, '')}</span>
                                                            </div>
                                                            {/* Headcount Warning Icon */}
                                                            {isHeadcountShort && (
                                                                <div className="text-red-600 bg-red-100 rounded-full px-1 text-[8px] font-bold shrink-0">
                                                                    {currentHeadcount}/{requiredHeadcount}
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1 mt-0.5 opacity-80">
                                                             {project.time_constraints?.water_suspension_start && (
                                                                <Droplets className="w-2.5 h-2.5 text-blue-700" />
                                                             )}
                                                             {teamMates.length > 0 && (
                                                                <span className="flex items-center text-[9px] bg-white/50 px-1 rounded-sm">
                                                                    <Users className="w-2 h-2 mr-0.5" /> +{teamMates.length}
                                                                </span>
                                                             )}
                                                        </div>

                                                        {/* Rich Hover Card / Tooltip */}
                                                        <div className="hidden group-hover:block absolute left-full top-0 ml-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 text-left animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                                                            <h4 className="font-bold text-gray-800 text-xs mb-1">{project.title}</h4>
                                                            <div className="text-[10px] text-gray-500 mb-2">{facility?.name}</div>
                                                            
                                                            {/* Specs Section */}
                                                            <div className="space-y-1 mb-3">
                                                                {isHeadcountShort && (
                                                                    <div className="flex items-center gap-2 text-[10px] bg-red-50 text-red-800 p-1.5 rounded border border-red-100">
                                                                        <AlertTriangle className="w-3 h-3" />
                                                                        <span>人数不足: あと <b>{requiredHeadcount - currentHeadcount}名</b> 必要です</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between text-[10px] bg-gray-50 p-1 rounded">
                                                                    <span className="text-gray-500">水槽容量</span>
                                                                    <span className="font-mono font-medium">{facility?.specs?.tank_capacity || '-'}</span>
                                                                </div>
                                                                {project.time_constraints?.water_suspension_start && (
                                                                     <div className="flex items-center justify-between text-[10px] bg-blue-50 text-blue-800 p-1 rounded border border-blue-100">
                                                                        <span className="flex items-center gap-1"><Droplets className="w-3 h-3"/> 断水時間</span>
                                                                        <span className="font-mono font-bold">{project.time_constraints.water_suspension_start} - {project.time_constraints.water_suspension_end}</span>
                                                                     </div>
                                                                )}
                                                            </div>

                                                            {/* Team Section */}
                                                            <div className="border-t border-gray-100 pt-2">
                                                                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                                                                    <div className="flex items-center gap-1"><Users className="w-3 h-3" /> チーム構成</div>
                                                                    <span>{currentHeadcount} / {requiredHeadcount} 名</span>
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    {/* Self */}
                                                                    <div className="flex items-center gap-2">
                                                                        <img src={staff.avatar} className="w-4 h-4 rounded-full" />
                                                                        <span className="text-[10px] font-bold text-gray-800">{staff.name} (本行)</span>
                                                                    </div>
                                                                    {/* Others */}
                                                                    {teamMates.map((tm, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2 opacity-80">
                                                                            <img src={tm?.avatar} className="w-4 h-4 rounded-full" />
                                                                            <span className="text-[10px] text-gray-700">{tm?.name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Helper Tip */}
                                                            <div className="mt-2 text-[9px] text-indigo-500 text-center border-t border-dashed border-indigo-100 pt-1">
                                                                <b>Ctrl</b> + ドラッグでメンバー追加
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
