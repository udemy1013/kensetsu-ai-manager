import React, { useState } from 'react';
import { ScheduleRule, ScheduleRuleType, Staff, Facility } from '../types';
import { Ban, Building, Users, Calendar, Plus, Pencil, Trash2, X, Check, AlertTriangle, Sparkles } from 'lucide-react';

interface RuleManagementPanelProps {
  rules: ScheduleRule[];
  staffList: Staff[];
  facilities: Facility[];
  onAddRule: (rule: Omit<ScheduleRule, 'id' | 'createdAt'>) => void;
  onUpdateRule: (rule: ScheduleRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

// ルールタイプの表示名とアイコン
const RULE_TYPE_CONFIG: Record<ScheduleRuleType, { label: string; icon: React.ReactNode; color: string }> = {
  no_same_project: {
    label: '同じ現場NG',
    icon: <Ban className="w-4 h-4" />,
    color: 'text-red-600 bg-red-50 border-red-200'
  },
  avoid_facility: {
    label: '施設NG',
    icon: <Building className="w-4 h-4" />,
    color: 'text-orange-600 bg-orange-50 border-orange-200'
  },
  prefer_together: {
    label: '一緒に配置',
    icon: <Users className="w-4 h-4" />,
    color: 'text-green-600 bg-green-50 border-green-200'
  },
  no_same_day: {
    label: '同日別現場NG',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  custom: {
    label: 'カスタム',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200'
  }
};

interface RuleFormData {
  type: ScheduleRuleType;
  staffNames: string[];
  facilityName: string;
  description: string;
  customCondition: string;
}

const RuleManagementPanel: React.FC<RuleManagementPanelProps> = ({
  rules,
  staffList,
  facilities,
  onAddRule,
  onUpdateRule,
  onDeleteRule
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    type: 'no_same_project',
    staffNames: [],
    facilityName: '',
    description: '',
    customCondition: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      type: 'no_same_project',
      staffNames: [],
      facilityName: '',
      description: '',
      customCondition: ''
    });
    setEditingRule(null);
    setIsFormOpen(false);
  };

  const handleEdit = (rule: ScheduleRule) => {
    setEditingRule(rule);
    setFormData({
      type: rule.type,
      staffNames: [...rule.staffNames],
      facilityName: rule.facilityName || '',
      description: rule.description,
      customCondition: rule.customCondition || ''
    });
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (formData.staffNames.length === 0) return;
    if (formData.type === 'avoid_facility' && !formData.facilityName) return;
    if (formData.type === 'custom' && !formData.customCondition.trim()) return;

    const ruleData = {
      type: formData.type,
      staffNames: formData.staffNames,
      facilityName: formData.type === 'avoid_facility' ? formData.facilityName : undefined,
      description: formData.description || generateDescription(formData),
      customCondition: formData.type === 'custom' ? formData.customCondition.trim() : undefined
    };

    if (editingRule) {
      onUpdateRule({
        ...editingRule,
        ...ruleData
      });
    } else {
      onAddRule(ruleData);
    }

    resetForm();
  };

  const generateDescription = (data: RuleFormData): string => {
    const staffStr = data.staffNames.join('と');
    switch (data.type) {
      case 'no_same_project':
        return `${staffStr}は同じ現場に入れない`;
      case 'avoid_facility':
        return `${staffStr}は${data.facilityName}に入れない`;
      case 'prefer_together':
        return `${staffStr}はできれば一緒に`;
      case 'no_same_day':
        return `${staffStr}は同日に別現場NG`;
      case 'custom':
        return data.customCondition || 'カスタムルール';
      default:
        return '';
    }
  };

  const toggleStaff = (staffName: string) => {
    setFormData(prev => ({
      ...prev,
      staffNames: prev.staffNames.includes(staffName)
        ? prev.staffNames.filter(n => n !== staffName)
        : [...prev.staffNames, staffName]
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">{rules.length}</span>
              スケジュールルール
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">自動アサイン時に適用されます</p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-3 h-3" />
            追加
          </button>
        </div>
      </div>

      {/* ルール一覧 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            ルールがありません
          </div>
        ) : (
          rules.map(rule => {
            const config = RULE_TYPE_CONFIG[rule.type];
            return (
              <div
                key={rule.id}
                className={`p-2 rounded-lg border ${config.color} transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="mt-0.5">{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium opacity-75">{config.label}</div>
                      <p className="text-xs font-medium truncate">{rule.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.staffNames.map(name => (
                          <span key={name} className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded">
                            {name}
                          </span>
                        ))}
                        {rule.facilityName && (
                          <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Building className="w-2 h-2" />
                            {rule.facilityName}
                          </span>
                        )}
                        {rule.type === 'custom' && (
                          <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded flex items-center gap-0.5 text-blue-600">
                            <Sparkles className="w-2 h-2" />
                            AI解釈
                          </span>
                        )}
                      </div>
                      {rule.customCondition && (
                        <p className="text-[10px] text-gray-600 mt-1 line-clamp-2">
                          {rule.customCondition}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-1 hover:bg-white/50 rounded transition-colors"
                      title="編集"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {deleteConfirm === rule.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onDeleteRule(rule.id);
                            setDeleteConfirm(null);
                          }}
                          className="p-1 bg-red-600 text-white rounded"
                          title="削除確定"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1 bg-gray-400 text-white rounded"
                          title="キャンセル"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(rule.id)}
                        className="p-1 hover:bg-white/50 rounded transition-colors text-red-600"
                        title="削除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 追加/編集フォーム */}
      {isFormOpen && (
        <div className="absolute inset-0 bg-white z-10 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h4 className="font-semibold text-gray-700">
              {editingRule ? 'ルールを編集' : '新規ルール'}
            </h4>
            <button onClick={resetForm} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* ルールタイプ */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ルールタイプ</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as ScheduleRuleType }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {Object.entries(RULE_TYPE_CONFIG).map(([type, config]) => (
                  <option key={type} value={type}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* スタッフ選択 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                対象スタッフ
                {formData.staffNames.length > 0 && (
                  <span className="ml-1 text-purple-600">({formData.staffNames.length}名選択)</span>
                )}
              </label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded bg-gray-50">
                {staffList.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => toggleStaff(staff.name)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      formData.staffNames.includes(staff.name)
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {staff.name}
                  </button>
                ))}
              </div>
              {formData.staffNames.length === 0 && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  スタッフを選択してください
                </p>
              )}
            </div>

            {/* 施設選択（avoid_facilityの場合のみ） */}
            {formData.type === 'avoid_facility' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">対象施設</label>
                <select
                  value={formData.facilityName}
                  onChange={(e) => setFormData(prev => ({ ...prev, facilityName: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">施設を選択...</option>
                  {facilities.map(facility => (
                    <option key={facility.id} value={facility.name}>{facility.name}</option>
                  ))}
                </select>
                {!formData.facilityName && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    施設を選択してください
                  </p>
                )}
              </div>
            )}

            {/* カスタムルール条件（customの場合のみ） */}
            {formData.type === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ルール条件（自然言語）
                </label>
                <textarea
                  value={formData.customCondition}
                  onChange={(e) => setFormData(prev => ({ ...prev, customCondition: e.target.value }))}
                  placeholder="例: 大鹿は火曜日は午後のみ、尾川は職長同伴必須..."
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AIがスケジューリング時にこの条件を解釈して適用します
                </p>
                {!formData.customCondition.trim() && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    ルール条件を入力してください
                  </p>
                )}
              </div>
            )}

            {/* 説明 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                説明（任意）
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={generateDescription(formData)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                空欄の場合は自動生成されます
              </p>
            </div>
          </div>

          {/* フォームフッター */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
            <button
              onClick={resetForm}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded hover:bg-gray-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                formData.staffNames.length === 0 ||
                (formData.type === 'avoid_facility' && !formData.facilityName) ||
                (formData.type === 'custom' && !formData.customCondition.trim())
              }
              className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editingRule ? '更新' : '追加'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleManagementPanel;
