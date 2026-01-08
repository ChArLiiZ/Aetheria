'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ProviderSettings, AIParams } from '@/types';
import {
  getProviderSettings,
  upsertProviderSettings,
  deleteProviderSettings,
  Provider,
} from '@/services/sheets/provider-settings-appsscript';
import {
  getUserById,
  updateDisplayName,
  updatePassword,
} from '@/services/sheets/users-appsscript';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// Model presets for each provider
const MODEL_PRESETS: Record<Provider, string[]> = {
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-haiku',
    'openai/gpt-4-turbo',
    'google/gemini-pro-1.5',
  ],
  gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
};

interface ProviderCardProps {
  provider: Provider;
  providerName: string;
  providerIcon: string;
  settings: ProviderSettings | null;
  onSave: (data: {
    api_key: string;
    default_model: string;
    default_params: AIParams;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}

function ProviderCard({
  provider,
  providerName,
  providerIcon,
  settings,
  onSave,
  onDelete,
}: ProviderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [usePreset, setUsePreset] = useState(true);
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [topP, setTopP] = useState(1.0);

  useEffect(() => {
    if (settings) {
      setApiKey(settings.api_key);
      setDefaultModel(settings.default_model);

      // Check if model is in presets
      const isPreset = MODEL_PRESETS[provider].includes(settings.default_model);
      setUsePreset(isPreset);
      if (!isPreset) {
        setCustomModel(settings.default_model);
      }

      // Parse params
      try {
        const params: AIParams = JSON.parse(settings.default_params_json || '{}');
        setTemperature(params.temperature ?? 1.0);
        setMaxTokens(params.max_tokens ?? 4000);
        setTopP(params.top_p ?? 1.0);
      } catch (e) {
        console.error('Failed to parse params:', e);
      }
    }
  }, [settings, provider]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('請輸入 API Key');
      return;
    }

    const model = usePreset ? defaultModel : customModel;
    if (!model.trim()) {
      alert('請選擇或輸入模型名稱');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        api_key: apiKey.trim(),
        default_model: model.trim(),
        default_params: {
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
        },
      });
      alert('✅ 儲存成功！');
    } catch (err: any) {
      console.error('Failed to save:', err);
      alert(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`確定要刪除 ${providerName} 的設定嗎？`)) {
      return;
    }

