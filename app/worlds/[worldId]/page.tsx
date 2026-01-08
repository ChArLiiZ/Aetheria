'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { World, WorldStateSchemaItem, SchemaFieldType } from '@/types';
import { getWorldById, createWorld, updateWorld, worldNameExists } from '@/services/supabase/worlds';
import {
  getSchemaByWorldId,
  createSchemaItem,
  updateSchemaItem,
  deleteSchemaItem,
  schemaKeyExists,
} from '@/services/supabase/world-schema';

type Tab = 'basic' | 'states';

interface SchemaFormData {
  schema_key: string;
  display_name: string;
  type: SchemaFieldType;
  ai_description: string;
  default_value: string;
  enum_options: string[];
  list_text_items: string[];
  number_min?: number;
  number_max?: number;
  number_step?: number;
}

function WorldEditorPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const worldId = params.worldId as string;

  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [world, setWorld] = useState<World | null>(null);
  const [schemas, setSchemas] = useState<WorldStateSchemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingWorld, setCreatingWorld] = useState(false);

  // Basic info form
  const [basicFormData, setBasicFormData] = useState({
    name: '',
    description: '',
    rules_text: '',
  });
  const [basicErrors, setBasicErrors] = useState<Record<string, string>>({});
  const [savingBasic, setSavingBasic] = useState(false);

  // Schema form
  const [showSchemaForm, setShowSchemaForm] = useState(false);
  const [editingSchemaId, setEditingSchemaId] = useState<string | null>(null);
  const [schemaFormData, setSchemaFormData] = useState<SchemaFormData>({
    schema_key: '',
    display_name: '',
    type: 'text',
    ai_description: '',
    default_value: '',
    enum_options: [''],
    list_text_items: [''],
    number_min: undefined,
    number_max: undefined,
    number_step: 1,
  });
  const [schemaErrors, setSchemaErrors] = useState<Record<string, string>>({});

  const isNewWorld = worldId === 'new';

  // Load data
  useEffect(() => {
    if (!isNewWorld) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [worldId, user, isNewWorld]);

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
      setBasicFormData({
        name: worldData.name,
        description: worldData.description,
        rules_text: worldData.rules_text,
      });
      setSchemas(schemasData);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
      router.push('/worlds');
    } finally {
      setLoading(false);
    }
  };

  // Basic info handlers
  const validateBasicForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!basicFormData.name.trim()) {
      newErrors.name = '請輸入世界觀名稱';
    } else if (user && basicFormData.name !== world?.name) {
      const exists = await worldNameExists(user.user_id, basicFormData.name.trim(), worldId);
      if (exists) {
        newErrors.name = '此世界觀名稱已存在';
      }
    }

    if (!basicFormData.description.trim()) {
      newErrors.description = '請輸入世界觀描述';
    }

    if (!basicFormData.rules_text.trim()) {
      newErrors.rules_text = '請輸入世界規則';
    }

    setBasicErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateWorld = async () => {
    if (!user) return;

    const isValid = await validateBasicForm();
    if (!isValid) {
      setActiveTab('basic');
      return;
    }

    try {
      setCreatingWorld(true);

      // Create new world
      const newWorld = await createWorld(user.user_id, {
        name: basicFormData.name.trim(),
        description: basicFormData.description.trim(),
        rules_text: basicFormData.rules_text.trim(),
      });

      // Create all schema items
      for (const schema of schemas) {
        await createSchemaItem(newWorld.world_id, user.user_id, {
          schema_key: schema.schema_key,
          display_name: schema.display_name,
          type: schema.type,
          ai_description: schema.ai_description,
          default_value_json: schema.default_value_json,
          enum_options_json: schema.enum_options_json,
          number_constraints_json: schema.number_constraints_json,
        });
      }

      // Redirect to worlds list page
      alert(`✅ 世界觀「${newWorld.name}」建立成功！${schemas.length > 0 ? `已設定 ${schemas.length} 個狀態種類。` : ''}`);
      router.push('/worlds');
    } catch (err: any) {
      console.error('Failed to create world:', err);
      alert(`建立失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setCreatingWorld(false);
    }
  };

  const handleSaveBasic = async () => {
    if (!user) return;

    const isValid = await validateBasicForm();
    if (!isValid) return;

    try {
      setSavingBasic(true);

      // Update existing world
      await updateWorld(worldId, user.user_id, {
        name: basicFormData.name.trim(),
        description: basicFormData.description.trim(),
        rules_text: basicFormData.rules_text.trim(),
      });

      await loadData();
      alert('✅ 儲存成功！');
    } catch (err: any) {
      console.error('Failed to save world:', err);
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingBasic(false);
    }
  };

  // Schema handlers
  const resetSchemaForm = () => {
    setSchemaFormData({
      schema_key: '',
      display_name: '',
      type: 'text',
      ai_description: '',
      default_value: '',
      enum_options: [''],
      list_text_items: [''],
      number_min: undefined,
      number_max: undefined,
      number_step: 1,
    });
    setSchemaErrors({});
    setEditingSchemaId(null);
    setShowSchemaForm(false);
  };

  const handleEditSchema = (schema: WorldStateSchemaItem) => {
    let enumOptions: string[] = [''];
    if (schema.type === 'enum' && schema.enum_options_json) {
      try {
        enumOptions = JSON.parse(schema.enum_options_json);
      } catch (e) {
        enumOptions = [''];
      }
    }

    let listTextItems: string[] = [''];
    if (schema.type === 'list_text' && schema.default_value_json) {
      try {
        listTextItems = JSON.parse(schema.default_value_json);
        if (!Array.isArray(listTextItems) || listTextItems.length === 0) {
          listTextItems = [''];
        }
      } catch (e) {
        listTextItems = [''];
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

    setSchemaFormData({
      schema_key: schema.schema_key,
      display_name: schema.display_name,
      type: schema.type,
      ai_description: schema.ai_description,
      default_value: schema.type === 'list_text' ? '' : (schema.default_value_json || ''),
      enum_options: enumOptions.length > 0 ? enumOptions : [''],
      list_text_items: listTextItems,
      number_min: numberMin,
      number_max: numberMax,
      number_step: numberStep || 1,
    });
    setEditingSchemaId(schema.schema_id);
    setShowSchemaForm(true);
  };

  const validateSchemaForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!schemaFormData.schema_key.trim()) {
      newErrors.schema_key = '請輸入狀態 Key';
    } else if (!/^[a-z_]+$/.test(schemaFormData.schema_key)) {
      newErrors.schema_key = '狀態 Key 只能包含小寫字母和底線';
    } else if (user) {
      if (isNewWorld) {
        // Check in local state
        const exists = schemas.some(
          s => s.schema_key === schemaFormData.schema_key && s.schema_id !== editingSchemaId
        );
        if (exists) {
          newErrors.schema_key = '此狀態 Key 已存在';
        }
      } else {
        // Check in database
        const exists = await schemaKeyExists(
          worldId,
          user.user_id,
          schemaFormData.schema_key,
          editingSchemaId || undefined
        );
        if (exists) {
          newErrors.schema_key = '此狀態 Key 已存在';
        }
      }
    }

    if (!schemaFormData.display_name.trim()) {
      newErrors.display_name = '請輸入顯示名稱';
    }

    if (!schemaFormData.ai_description.trim()) {
      newErrors.ai_description = '請輸入 AI 描述';
    }

    if (schemaFormData.type === 'enum') {
      const validOptions = schemaFormData.enum_options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        newErrors.enum_options = '至少需要兩個選項';
      }
    }

    setSchemaErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const isValid = await validateSchemaForm();
    if (!isValid) return;

    try {
      const data: any = {
        schema_key: schemaFormData.schema_key.trim(),
        display_name: schemaFormData.display_name.trim(),
        type: schemaFormData.type,
        ai_description: schemaFormData.ai_description.trim(),
        default_value_json: schemaFormData.default_value.trim(),
        enum_options_json: '',
        number_constraints_json: '',
      };

      if (schemaFormData.type === 'enum') {
        const validOptions = schemaFormData.enum_options.filter((opt) => opt.trim());
        data.enum_options_json = JSON.stringify(validOptions);
      }

      if (schemaFormData.type === 'number') {
        data.number_constraints_json = JSON.stringify({
          min: schemaFormData.number_min,
          max: schemaFormData.number_max,
          step: schemaFormData.number_step || 1,
        });
      }

      if (schemaFormData.type === 'list_text') {
        const validItems = schemaFormData.list_text_items.filter((item) => item.trim());
        data.default_value_json = JSON.stringify(validItems);
      }

      if (isNewWorld) {
        // In new mode, just update local state
        if (editingSchemaId) {
          // Edit existing local schema
          setSchemas(schemas.map(s =>
            s.schema_id === editingSchemaId
              ? { ...s, ...data, updated_at: new Date().toISOString() }
              : s
          ));
        } else {
          // Add new local schema
          const newSchema: WorldStateSchemaItem = {
            schema_id: `temp-${Date.now()}`,
            world_id: 'temp',
            user_id: user.user_id,
            sort_order: schemas.length + 1,
            updated_at: new Date().toISOString(),
            ...data,
          };
          setSchemas([...schemas, newSchema]);
        }
        resetSchemaForm();
      } else {
        // In edit mode, save to database
        if (editingSchemaId) {
          await updateSchemaItem(editingSchemaId, user.user_id, data);
        } else {
          await createSchemaItem(worldId, user.user_id, data);
        }

        await loadData();
        resetSchemaForm();
      }
    } catch (err: any) {
      console.error('Failed to save schema:', err);
      alert(`儲存失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleDeleteSchema = async (schemaId: string, displayName: string) => {
    if (!user) return;

    if (!confirm(`確定要刪除「${displayName}」嗎？${isNewWorld ? '' : '\n\n此操作無法復原！'}`)) {
      return;
    }

    try {
      if (isNewWorld) {
        // In new mode, just remove from local state
        setSchemas(schemas.filter(s => s.schema_id !== schemaId));
      } else {
        // In edit mode, delete from database
        await deleteSchemaItem(schemaId, user.user_id);
        await loadData();
      }
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isNewWorld ? '新建世界觀' : `編輯世界觀：${world?.name || ''}`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isNewWorld
                ? '建立一個新的故事世界觀，定義世界的基本設定和狀態種類'
                : '管理世界觀的基本設定與狀態種類'}
            </p>
          </div>
          <button
            onClick={() => router.push('/worlds')}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← 返回列表
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('basic')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'basic'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              📝 基本設定
            </button>
            <button
              onClick={() => setActiveTab('states')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'states'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              🎯 狀態種類 ({schemas.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'basic' ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              基本設定
            </h2>

            {/* Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                世界觀名稱 *
              </label>
              <input
                type="text"
                value={basicFormData.name}
                onChange={(e) => setBasicFormData({ ...basicFormData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              {basicErrors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{basicErrors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                世界描述 *
              </label>
              <textarea
                value={basicFormData.description}
                onChange={(e) =>
                  setBasicFormData({ ...basicFormData, description: e.target.value })
                }
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              {basicErrors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {basicErrors.description}
                </p>
              )}
            </div>

            {/* Rules Text */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                世界規則 *
              </label>
              <textarea
                value={basicFormData.rules_text}
                onChange={(e) =>
                  setBasicFormData({ ...basicFormData, rules_text: e.target.value })
                }
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
              />
              {basicErrors.rules_text && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {basicErrors.rules_text}
                </p>
              )}
            </div>

            {/* Save Button (only in edit mode) */}
            {!isNewWorld && (
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => router.push('/worlds')}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveBasic}
                  disabled={savingBasic}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {savingBasic ? '儲存中...' : '儲存變更'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Add Button */}
            {!showSchemaForm && (
              <button
                onClick={() => setShowSchemaForm(true)}
                className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                + 新增狀態種類
              </button>
            )}

            {/* Schema Form */}
            {showSchemaForm && (
              <form
                onSubmit={handleSubmitSchema}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {editingSchemaId ? '編輯' : '新增'}狀態種類
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Schema Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      狀態 Key * <span className="text-gray-500">(小寫+底線)</span>
                    </label>
                    <input
                      type="text"
                      value={schemaFormData.schema_key}
                      onChange={(e) =>
                        setSchemaFormData({
                          ...schemaFormData,
                          schema_key: e.target.value.toLowerCase(),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono"
                      placeholder="health_points"
                    />
                    {schemaErrors.schema_key && (
                      <p className="mt-1 text-sm text-red-600">{schemaErrors.schema_key}</p>
                    )}
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      顯示名稱 *
                    </label>
                    <input
                      type="text"
                      value={schemaFormData.display_name}
                      onChange={(e) =>
                        setSchemaFormData({ ...schemaFormData, display_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="生命值"
                    />
                    {schemaErrors.display_name && (
                      <p className="mt-1 text-sm text-red-600">{schemaErrors.display_name}</p>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    資料類型 *
                  </label>
                  <select
                    value={schemaFormData.type}
                    onChange={(e) =>
                      setSchemaFormData({
                        ...schemaFormData,
                        type: e.target.value as SchemaFieldType,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="text">文字 (text) - 單行文字</option>
                    <option value="number">數字 (number) - 數值型態</option>
                    <option value="bool">布林 (bool) - 真/假值</option>
                    <option value="enum">列舉 (enum) - 多選一</option>
                    <option value="list_text">文字列表 (list_text) - 多項文字</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {schemaFormData.type === 'text' && '適合：名稱、描述等單行文字'}
                    {schemaFormData.type === 'number' && '適合：生命值、金錢、等級等數值'}
                    {schemaFormData.type === 'bool' && '適合：是否存活、是否完成任務等真假值'}
                    {schemaFormData.type === 'enum' && '適合：職業、陣營等固定選項'}
                    {schemaFormData.type === 'list_text' && '適合：背包物品、已學技能等多項文字列表'}
                  </p>
                </div>

                {/* AI Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    AI 描述 * <span className="text-gray-500">(給 AI 看的說明)</span>
                  </label>
                  <textarea
                    value={schemaFormData.ai_description}
                    onChange={(e) =>
                      setSchemaFormData({ ...schemaFormData, ai_description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="描述這個欄位的意義、如何變化、範圍等..."
                  />
                  {schemaErrors.ai_description && (
                    <p className="mt-1 text-sm text-red-600">{schemaErrors.ai_description}</p>
                  )}
                </div>

                {/* Default Value (not for list_text) */}
                {schemaFormData.type !== 'list_text' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      預設值
                    </label>
                    {schemaFormData.type === 'bool' ? (
                      <select
                        value={schemaFormData.default_value}
                        onChange={(e) =>
                          setSchemaFormData({ ...schemaFormData, default_value: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">（不設定）</option>
                        <option value="true">真 (true)</option>
                        <option value="false">假 (false)</option>
                      </select>
                    ) : schemaFormData.type === 'enum' ? (
                      <select
                        value={schemaFormData.default_value}
                        onChange={(e) =>
                          setSchemaFormData({ ...schemaFormData, default_value: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        disabled={schemaFormData.enum_options.length === 0}
                      >
                        <option value="">（不設定）</option>
                        {schemaFormData.enum_options.map((option, index) => (
                          <option key={index} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={schemaFormData.default_value}
                        onChange={(e) =>
                          setSchemaFormData({ ...schemaFormData, default_value: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder={
                          schemaFormData.type === 'number'
                            ? '100'
                            : '預設文字'
                        }
                      />
                    )}
                    {schemaFormData.type === 'enum' && schemaFormData.enum_options.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        請先在上方新增列舉選項
                      </p>
                    )}
                  </div>
                )}

                {/* Number Constraints */}
                {schemaFormData.type === 'number' && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        最小值
                      </label>
                      <input
                        type="number"
                        value={schemaFormData.number_min ?? ''}
                        onChange={(e) =>
                          setSchemaFormData({
                            ...schemaFormData,
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
                        value={schemaFormData.number_max ?? ''}
                        onChange={(e) =>
                          setSchemaFormData({
                            ...schemaFormData,
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
                        value={schemaFormData.number_step ?? 1}
                        onChange={(e) =>
                          setSchemaFormData({
                            ...schemaFormData,
                            number_step: e.target.value ? Number(e.target.value) : 1,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Enum Options */}
                {schemaFormData.type === 'enum' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      列舉選項 * <span className="text-gray-500">(至少兩個)</span>
                    </label>
                    {schemaFormData.enum_options.map((option, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...schemaFormData.enum_options];
                            newOptions[index] = e.target.value;
                            setSchemaFormData({ ...schemaFormData, enum_options: newOptions });
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder={`選項 ${index + 1}`}
                        />
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newOptions = schemaFormData.enum_options.filter(
                                (_, i) => i !== index
                              );
                              setSchemaFormData({ ...schemaFormData, enum_options: newOptions });
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
                        setSchemaFormData({
                          ...schemaFormData,
                          enum_options: [...schemaFormData.enum_options, ''],
                        })
                      }
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      + 新增選項
                    </button>
                    {schemaErrors.enum_options && (
                      <p className="mt-1 text-sm text-red-600">{schemaErrors.enum_options}</p>
                    )}
                  </div>
                )}

                {/* List Text Items */}
                {schemaFormData.type === 'list_text' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      預設項目 <span className="text-gray-500">(可選，可新增多個)</span>
                    </label>
                    {schemaFormData.list_text_items.map((item, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newItems = [...schemaFormData.list_text_items];
                            newItems[index] = e.target.value;
                            setSchemaFormData({ ...schemaFormData, list_text_items: newItems });
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder={`項目 ${index + 1}`}
                        />
                        {schemaFormData.list_text_items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = schemaFormData.list_text_items.filter(
                                (_, i) => i !== index
                              );
                              setSchemaFormData({ ...schemaFormData, list_text_items: newItems });
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
                        setSchemaFormData({
                          ...schemaFormData,
                          list_text_items: [...schemaFormData.list_text_items, ''],
                        })
                      }
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      + 新增項目
                    </button>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      提示：例如設定「長劍」、「治療藥水」等預設物品
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={resetSchemaForm}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingSchemaId ? '儲存變更' : '新增'}
                  </button>
                </div>
              </form>
            )}

            {/* Schema List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  已設定的狀態種類
                </h2>
              </div>

              {schemas.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  還沒有設定任何狀態種類
                  <br />
                  <span className="text-sm">
                    狀態種類用於追蹤角色、物品等在故事中的各種狀態
                  </span>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {schemas.map((schema) => (
                    <div
                      key={schema.schema_id}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
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
                              {schema.type === 'text'
                                ? '文字'
                                : schema.type === 'number'
                                ? '數字'
                                : schema.type === 'bool'
                                ? '布林'
                                : schema.type === 'enum'
                                ? '列舉'
                                : '文字列表'}
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
                            onClick={() => handleEditSchema(schema)}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteSchema(schema.schema_id, schema.display_name)
                            }
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
          </div>
        )}

        {/* Create World Button (only in new mode) */}
        {isNewWorld && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  準備好建立世界觀了嗎？
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {schemas.length > 0
                    ? `已設定 ${schemas.length} 個狀態種類，點擊建立按鈕即可完成！`
                    : '您可以先設定狀態種類，也可以稍後再添加。'}
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/worlds')}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateWorld}
                  disabled={creatingWorld}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 font-semibold"
                >
                  {creatingWorld ? '建立中...' : '✨ 建立世界觀'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function WorldEditorPage() {
  return (
    <ProtectedRoute>
      <WorldEditorPageContent />
    </ProtectedRoute>
  );
}
