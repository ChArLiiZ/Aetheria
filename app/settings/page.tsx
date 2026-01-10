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
} from '@/services/supabase/provider-settings';
import { getUserById } from '@/services/supabase/users';
import {
  updateDisplayName,
  updatePassword,
} from '@/services/supabase/auth';
import { testProviderConnection } from '@/services/api/provider-test';
import { toast } from 'sonner';

// Model presets for each provider
const MODEL_PRESETS: Record<Provider, string[]> = {
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-haiku',
    'openai/gpt-4-turbo',
  ],
  openai: ['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
};

const PROVIDER_INFO: Record<
  Provider,
  { name: string; icon: string; description: string }
> = {
  openrouter: {
    name: 'OpenRouter',
    icon: '??',
    description: '統一多個 AI 模型的接入平台',
  },
  openai: {
    name: 'OpenAI',
    icon: '??',
    description: 'GPT 系列模型提供商',
  },
};

type MainTab = 'providers' | 'account';

function SettingsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Main tabs
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('providers');

  // Provider settings
  const [selectedProvider, setSelectedProvider] = useState<Provider>('openrouter');
  const [providerSettings, setProviderSettings] = useState<
    Record<Provider, ProviderSettings | null>
  >({
    openrouter: null,
    openai: null,
  });

  // Provider form
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [usePreset, setUsePreset] = useState(true);
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [topP, setTopP] = useState(1.0);
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);

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

  useEffect(() => {
    // Load selected provider settings into form
    const settings = providerSettings[selectedProvider];
    if (settings) {
      setApiKey(settings.api_key);
      setDefaultModel(settings.default_model);

      // Check if model is in presets
      const isPreset = MODEL_PRESETS[selectedProvider].includes(settings.default_model);
      setUsePreset(isPreset);
      if (!isPreset) {
        setCustomModel(settings.default_model);
      } else {
        setCustomModel('');
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
    } else {
      // Reset form for new provider
      setApiKey('');
      setDefaultModel('');
      setCustomModel('');
      setUsePreset(true);
      setTemperature(1.0);
      setMaxTokens(4000);
      setTopP(1.0);
    }
    setShowApiKey(false);
  }, [selectedProvider, providerSettings]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load provider settings
      const settings = await getProviderSettings(user.user_id);
      const settingsMap: Record<Provider, ProviderSettings | null> = {
        openrouter: null,
        openai: null,
      };

      settings.forEach((s) => {
        if (s.provider in settingsMap) {
          settingsMap[s.provider as Provider] = s;
        }
      });

      setProviderSettings(settingsMap);

      // Load user data
      const userData = await getUserById(user.user_id);
      if (userData) {
        setDisplayName(userData.display_name);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProvider = async () => {
    if (!user) return;

    if (!apiKey.trim()) {
      toast.warning('請輸入 API Key');
      return;
    }

    const model = usePreset ? defaultModel : customModel;
    if (!model.trim()) {
      toast.warning('請選擇或輸入模型名稱');
      return;
    }

    try {
      setSavingProvider(true);
      const result = await upsertProviderSettings(user.user_id, selectedProvider, {
        api_key: apiKey.trim(),
        default_model: model.trim(),
        default_params: {
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
        },
      });

      setProviderSettings({
        ...providerSettings,
        [selectedProvider]: result,
      });

      toast.success('儲存成功！');
    } catch (err: any) {
      console.error('Failed to save:', err);
      toast.error(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingProvider(false);
    }
  };

  const handleDeleteProvider = async () => {
    if (!user) return;

    const providerName = PROVIDER_INFO[selectedProvider].name;
    if (!confirm(`確定要刪除 ${providerName} 的設定嗎？`)) {
      return;
    }

    try {
      await deleteProviderSettings(user.user_id, selectedProvider);
      setProviderSettings({
        ...providerSettings,
        [selectedProvider]: null,
      });
      toast.success('刪除成功！');
    } catch (err: any) {
      console.error('Failed to delete:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleTestProvider = async () => {
    if (!apiKey.trim()) {
      toast.warning('請先輸入 API Key');
      return;
    }

    const model = usePreset ? defaultModel : customModel;
    if (!model.trim()) {
      toast.warning('請先選擇或輸入模型名稱');
      return;
    }

    try {
      setTestingProvider(true);

      // Test actual API connection
      const result = await testProviderConnection(selectedProvider, apiKey.trim(), model.trim());

      if (result.success) {
        toast.success(result.message, {
          description: `${result.details}\n\n注意：這是基本連接測試，實際使用時可能還會遇到其他問題。`,
        });
      } else {
        toast.error(result.message, {
          description: `${result.details}\n\n請檢查：API Key 是否正確、模型名稱是否正確、API Key 是否有足夠的額度`,
        });
      }
    } catch (err: any) {
      console.error('Test failed:', err);
      toast.error(`測試失敗: ${err.message || '未知錯誤'}`, {
        description: '請檢查網路連接和 API Key。',
      });
    } finally {
      setTestingProvider(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;

    if (!displayName.trim()) {
      toast.warning('請輸入顯示名稱');
      return;
    }

    try {
      setSavingDisplayName(true);
      const result = await updateDisplayName(user.user_id, displayName.trim());

      if (!result.success) {
        toast.error(`更新失敗: ${result.error || '未知錯誤'}`);
        return;
      }

      toast.success('顯示名稱更新成功！');
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      toast.error(`更新失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleSavePassword = async () => {
    if (!user) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.warning('請填寫所有密碼欄位');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.warning('新密碼與確認密碼不一致');
      return;
    }

    if (newPassword.length < 6) {
      toast.warning('密碼長度至少 6 個字元');
      return;
    }

    try {
      setSavingPassword(true);

      const result = await updatePassword(user.user_id, oldPassword, newPassword);

      if (!result.success) {
        toast.error(`更新失敗: ${result.error || '未知錯誤'}`);
        return;
      }

      toast.success('密碼更新成功！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Failed to update password:', err);
      toast.error(`更新失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingPassword(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '***';
    return `${key.slice(0, 4)}***...***${key.slice(-4)}`;
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

  const currentSettings = providerSettings[selectedProvider];
  const hasSettings = currentSettings && currentSettings.api_key;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
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
            <p className="text-gray-600 dark:text-gray-400">管理 AI 供應商與帳號設定</p>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveMainTab('providers')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${activeMainTab === 'providers'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              🤖 AI 供應商
            </button>
            <button
              onClick={() => setActiveMainTab('account')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${activeMainTab === 'account'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              👤 帳號管理
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeMainTab === 'providers' ? (
          <div className="flex gap-6">
            {/* Left Sidebar - Provider List */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">供應商列表</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => {
                    const info = PROVIDER_INFO[provider];
                    const settings = providerSettings[provider];
                    const isActive = selectedProvider === provider;

                    return (
                      <button
                        key={provider}
                        onClick={() => setSelectedProvider(provider)}
                        className={`w-full px-4 py-3 text-left transition ${isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {info.name}
                            </div>
                            {settings && settings.api_key && (
                              <div className="text-xs text-green-600 dark:text-green-400">
                                ✓ 已設定
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  💡 提示：這些是預設設定，在建立故事時可以個別覆寫模型和參數。
                </p>
              </div>
            </div>

            {/* Right Panel - Provider Settings */}
            <div className="flex-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{PROVIDER_INFO[selectedProvider].icon}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {PROVIDER_INFO[selectedProvider].name}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {PROVIDER_INFO[selectedProvider].description}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
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
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                        >
                          {showApiKey ? '隱藏' : '顯示'}
                        </button>
                      )}
                    </div>
                    {hasSettings && !showApiKey && (
                      <p className="mt-1 text-xs text-gray-500">
                        目前：{maskApiKey(currentSettings.api_key)}
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
                          {MODEL_PRESETS[selectedProvider].map((model) => (
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
                        <label className="text-sm text-gray-700 dark:text-gray-300">Top P</label>
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
                      onClick={handleTestProvider}
                      disabled={testingProvider}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:bg-gray-400"
                    >
                      {testingProvider ? '測試中...' : '🧪 測試連接'}
                    </button>
                    <button
                      onClick={handleSaveProvider}
                      disabled={savingProvider}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                    >
                      {savingProvider ? '儲存中...' : '💾 儲存設定'}
                    </button>
                    {hasSettings && (
                      <button
                        onClick={handleDeleteProvider}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        🗑️ 刪除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Account Management Tab */
          <div className="max-w-3xl">
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
        )}
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