    try {
      await onDelete();
      alert('✅ 刪除成功！');
      setApiKey('');
      setDefaultModel('');
      setCustomModel('');
    } catch (err: any) {
      console.error('Failed to delete:', err);
      alert(`刪除失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '***';
    return `${key.slice(0, 4)}***...***${key.slice(-4)}`;
  };

  const hasSettings = settings && settings.api_key;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{providerIcon}</span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {providerName}
            </h3>
            {hasSettings && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ 已設定 API Key
              </p>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key *
            </label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
                placeholder="輸入您的 API Key"
              />
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  {showApiKey ? '隱藏' : '顯示'}
                </button>
              )}
            </div>
            {hasSettings && !showApiKey && (
              <p className="mt-1 text-xs text-gray-500">
                目前：{maskApiKey(settings.api_key)}
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              預設模型 *
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={usePreset}
                    onChange={() => setUsePreset(true)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    選擇常用模型
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!usePreset}
                    onChange={() => setUsePreset(false)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    手動輸入
                  </span>
                </label>
              </div>

              {usePreset ? (
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">請選擇模型</option>
                  {MODEL_PRESETS[provider].map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="例如：anthropic/claude-3.5-sonnet"
                />
              )}
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              預設參數
            </h4>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Temperature
                </label>
                <input
                  type="number"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <input
                type="range"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                控制輸出的隨機性（0 = 確定性，2 = 最隨機）
              </p>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  min={1}
                  max={128000}
                  step={100}
                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <input
                type="range"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                min={100}
                max={128000}
                step={100}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                最大生成 token 數量
              </p>
            </div>

            {/* Top P */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Top P
                </label>
                <input
                  type="number"
                  value={topP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <input
                type="range"
                value={topP}
                onChange={(e) => setTopP(Number(e.target.value))}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                核心取樣參數（0.9 = 考慮前 90% 可能性的詞彙）
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {saving ? '儲存中...' : '儲存設定'}
            </button>
            {hasSettings && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                刪除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Provider settings
  const [providerSettings, setProviderSettings] = useState<Record<Provider, ProviderSettings | null>>({
    openrouter: null,
    gemini: null,
    openai: null,
  });

  // Account settings
  const [displayName, setDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load provider settings
      const settings = await getProviderSettings(user.user_id);
      const settingsMap: Record<Provider, ProviderSettings | null> = {
        openrouter: null,
        gemini: null,
        openai: null,
      };

      settings.forEach((s) => {
        settingsMap[s.provider as Provider] = s;
      });

      setProviderSettings(settingsMap);

      // Load user data
      const userData = await getUserById(user.user_id);
      if (userData) {
        setDisplayName(userData.display_name);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProvider = async (
    provider: Provider,
    data: {
      api_key: string;
      default_model: string;
      default_params: AIParams;
    }
  ) => {
    if (!user) return;

    const result = await upsertProviderSettings(user.user_id, provider, data);
    setProviderSettings({
      ...providerSettings,
      [provider]: result,
    });
  };

  const handleDeleteProvider = async (provider: Provider) => {
    if (!user) return;

    await deleteProviderSettings(user.user_id, provider);
    setProviderSettings({
      ...providerSettings,
      [provider]: null,
    });
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;

    if (!displayName.trim()) {
      alert('請輸入顯示名稱');
      return;
    }

    try {
      setSavingDisplayName(true);
      await updateDisplayName(user.user_id, displayName.trim());
      alert('✅ 顯示名稱更新成功！');
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleSavePassword = async () => {
    if (!user) return;

    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('請填寫所有密碼欄位');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('新密碼與確認密碼不一致');
      return;
    }

    if (newPassword.length < 6) {
      alert('密碼長度至少 6 個字元');
      return;
    }

    try {
      setSavingPassword(true);

      // Verify old password
      const userData = await getUserById(user.user_id);
      if (!userData) {
        throw new Error('找不到用戶資料');
      }

      const isValid = await verifyPassword(oldPassword, userData.password_hash);
      if (!isValid) {
        alert('舊密碼錯誤');
        return;
      }

      // Hash new password and update
      const newPasswordHash = await hashPassword(newPassword);
      await updatePassword(user.user_id, newPasswordHash);

      alert('✅ 密碼更新成功！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Failed to update password:', err);
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingPassword(false);
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              ← 返回主選單
            </button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">設定</h1>
            <p className="text-gray-600 dark:text-gray-400">
              管理 AI 供應商與帳號設定
            </p>
          </div>
        </div>

        {/* AI Provider Settings */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            AI 供應商設定
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            設定 API Key 與預設模型參數。這些是預設值，在建立故事時可以個別覆寫。
          </p>

          <div className="space-y-4">
            <ProviderCard
              provider="openrouter"
              providerName="OpenRouter"
              providerIcon="🔀"
              settings={providerSettings.openrouter}
              onSave={(data) => handleSaveProvider('openrouter', data)}
              onDelete={() => handleDeleteProvider('openrouter')}
            />

            <ProviderCard
              provider="gemini"
              providerName="Google Gemini"
              providerIcon="✨"
              settings={providerSettings.gemini}
              onSave={(data) => handleSaveProvider('gemini', data)}
              onDelete={() => handleDeleteProvider('gemini')}
            />

            <ProviderCard
              provider="openai"
              providerName="OpenAI"
              providerIcon="🤖"
              settings={providerSettings.openai}
              onSave={(data) => handleSaveProvider('openai', data)}
              onDelete={() => handleDeleteProvider('openai')}
            />
          </div>
        </div>

        {/* Account Management */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            帳號管理
          </h2>

          <div className="space-y-6">
            {/* Display Name */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                顯示名稱
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="您的顯示名稱"
                />
                <button
                  onClick={handleSaveDisplayName}
                  disabled={savingDisplayName}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {savingDisplayName ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                修改密碼
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    舊密碼
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    新密碼
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    確認新密碼
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {savingPassword ? '更新中...' : '更新密碼'}
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                帳號資訊
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">電子郵件：</span>
                  <span className="text-gray-900 dark:text-white">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">帳號狀態：</span>
                  <span className="text-green-600 dark:text-green-400">
                    {user?.status === 'active' ? '正常' : '停用'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">建立日期：</span>
                  <span className="text-gray-900 dark:text-white">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('zh-TW')
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsPageContent />
    </ProtectedRoute>
  );
}
