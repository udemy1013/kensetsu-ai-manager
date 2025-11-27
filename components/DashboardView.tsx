import React, { useState } from 'react';
import { Project, Facility } from '../types';
import { LayoutGrid, Plus, CheckCircle2, Clock, CalendarDays, X } from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  facilities: Facility[];
  onAddProject: (project: Omit<Project, 'id'>) => void;
}

interface ProjectFormData {
  title: string;
  facility_id: string;
  contract_type: 'Regular' | 'Spot';
  target_month: string;
  amount: number;
  required_headcount: number;
  required_qualification: string;
}

const DashboardView: React.FC<DashboardViewProps> = ({ projects, facilities, onAddProject }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    facility_id: '',
    contract_type: 'Spot',
    target_month: '2025-06',
    amount: 0,
    required_headcount: 2,
    required_qualification: ''
  });

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

  const resetForm = () => {
    setFormData({
      title: '',
      facility_id: '',
      contract_type: 'Spot',
      target_month: '2025-06',
      amount: 0,
      required_headcount: 2,
      required_qualification: ''
    });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.facility_id) return;

    const selectedFacility = facilities.find(f => f.id === formData.facility_id);

    onAddProject({
      facility_id: formData.facility_id,
      contract_type: formData.contract_type,
      status: 'Draft',
      amount: formData.amount,
      target_month: formData.target_month,
      title: formData.title || `${selectedFacility?.name || ''} 清掃作業`,
      required_qualification: formData.required_qualification || undefined,
      required_headcount: formData.required_headcount
    });

    resetForm();
    setIsModalOpen(false);
  };

  const handleFacilityChange = (facilityId: string) => {
    const facility = facilities.find(f => f.id === facilityId);
    setFormData(prev => ({
      ...prev,
      facility_id: facilityId,
      title: facility ? `${facility.name} 清掃作業` : prev.title
    }));
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
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          案件追加
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

      {/* 案件追加モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* モーダルヘッダー */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">案件追加</h3>
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="p-4 space-y-4">
              {/* 施設選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  施設 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.facility_id}
                  onChange={(e) => handleFacilityChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">施設を選択...</option>
                  {facilities.map(facility => (
                    <option key={facility.id} value={facility.id}>{facility.name}</option>
                  ))}
                </select>
              </div>

              {/* 案件名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  案件名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例: ○○マンション 清掃作業"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 契約区分と対象月 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">契約区分</label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, contract_type: e.target.value as 'Regular' | 'Spot' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Regular">定期</option>
                    <option value="Spot">スポット</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">対象月</label>
                  <input
                    type="month"
                    value={formData.target_month}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_month: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 受注金額と必要人数 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">受注金額</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">必要人数</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.required_headcount}
                    onChange={(e) => setFormData(prev => ({ ...prev, required_headcount: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 必要資格 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">必要資格（任意）</label>
                <select
                  value={formData.required_qualification}
                  onChange={(e) => setFormData(prev => ({ ...prev, required_qualification: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">指定なし</option>
                  <option value="Foreman">職長</option>
                  <option value="Oxygen">酸欠</option>
                </select>
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.title || !formData.facility_id}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;
