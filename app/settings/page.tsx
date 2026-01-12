'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { ProviderSettings, AIParams } from '@/types';
import {
  getProviderSettings,
  upsertProviderSettings,
  deleteProviderSettings,
} from '@/services/supabase/provider-settings';
import { getUserById } from '@/services/supabase/users';
import {
  updateDisplayName,
  updatePassword,
} from '@/services/supabase/auth';
import { testProviderConnection } from '@/services/api/provider-test';
import { toast } from 'sonner';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Trash2, FlaskConical, Eye, EyeOff, Key, User, Server } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MODEL_PRESETS, PROVIDER_INFO, Provider, PROVIDERS } from '@/lib/ai-providers';

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
  const [usePreset, setUsePreset] = useState<"preset" | "custom">("preset");
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [topP, setTopP] = useState(1.0);
  const [defaultContextTurns, setDefaultContextTurns] = useState(5);
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
      setUsePreset(isPreset ? "preset" : "custom");
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
      // Load context turns
      setDefaultContextTurns(settings.default_context_turns ?? 5);
    } else {
      // Reset form for new provider
      setApiKey('');
      setDefaultModel('');
      setCustomModel('');
      setUsePreset("preset");
      setTemperature(1.0);
      setMaxTokens(4000);
      setTopP(1.0);
      setDefaultContextTurns(5);
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

    const model = usePreset === "preset" ? defaultModel : customModel;
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
    const isConfirmed = confirm(`確定要刪除 ${providerName} 的設定嗎？`); // Using confirm for simplicity for now
    if (!isConfirmed) return;

    try {
      await deleteProviderSettings(user.user_id, selectedProvider);
      setProviderSettings({
        ...providerSettings,
        [selectedProvider]: null,
      });
      toast.success('刪除成功！');
      // Reset form
      setApiKey('');
      setDefaultModel('');
      setCustomModel('');
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

    const model = usePreset === "preset" ? defaultModel : customModel;
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
          description: result.details ? `${result.details}\n\n注意：這是基本連接測試，實際使用時可能還會遇到其他問題。` : undefined,
        });
      } else {
        toast.error(result.message, {
          description: `${result.details || ''}\n\n請檢查：API Key 是否正確、模型名稱是否正確、API Key 是否有足夠的額度`,
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
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  const currentSettings = providerSettings[selectedProvider];
  const hasSettings = currentSettings && currentSettings.api_key;

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">設定</h1>
          <p className="text-muted-foreground">管理 AI 供應商與帳號設定</p>
        </div>

        <Tabs value={activeMainTab} onValueChange={(val) => setActiveMainTab(val as MainTab)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Server className="h-4 w-4" /> AI 供應商
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" /> 帳號管理
            </TabsTrigger>
          </TabsList>

          {/* AI Providers Tab */}
          <TabsContent value="providers" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Left Sidebar - Provider List */}
              <Card className="md:col-span-1 h-fit">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base">供應商列表</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-col">
                    {(Object.keys(PROVIDER_INFO) as Provider[]).map((provider) => {
                      const info = PROVIDER_INFO[provider];
                      const settings = providerSettings[provider];
                      const isActive = selectedProvider === provider;

                      return (
                        <button
                          key={provider}
                          onClick={() => setSelectedProvider(provider)}
                          className={`flex items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${isActive ? 'bg-muted border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                            }`}
                        >

                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{info.name}</div>
                            {settings && settings.api_key && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ 已設定</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-muted/20 border-t">
                  <p className="text-xs text-muted-foreground">
                    提示：這些是預設設定，在建立故事時可以個別覆寫模型和參數。
                  </p>
                </CardFooter>
              </Card>

              {/* Right Panel - Provider Settings */}
              <Card className="md:col-span-3">
                <CardHeader>
                  <div className="flex items-center gap-3">

                    <div>
                      <CardTitle>{PROVIDER_INFO[selectedProvider].name}</CardTitle>
                      <CardDescription>{PROVIDER_INFO[selectedProvider].description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* API Key */}
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key *</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="apiKey"
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="輸入您的 API Key"
                          className="font-mono pr-10"
                        />
                      </div>
                      <Button variant="outline" type="button" onClick={() => setShowApiKey(!showApiKey)}>
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {hasSettings && !showApiKey && (
                      <p className="text-xs text-muted-foreground">
                        目前：{maskApiKey(currentSettings.api_key)}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Model Selection */}
                  <div className="space-y-4">
                    <Label>預設模型 *</Label>
                    <RadioGroup value={usePreset} onValueChange={(val: "preset" | "custom") => setUsePreset(val)} className="flex items-center gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="preset" id="opt-preset" />
                        <Label htmlFor="opt-preset" className="cursor-pointer font-normal">選擇常用模型</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="opt-custom" />
                        <Label htmlFor="opt-custom" className="cursor-pointer font-normal">手動輸入</Label>
                      </div>
                    </RadioGroup>

                    {usePreset === "preset" ? (
                      <Select value={defaultModel} onValueChange={setDefaultModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="請選擇模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_PRESETS[selectedProvider].map((model) => (
                            <SelectItem key={model} value={model}>{model}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        placeholder="例如：anthropic/claude-3.5-sonnet"
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Parameters */}
                  <div className="space-y-6">
                    <h4 className="text-sm font-medium">預設參數</h4>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Temperature (隨機性): {temperature}</Label>
                        <span className="text-xs text-muted-foreground">0 = 確定性，2 = 最隨機</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Max Tokens (長度): {maxTokens}</Label>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={128000}
                        step={100}
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Top P (取樣): {topP}</Label>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={topP}
                        onChange={(e) => setTopP(parseFloat(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>預設上下文回合數: {defaultContextTurns}</Label>
                        <span className="text-xs text-muted-foreground">每次 AI 呼叫包含的歷史回合數</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={defaultContextTurns}
                        onChange={(e) => setDefaultContextTurns(parseInt(e.target.value) || 5)}
                        className="w-24 px-3 py-1 border rounded-md text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        ⚠️ 回合數越多，token 消耗越高，費用也會增加
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleTestProvider} disabled={testingProvider}>
                      {testingProvider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                      測試連接
                    </Button>
                    {hasSettings && (
                      <Button variant="destructive" onClick={handleDeleteProvider}>
                        <Trash2 className="mr-2 h-4 w-4" /> 刪除
                      </Button>
                    )}
                  </div>
                  <Button onClick={handleSaveProvider} disabled={savingProvider}>
                    {savingProvider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    儲存設定
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6 max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>個人資料</CardTitle>
                <CardDescription>管理您的顯示名稱與基本資訊</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">顯示名稱</Label>
                  <div className="flex gap-2">
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="您的顯示名稱"
                    />
                    <Button onClick={handleSaveDisplayName} disabled={savingDisplayName}>
                      {savingDisplayName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '儲存'}
                    </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">電子郵件</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">帳號狀態</p>
                    <Badge variant={user?.status === 'active' ? 'default' : 'destructive'}>
                      {user?.status === 'active' ? '正常' : '停用'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">建立日期</p>
                    <p className="font-medium" suppressHydrationWarning>{user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-TW') : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>安全設定</CardTitle>
                <CardDescription>更新您的密碼</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPass">舊密碼</Label>
                  <Input id="oldPass" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPass">新密碼</Label>
                    <Input id="newPass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">確認新密碼</Label>
                    <Input id="confirmPass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSavePassword} disabled={savingPassword} className="w-full sm:w-auto">
                  {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                  更新密碼
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsPageContent />
    </ProtectedRoute>
  );
}
