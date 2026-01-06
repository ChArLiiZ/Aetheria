'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { World, WorldStateSchemaItem, SchemaFieldType } from '@/types';
import { getWorldById } from '@/services/sheets/worlds-appsscript';
import {
  getSchemaByWorldId,
  createSchemaItem,
  updateSchemaItem,
  deleteSchemaItem,
  schemaKeyExists,
} from '@/services/sheets/world-schema-appsscript';

interface SchemaFormData {
  schema_key: string;
  display_name: string;
  type: SchemaFieldType;
  ai_description: string;
  default_value: string;
  enum_options: string[];
  number_min?: number;
  number_max?: number;
  number_step?: number;
}

function SchemaEditorPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const worldId = params.worldId as string;

  const [world, setWorld] = useState<World | null>(null);
  const [schemas, setSchemas] = useState<WorldStateSchemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<SchemaFormData>({
    schema_key: '',
    display_name: '',
    type: 'text',
    ai_description: '',
    default_value: '',
    enum_options: [''],
    number_min: undefined,
    number_max: undefined,
    number_step: 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load data
  useEffect(() => {
    loadData();
  }, [worldId, user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [worldData, schemasData] = await Promise.all([
        getWorldById(worldId, user.user_id),
        getSchemaByWorldId(worldId, user.user_id),
      ]);

      if (!worldData) {
        alert('找不到此世界觀');
        router.push('/worlds');
        return;
      }

      setWorld(worldData);
      setSchemas(schemasData);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      schema_key: '',
      display_name: '',
      type: 'text',
      ai_description: '',
      default_value: '',
      enum_options: [''],
      number_min: undefined,
      number_max: undefined,
      number_step: 1,
    });
    setErrors({});
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (schema: WorldStateSchemaItem) => {
    let enumOptions: string[] = [''];
    if (schema.type === 'enum' && schema.enum_options_json) {
      try {
        enumOptions = JSON.parse(schema.enum_options_json);
      } catch (e) {
        enumOptions = [''];
      }
    }

    let numberMin, numberMax, numberStep;
    if (schema.type === 'number' && schema.number_constraints_json) {
      try {
        const constraints = JSON.parse(schema.number_constraints_json);
        numberMin = constraints.min;
        numberMax = constraints.max;
        numberStep = constraints.step || 1;
      } catch (e) {}
    }

    setFormData({
      schema_key: schema.schema_key,
      display_name: schema.display_name,
      type: schema.type,
      ai_description: schema.ai_description,
      default_value: schema.default_value_json || '',
      enum_options: enumOptions.length > 0 ? enumOptions : [''],
      number_min: numberMin,
      number_max: numberMax,
      number_step: numberStep || 1,
    });
    setEditingId(schema.schema_id);
    setShowForm(true);
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.schema_key.trim()) {
      newErrors.schema_key = '請輸入 Schema Key';
    } else if (!/^[a-z_]+$/.test(formData.schema_key)) {
      newErrors.schema_key = 'Schema Key 只能包含小寫字母和底線';
    } else if (user) {
      const exists = await schemaKeyExists(
        worldId,
        user.user_id,
        formData.schema_key,
        editingId || undefined
      );
      if (exists) {
        newErrors.schema_key = '此 Schema Key 已存在';
      }
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = '請輸入顯示名稱';
    }

    if (!formData.ai_description.trim()) {
      newErrors.ai_description = '請輸入 AI 描述';
    }

    if (formData.type === 'enum') {
      const validOptions = formData.enum_options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        newErrors.enum_options = '至少需要兩個選項';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const isValid = await validateForm();
    if (!isValid) return;

    try {
      const data: any = {
        schema_key: formData.schema_key.trim(),
        display_name: formData.display_name.trim(),
        type: formData.type,
        ai_description: formData.ai_description.trim(),
        default_value_json: formData.default_value.trim(),
      };

      if (formData.type === 'enum') {
        const validOptions = formData.enum_options.filter((opt) => opt.trim());
        data.enum_options_json = JSON.stringify(validOptions);
      }

      if (formData.type === 'number') {
        data.number_constraints_json = JSON.stringify({
          min: formData.number_min,
          max: formData.number_max,
          step: formData.number_step || 1,
        });
      }

      if (editingId) {
        await updateSchemaItem(editingId, user.user_id, data);
      } else {
        await createSchemaItem(worldId, user.user_id, data);
      }

      await loadData();
      resetForm();
    } catch (err: any) {
      console.error('Failed to save schema:', err);
      alert(`儲存失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleDelete = async (schemaId: string, displayName: string) => {
    if (!user) return;

    if (!confirm(`確定要刪除「${displayName}」嗎？\n\n此操作無法復原！`)) {
      return;
    }

    try {
      await deleteSchemaItem(schemaId, user.user_id);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete schema:', err);
      alert(`刪除失敗: ${err.message || '未知錯誤'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  if (!world) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Schema 編輯器
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            為「{world.name}」定義狀態 Schema
          </p>
        </div>

        {/* Add Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + 新增 Schema 欄位
          </button>
        )}

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? '編輯' : '新增'} Schema 欄位
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Schema Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Schema Key * <span className="text-gray-500">(小寫+底線)</span>
                </label>
                <input
                  type="text"
                  value={formData.schema_key}
                  onChange={(e) =>
                    setFormData({ ...formData, schema_key: e.target.value.toLowerCase() })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono"
                  placeholder="health_points"
                />
                {errors.schema_key && (
                  <p className="mt-1 text-sm text-red-600">{errors.schema_key}</p>
                )}
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  顯示名稱 *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="生命值"
                />
                {errors.display_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.display_name}</p>
                )}
              </div>
            </div>

            {/* Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                資料類型 *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as SchemaFieldType })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="text">文字 (text)</option>
                <option value="number">數字 (number)</option>
                <option value="enum">列舉 (enum)</option>
              </select>
            </div>

            {/* AI Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                AI 描述 * <span className="text-gray-500">(給 AI 看的說明)</span>
              </label>
              <textarea
                value={formData.ai_description}
                onChange={(e) => setFormData({ ...formData, ai_description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                placeholder="描述這個欄位的意義、如何變化、範圍等..."
              />
              {errors.ai_description && (
                <p className="mt-1 text-sm text-red-600">{errors.ai_description}</p>
              )}
            </div>

            {/* Default Value */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                預設值
              </label>
              <input
                type="text"
                value={formData.default_value}
                onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder={formData.type === 'number' ? '100' : formData.type === 'enum' ? '選項1' : '預設文字'}
              />
            </div>

            {/* Number Constraints */}
            {formData.type === 'number' && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    最小值
                  </label>
                  <input
                    type="number"
                    value={formData.number_min ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        number_min: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    最大值
                  </label>
                  <input
                    type="number"
                    value={formData.number_max ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        number_max: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    步進值
                  </label>
                  <input
                    type="number"
                    value={formData.number_step ?? 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        number_step: e.target.value ? Number(e.target.value) : 1,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Enum Options */}
            {formData.type === 'enum' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  列舉選項 * <span className="text-gray-500">(至少兩個)</span>
                </label>
                {formData.enum_options.map((option, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...formData.enum_options];
                        newOptions[index] = e.target.value;
                        setFormData({ ...formData, enum_options: newOptions });
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder={`選項 ${index + 1}`}
                    />
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = formData.enum_options.filter((_, i) => i !== index);
                          setFormData({ ...formData, enum_options: newOptions });
                        }}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        刪除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, enum_options: [...formData.enum_options, ''] })
                  }
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  + 新增選項
                </button>
                {errors.enum_options && (
                  <p className="mt-1 text-sm text-red-600">{errors.enum_options}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingId ? '儲存變更' : '新增'}
              </button>
            </div>
          </form>
        )}

        {/* Schema List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Schema 欄位列表
            </h2>
          </div>

          {schemas.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              還沒有任何 Schema 欄位
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {schemas.map((schema) => (
                <div key={schema.schema_id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {schema.schema_key}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {schema.display_name}
                        </span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                          {schema.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {schema.ai_description}
                      </p>
                      {schema.default_value_json && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          預設值：{schema.default_value_json}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(schema)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDelete(schema.schema_id, schema.display_name)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center space-x-4">
          <button
            onClick={() => router.push('/worlds')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← 返回世界觀列表
          </button>
          <button
            onClick={() => router.push(`/worlds/${worldId}/edit`)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            編輯世界觀設定
          </button>
        </div>
      </div>
    </main>
  );
}

export default function SchemaEditorPage() {
  return (
    <ProtectedRoute>
      <SchemaEditorPageContent />
    </ProtectedRoute>
  );
}
