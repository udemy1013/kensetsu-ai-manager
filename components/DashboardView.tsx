import React from 'react';
import { Project, Facility } from '../types';
import { LayoutGrid, Plus, CheckCircle2, Clock, CalendarDays } from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  facilities: Facility[];
  onGenerateNextMonth: () => void;
  isLoading: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({ projects, facilities, onGenerateNextMonth, isLoading }) => {
  // Sort projects: Draft first, then Scheduled, then Completed
  const sortedProjects = [...projects].sort((a, b) => {
    const statusOrder = { 'Draft': 0, 'Scheduled': 1, 'Invoiced': 2, 'Completed': 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Draft': return '未定';
      case 'Scheduled': return '予定済';
      case 'Completed': return '完了';
      case 'Invoiced': return '請求済';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContractTypeLabel = (type: string) => {
      switch(type) {
          case 'Regular': return '定期';
          case 'Spot': return 'スポット';
          default: return type;
      }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">案件管理台帳 (2025年5月 - 6月)</h2>
        </div>
        <button
          onClick={onGenerateNextMonth}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <span className="animate-spin mr-2">⟳</span>
          ) : (
            <Plus className="w-4 h-4" />
          )}
          6月定期案件作成
        </button>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案件名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">施設名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">対象月</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">契約区分</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受注金額</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProjects.map((project) => {
              const facility = facilities.find(f => f.id === project.facility_id);
              return (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">{project.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{project.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 flex items-center gap-2">
                    {facility?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{project.target_month}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800`}>
                        {getContractTypeLabel(project.contract_type)}
                     </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">¥{project.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                      {project.status === 'Completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {project.status === 'Scheduled' && <CalendarDays className="w-3 h-3 mr-1" />}
                      {project.status === 'Draft' && <Clock className="w-3 h-3 mr-1" />}
                      {getStatusLabel(project.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                  案件が見つかりません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardView;