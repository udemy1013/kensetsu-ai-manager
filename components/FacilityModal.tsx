import React from 'react';
import { Facility, Project, ScheduleEvent, Staff } from '../types';
import { X, MapPin, ClipboardList, Bot, History, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface FacilityModalProps {
  project: Project | null;
  facility: Facility | null;
  schedule: ScheduleEvent | null;
  onClose: () => void;
  staffList?: Staff[];
}

const FacilityModal: React.FC<FacilityModalProps> = ({ project, facility, schedule, onClose, staffList }) => {
  if (!project || !facility) return null;

  const assignedStaff = schedule && staffList 
    ? schedule.staff_ids.map(id => staffList.find(s => s.id === id)).filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Image */}
        <div className="relative h-48 bg-gray-200">
            <img src={facility.imageUrl} alt={facility.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-6 text-white">
                <h2 className="text-2xl font-bold">{facility.name}</h2>
                <div className="flex items-center gap-2 text-sm opacity-90 mt-1">
                    <MapPin className="w-4 h-4" />
                    {facility.address}
                </div>
            </div>
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-md transition-colors"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Project Info */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        案件詳細
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                        <div>
                            <span className="text-xs text-gray-500">案件名</span>
                            <p className="font-semibold text-gray-800">{project.title}</p>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500">実施予定日</span>
                            <p className="font-semibold text-gray-800">
                                {schedule ? format(new Date(schedule.date), 'yyyy年MM月dd日 (EEEE)', { locale: ja }) : '未定'}
                            </p>
                        </div>
                         <div>
                            <span className="text-xs text-gray-500">アサイン状況</span>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-800">{assignedStaff.length} / {project.required_headcount || 1} 名アサイン済</p>
                                {assignedStaff.length < (project.required_headcount || 1) && (
                                    <span className="text-xs text-red-600 bg-red-50 px-2 rounded-full border border-red-100">不足</span>
                                )}
                            </div>
                        </div>
                        {assignedStaff.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                                <span className="text-xs text-gray-500 mb-1 block">チームメンバー</span>
                                <div className="space-y-2">
                                    {assignedStaff.map((staff, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <img src={staff?.avatar} className="w-6 h-6 rounded-full border border-gray-200" />
                                            <span className="text-sm text-gray-700">{staff?.name}</span>
                                            {staff?.role === 'Manager' && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1 rounded">職長</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: AI Insights */}
                <div>
                    <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        AI施設分析
                    </h3>
                    
                    {/* Constraints */}
                    <div className="mb-4">
                        <span className="text-xs font-medium text-gray-700 block mb-2">スケジューリング制約</span>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-900">
                            <ul className="list-disc pl-4 space-y-1">
                                {facility.ai_constraints.days && (
                                    <li>作業可能日: <span className="font-bold">{facility.ai_constraints.days.join(', ')}</span></li>
                                )}
                                {facility.ai_constraints.work_day && (
                                    <li>パターン: {facility.ai_constraints.work_day}</li>
                                )}
                                {facility.ai_constraints.ng_reason && (
                                    <li>制限事項: {facility.ai_constraints.ng_reason}</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Extracted Notes */}
                    <div>
                         <span className="text-xs font-medium text-gray-700 block mb-2 flex items-center gap-1">
                            <History className="w-3 h-3" />
                            過去履歴からの抽出メモ
                         </span>
                         <div className="space-y-2">
                            {facility.ai_notes.map((note, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 p-2.5 rounded text-xs text-gray-600 shadow-sm">
                                    {note}
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-gray-100">
                <p className="text-center text-xs text-gray-400 italic">
                    このデータは日報や契約書類に基づき、Geminiによって自動的にメンテナンスされています。
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FacilityModal;