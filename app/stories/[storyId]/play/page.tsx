'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ReactMarkdown from 'react-markdown';
import {
  Story,
  StoryTurn,
  ProviderSettings,
  StoryCharacter,
  Character,
  StoryStateValue,
  WorldStateSchema,
} from '@/types';
import { getStoryById, updateStory } from '@/services/supabase/stories';
import { getStoryTurns } from '@/services/supabase/story-turns';
import { getProviderSetting } from '@/services/supabase/provider-settings';
import { executeTurn } from '@/services/gameplay/execute-turn';
import { rollbackStoryToTurn } from '@/services/gameplay/rollback-turns';
import { resetStory } from '@/services/supabase/story-reset';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharacterById } from '@/services/supabase/characters';
import { getAllStateValuesForStory } from '@/services/supabase/story-state-values';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { checkStoryUpdates, type StoryUpdateCheck } from '@/services/supabase/check-story-updates';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, ArrowLeft, BookOpen, Bot, AlertCircle, Settings, Lightbulb, RotateCcw, AlertTriangle, FileEdit, Globe, RefreshCw, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MODEL_PRESETS, PROVIDER_INFO, Provider, PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODELS } from '@/lib/ai-providers';
import { WorldDetailsDialog } from '@/components/world-details-dialog';
import { CharacterDetailsDialog } from '@/components/character-details-dialog';
import { StoryUpdateAlert } from '@/components/story-update-alert';

// 預設上下文回合數
const DEFAULT_CONTEXT_TURNS = 5;

function StoryPlayPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const storyId = params.storyId as string;

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [turns, setTurns] = useState<StoryTurn[]>([]);
  const [userInput, setUserInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingTurnIndex, setDeletingTurnIndex] = useState<number | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);

  // UX 改進：即時反饋狀態
  const [pendingUserInput, setPendingUserInput] = useState<string | null>(null);

  // Suggestion 功能
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Character states
  const [storyCharacters, setStoryCharacters] = useState<StoryCharacter[]>([]);
  const [characters, setCharacters] = useState<Map<string, Character>>(new Map());
  const [stateValues, setStateValues] = useState<StoryStateValue[]>([]);
  const [worldSchema, setWorldSchema] = useState<WorldStateSchema[]>([]);
  const [showStatePanel, setShowStatePanel] = useState(false);

  // Settings panel
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [tempProvider, setTempProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [tempUsePreset, setTempUsePreset] = useState<'preset' | 'custom'>('preset');
  const [tempModel, setTempModel] = useState<string>('');
  const [tempCustomModel, setTempCustomModel] = useState<string>('');
  const [tempTemperature, setTempTemperature] = useState<number>(0.7);
  const [tempContextTurns, setTempContextTurns] = useState<number>(DEFAULT_CONTEXT_TURNS);
  const [savingSettings, setSavingSettings] = useState(false);

  // Reset story
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Details Dialogs
  const [viewingWorldId, setViewingWorldId] = useState<string | null>(null);
  const [viewingCharacterId, setViewingCharacterId] = useState<string | null>(null);

  // Story update check
  const [updateInfo, setUpdateInfo] = useState<StoryUpdateCheck | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // 載入故事資料
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [storyData, turnsData, settings] = await Promise.all([
          getStoryById(storyId, user.user_id),
          getStoryTurns(storyId, user.user_id),
          getProviderSetting(user.user_id, 'openrouter'),
        ]);

        if (cancelled) return;

        if (!storyData) {
          toast.error('故事不存在');
          router.push('/stories');
          return;
        }

        if (!settings) {
          toast.warning('請先到設定頁面設定 AI 提供商');
          router.push('/settings');
          return;
        }

        setStory(storyData);
        setTurns(turnsData);
        setProviderSettings(settings);

        // Initialize settings - 從現有模型名稱推斷供應商
        const existingModel = storyData.model_override || settings.default_model || DEFAULT_MODELS[DEFAULT_PROVIDER];
        const inferredProvider = existingModel.includes('/') ? 'openrouter' as Provider : 'openai' as Provider;
        setTempProvider(inferredProvider);

        // 檢查是否為預設模型
        const isPreset = MODEL_PRESETS[inferredProvider].includes(existingModel);
        setTempUsePreset(isPreset ? 'preset' : 'custom');
        if (isPreset) {
          setTempModel(existingModel);
        } else {
          setTempModel(MODEL_PRESETS[inferredProvider][0] || '');
          setTempCustomModel(existingModel);
        }

        const params = storyData.params_override_json
          ? JSON.parse(storyData.params_override_json)
          : JSON.parse(settings.default_params_json || '{}');
        setTempTemperature(params.temperature ?? 0.7);
        setTempContextTurns(storyData.context_turns_override ?? settings.default_context_turns ?? DEFAULT_CONTEXT_TURNS);

        // Load character states
        await loadCharacterStatesInternal(storyData.world_id, cancelled);

        // Check for updates (non-blocking)
        if (!sessionStorage.getItem(`story-update-dismissed-${storyId}`)) {
          checkStoryUpdates(storyId, user.user_id)
            .then((info) => {
              if (!cancelled && info.hasUpdates) {
                setUpdateInfo(info);
              }
            })
            .catch((err) => {
              console.error('[loadData] Failed to check story updates:', err);
            });
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load story:', err);
        toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id, storyId]);

  const loadCharacterStatesInternal = async (worldId: string, cancelled: boolean) => {
    if (!user) return;

    try {
      const [storyChars, states, schema] = await Promise.all([
        getStoryCharacters(storyId, user.user_id),
        getAllStateValuesForStory(storyId, user.user_id),
        getSchemaByWorldId(worldId, user.user_id),
      ]);

      if (cancelled) return;

      setStoryCharacters(storyChars);
      setStateValues(states);
      setWorldSchema(schema);

      const charDetails = await Promise.all(
        storyChars.map((sc) => getCharacterById(sc.character_id, user.user_id))
      );

      if (cancelled) return;

      const charMap = new Map<string, Character>();
      charDetails.forEach((char, index) => {
        if (char) {
          charMap.set(storyChars[index].story_character_id, char);
        }
      });
      setCharacters(charMap);
    } catch (err: any) {
      if (cancelled) return;
      console.error('Failed to load character states:', err);
    }
  };

  const loadCharacterStates = async (worldId: string) => {
    return loadCharacterStatesInternal(worldId, false);
  };

  // Auto-scroll to bottom (也在初次載入完成時滾動)
  useEffect(() => {
    if (!loading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, turns, pendingUserInput, submitError]);

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  const handleDeleteFromTurn = async (turnIndex: number) => {
    if (!user || !story || deletingTurnIndex !== null || submitting) return;

    if (!confirm(`確定要刪除回合 ${turnIndex} 及其後所有內容嗎？\n\n此操作將回溯角色狀態，且無法復原。`)) {
      return;
    }

    try {
      setDeletingTurnIndex(turnIndex);
      const remainingTurns = await rollbackStoryToTurn(storyId, turnIndex, user.user_id);
      const newTurnCount = remainingTurns.length > 0
        ? Math.max(...remainingTurns.map((turn) => turn.turn_index))
        : 0;

      setTurns(remainingTurns);
      setStory({ ...story, turn_count: newTurnCount });
      await loadCharacterStates(story.world_id);
    } catch (err: any) {
      console.error('Failed to rollback story:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setDeletingTurnIndex(null);
    }
  };

  const handleRegenerate = async (turnIndex: number, previousInput: string) => {
    if (!user || !story || !providerSettings || submitting || deletingTurnIndex !== null) return;

    try {
      setSubmitError(null); // 清除先前的錯誤訊息
      setSubmitting(true);
      setPendingUserInput(previousInput);
      setUserInput(''); // Clear any current input

      // 1. Rollback to remove the current turn
      const remainingTurns = await rollbackStoryToTurn(storyId, turnIndex, user.user_id);

      // 2. Update local state to reflect rollback
      const rolledBackTurnCount = remainingTurns.length > 0
        ? Math.max(...remainingTurns.map((turn) => turn.turn_index))
        : 0;
      setTurns(remainingTurns);
      setStory({ ...story, turn_count: rolledBackTurnCount });

      // 3. Re-execute the turn with the same input
      const selectedModel = tempUsePreset === 'preset' ? tempModel : tempCustomModel;
      const result = await executeTurn({
        story: { ...story, turn_count: rolledBackTurnCount }, // Use updated turn count
        userInput: previousInput,
        userId: user.user_id,
        apiKey: providerSettings.api_key,
        model: selectedModel,
        params: {
          temperature: tempTemperature,
        },
        contextTurns: tempContextTurns,
      });

      // 4. Update state with new turn
      setPendingUserInput(null);
      setTurns([...remainingTurns, result.turn]);
      setStory({ ...story, turn_count: result.turn.turn_index });
      await loadCharacterStates(story.world_id);

    } catch (err: any) {
      console.error('Failed to regenerate:', err);
      setSubmitError(err.message || '重新產生失敗');
      // 注意：不要在這裡呼叫 setPendingUserInput(null)
      // 錯誤 UI 區塊依賴 pendingUserInput 為真值才會顯示
      // 使用者需要看到「編輯後重試」、「重試」、「取消」等選項
      // Reload both turns and character states to ensure consistency after rollback
      // 將恢復操作包在 try-catch 中，避免恢復失敗時產生未處理的 Promise 拒絕
      try {
        const turnsData = await getStoryTurns(storyId, user.user_id);
        setTurns(turnsData);
        await loadCharacterStates(story.world_id);
      } catch (recoveryErr) {
        console.error('Failed to recover state after regeneration error:', recoveryErr);
        // 恢復失敗時不再拋出錯誤，主要錯誤訊息已經顯示給使用者
      }
      toast.error(`重新產生失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!userInput.trim() || submitting || !user || !story || !providerSettings) return;

    const input = userInput.trim();

    try {
      setPendingUserInput(input);
      setSubmitError(null);
      setSubmitting(true);
      setUserInput('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      const selectedModel = tempUsePreset === 'preset' ? tempModel : tempCustomModel;
      const result = await executeTurn({
        story,
        userInput: input,
        userId: user.user_id,
        apiKey: providerSettings.api_key,
        model: selectedModel,
        params: {
          temperature: tempTemperature,
        },
        contextTurns: tempContextTurns,
      });

      setPendingUserInput(null);
      setTurns([...turns, result.turn]);
      setStory({ ...story, turn_count: result.turn.turn_index });
      await loadCharacterStates(story.world_id);
    } catch (err: any) {
      console.error('Failed to submit:', err);
      setSubmitError(err.message || '提交失敗，請稍後再試');
      toast.error(`提交失敗: ${err.message || '未知錯誤'}`, {
        description: '請檢查 AI 設定是否正確。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!user || !story || !providerSettings || loadingSuggestions) return;

    try {
      setLoadingSuggestions(true);
      setSuggestions([]);

      // 動態 import 來避免循環依賴
      const { callSuggestionAgent } = await import('@/services/agents/suggestion-agent');
      const { getStoryCharacters } = await import('@/services/supabase/story-characters');
      const { getCharacterById } = await import('@/services/supabase/characters');
      const { getWorldById } = await import('@/services/supabase/worlds');
      const { getAllStateValuesForStory } = await import('@/services/supabase/story-state-values');
      const { getLatestSummaryForTurn } = await import('@/services/supabase/story-summaries');

      // 取得必要資料
      const [world, storyChars, stateValues, latestSummary] = await Promise.all([
        getWorldById(story.world_id, user.user_id),
        getStoryCharacters(storyId, user.user_id),
        getAllStateValuesForStory(storyId, user.user_id),
        getLatestSummaryForTurn(storyId, turns.length + 1, user.user_id),
      ]);

      if (!world) throw new Error('World not found');

      // 取得角色詳情
      const charDetails = await Promise.all(
        storyChars.map((sc) => getCharacterById(sc.character_id, user.user_id))
      );

      // 建構角色上下文
      const characterContexts = storyChars.map((sc, index) => {
        const char = charDetails[index];
        const charStates = stateValues.filter(
          (sv) => sv.story_character_id === sc.story_character_id
        );
        const stateSummary = charStates
          .map((sv) => {
            const schema = worldSchema.find((s) => s.schema_key === sv.schema_key);
            if (!schema) return '';
            try {
              const value = JSON.parse(sv.value_json);
              return `${schema.display_name}: ${JSON.stringify(value)}`;
            } catch {
              return '';
            }
          })
          .filter(Boolean)
          .join(', ');

        return {
          story_character_id: sc.story_character_id,
          display_name: sc.display_name_override || char?.canonical_name || 'Unknown',
          core_profile: char?.core_profile_text || '',
          current_state_summary: stateSummary || 'No state set',
          is_player: sc.is_player,
        };
      });

      // 建構最近回合上下文
      const recentTurnContexts = turns.slice(-tempContextTurns).map((turn) => ({
        turn_index: turn.turn_index,
        user_input: turn.user_input_text,
        narrative: turn.narrative_text,
      }));

      const selectedModel = tempUsePreset === 'preset' ? tempModel : tempCustomModel;

      const result = await callSuggestionAgent(
        providerSettings.api_key,
        selectedModel,
        {
          story_mode: story.story_mode,
          world_rules: world.rules_text,
          story_prompt: story.story_prompt,
          characters: characterContexts,
          recent_turns: recentTurnContexts,
          story_summary: latestSummary?.summary_text,
        },
        { temperature: 0.8 }
      );

      setSuggestions(result.suggestions);
    } catch (err: any) {
      console.error('Failed to generate suggestions:', err);
      toast.error(`生成建議失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setUserInput(suggestion);
    setSuggestions([]);
    // 聚焦到輸入框
    textareaRef.current?.focus();
  };

  const handleSaveSettings = async () => {
    if (!user || !story) return;

    try {
      setSavingSettings(true);
      const selectedModel = tempUsePreset === 'preset' ? tempModel : tempCustomModel;
      await updateStory(story.story_id, user.user_id, {
        model_override: selectedModel,
        params_override_json: JSON.stringify({
          temperature: tempTemperature,
        }),
        context_turns_override: tempContextTurns,
      });
      setStory({
        ...story,
        model_override: selectedModel,
        params_override_json: JSON.stringify({
          temperature: tempTemperature,
        }),
        context_turns_override: tempContextTurns,
      });
      toast.success('設定已儲存');
      setShowSettingsPanel(false);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      toast.error(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetStory = async () => {
    if (!user || !story) return;

    try {
      setResetting(true);
      await resetStory(storyId, user.user_id);
      toast.success('故事已重新開始！');
      setShowResetDialog(false);

      // Reload all data
      const [storyData, turnsData, stateValuesData] = await Promise.all([
        getStoryById(storyId, user.user_id),
        getStoryTurns(storyId, user.user_id),
        getAllStateValuesForStory(storyId, user.user_id),
      ]);

      if (storyData) {
        setStory(storyData);
        setTurns(turnsData);
        setStateValues(stateValuesData);
        setPendingUserInput(null);
        setUserInput('');
        setSuggestions([]);
        // Clear update info after reset and allow future update checks
        setUpdateInfo(null);
        setUpdateDismissed(false);
        sessionStorage.removeItem(`story-update-dismissed-${storyId}`);
      }
    } catch (err: any) {
      console.error('Failed to reset story:', err);
      toast.error(`重置失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setResetting(false);
    }
  };

  // Handle dismiss update alert
  const handleDismissUpdate = () => {
    setUpdateDismissed(true);
    setUpdateInfo(null);
    sessionStorage.setItem(`story-update-dismissed-${storyId}`, 'true');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!story) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex-none border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 px-4 py-3 sticky top-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Button variant="ghost" size="icon" onClick={() => router.push('/stories')} title="返回列表">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate leading-tight">
                {story.title}
              </h1>
              <div className="flex items-center text-xs text-muted-foreground mt-0.5 space-x-2">
                <span>回合 {turns.length}</span>
                <span>•</span>
                <span>{story.story_mode === 'PLAYER_CHARACTER' ? '玩家角色' : '導演模式'}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {/* World Details Button */}
            <Button
              variant="outline"
              size="icon"
              title="查看世界觀設定"
              onClick={() => setViewingWorldId(story.world_id)}
            >
              <Globe className="h-4 w-4" />
            </Button>

            {/* Edit Story Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/stories/${storyId}`)}
              title="編輯故事設定"
            >
              <FileEdit className="h-4 w-4" />
            </Button>

            {/* Reset Story Button */}
            {turns.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowResetDialog(true)}
                disabled={resetting}
                title="重新開始故事"
                className="text-orange-600 hover:text-orange-600 hover:bg-orange-600/10 border-orange-600/30"
              >
                {resetting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Settings Button */}
            <Sheet open={showSettingsPanel} onOpenChange={setShowSettingsPanel}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" title="設定">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 h-[100dvh]">
                <div className="p-6 pb-2 shrink-0">
                  <SheetHeader>
                    <SheetTitle>遊戲設定</SheetTitle>
                    <SheetDescription>調整 AI 模型和參數</SheetDescription>
                  </SheetHeader>
                </div>
                <ScrollArea className="flex-1 w-full">
                  <div className="p-6 pt-0 space-y-6">
                    {/* Provider */}
                    <div className="space-y-2">
                      <Label>API 供應商</Label>
                      <Select value={tempProvider} onValueChange={(v) => {
                        setTempProvider(v as Provider);
                        setTempModel(MODEL_PRESETS[v as Provider][0] || '');
                        setTempCustomModel('');
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇供應商" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PROVIDER_INFO[p].name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-3">
                      <Label>模型名稱</Label>
                      <RadioGroup value={tempUsePreset} onValueChange={(v: 'preset' | 'custom') => setTempUsePreset(v)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="preset" id="opt-preset" />
                          <Label htmlFor="opt-preset" className="cursor-pointer font-normal">選擇常用</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="opt-custom" />
                          <Label htmlFor="opt-custom" className="cursor-pointer font-normal">手動輸入</Label>
                        </div>
                      </RadioGroup>

                      {tempUsePreset === 'preset' ? (
                        <Select value={tempModel} onValueChange={setTempModel}>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇模型" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODEL_PRESETS[tempProvider].map((model) => (
                              <SelectItem key={model} value={model}>{model}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={tempCustomModel}
                          onChange={(e) => setTempCustomModel(e.target.value)}
                          placeholder="例如：anthropic/claude-3.5-sonnet"
                        />
                      )}
                    </div>

                    {/* Temperature */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Temperature（創意程度）</Label>
                        <span className="text-sm text-muted-foreground">{tempTemperature.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[tempTemperature]}
                        onValueChange={([v]: number[]) => setTempTemperature(v)}
                        min={0}
                        max={2}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">0 = 保守穩定，2 = 創意多變</p>
                    </div>

                    {/* Context Turns */}
                    <div className="space-y-2">
                      <Label>上下文回合數</Label>
                      <Input
                        type="number"
                        value={tempContextTurns}
                        onChange={(e) => setTempContextTurns(parseInt(e.target.value) || 5)}
                        min={1}
                        max={50}
                      />
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          回合數越多，每次 AI 呼叫的 token 消耗越高，費用也會增加。
                        </AlertDescription>
                      </Alert>
                    </div>

                    <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full">
                      {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      儲存設定
                    </Button>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {/* State Panel */}
            <Sheet open={showStatePanel} onOpenChange={setShowStatePanel}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 px-4 shadow-sm">
                  <BookOpen className="h-4 w-4" />
                  <span>狀態</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 h-[100dvh]">
                <div className="p-6 pb-2 shrink-0">
                  <SheetHeader>
                    <SheetTitle>角色狀態</SheetTitle>
                  </SheetHeader>
                </div>
                <ScrollArea className="flex-1 w-full">
                  <div className="p-6 pt-0 space-y-4">
                    {[...storyCharacters]
                      .sort((a, b) => (b.is_player ? 1 : 0) - (a.is_player ? 1 : 0))
                      .map((sc) => {
                        const char = characters.get(sc.story_character_id);
                        if (!char) return null;
                        const charStates = stateValues.filter(
                          (sv) => sv.story_character_id === sc.story_character_id
                        );

                        return (
                          <Card key={sc.story_character_id} className="overflow-hidden">
                            {/* 角色頭部區域：圖片 + 名稱 */}
                            <CardHeader className="p-4 pb-3">
                              <div className="flex items-center gap-4">
                                {/* 角色頭像 */}
                                <button
                                  className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                                  onClick={() => setViewingCharacterId(sc.character_id)}
                                >
                                  {char.image_url ? (
                                    <img
                                      src={char.image_url}
                                      alt={sc.display_name_override || char.canonical_name}
                                      className="w-14 h-14 rounded-full object-cover border-2 border-muted hover:border-primary transition-colors"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-muted hover:border-primary transition-colors">
                                      <User className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </button>
                                {/* 名稱區域 */}
                                <div className="flex-1 min-w-0">
                                  <button
                                    className="text-lg font-bold hover:text-primary transition-colors focus:outline-none truncate block"
                                    onClick={() => setViewingCharacterId(sc.character_id)}
                                  >
                                    {sc.display_name_override || char.canonical_name}
                                  </button>
                                  {sc.is_player && (
                                    <Badge variant="secondary" className="text-[10px] h-5 mt-1">
                                      玩家角色
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              {charStates.length > 0 ? (
                                <div className="space-y-2 text-sm">
                                  {charStates
                                    .sort((a, b) => {
                                      const schemaA = worldSchema.find(s => s.schema_key === a.schema_key);
                                      const schemaB = worldSchema.find(s => s.schema_key === b.schema_key);
                                      return (schemaA?.sort_order ?? 999) - (schemaB?.sort_order ?? 999);
                                    })
                                    .map((sv) => {
                                      const schema = worldSchema.find((s) => s.schema_key === sv.schema_key);
                                      if (!schema) return null;

                                      let displayValue;
                                      let isLongText = false;
                                      try {
                                        const value = JSON.parse(sv.value_json);
                                        if (schema.type === 'list_text') {
                                          displayValue = Array.isArray(value) ? value.join(', ') : value;
                                          isLongText = true;
                                        } else if (typeof value === 'boolean') {
                                          displayValue = value ? '是' : '否';
                                        } else if (schema.type === 'text') {
                                          displayValue = String(value);
                                          isLongText = String(value).length > 20;
                                        } else {
                                          displayValue = String(value);
                                        }
                                      } catch {
                                        displayValue = sv.value_json;
                                      }

                                      let unit = '';
                                      let maxVal: number | undefined = undefined;
                                      let minVal: number | undefined = undefined;
                                      let numericValue: number | undefined = undefined;

                                      if (schema.type === 'number') {
                                        if (schema.number_constraints_json) {
                                          try {
                                            const constraints = JSON.parse(schema.number_constraints_json);
                                            unit = constraints.unit || '';

                                            if (constraints.max !== undefined && constraints.max !== null && constraints.max !== '') {
                                              const m = Number(constraints.max);
                                              if (!isNaN(m)) maxVal = m;
                                            }

                                            if (constraints.min !== undefined && constraints.min !== null && constraints.min !== '') {
                                              const m = Number(constraints.min);
                                              if (!isNaN(m)) minVal = m;
                                            }
                                          } catch { }
                                        }
                                        try {
                                          const v = JSON.parse(sv.value_json);
                                          const n = Number(v);
                                          if (!isNaN(n) && v !== null && v !== '') {
                                            numericValue = n;
                                          }
                                        } catch { }
                                      }

                                      return (
                                        <div key={sv.schema_key} className="border-b last:border-0 py-2 border-muted overflow-hidden">
                                          <div className={cn(
                                            "flex gap-3",
                                            isLongText ? "flex-col" : "items-center justify-between"
                                          )}>
                                            <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                                              {schema.display_name}
                                            </span>
                                            <span className={cn(
                                              "font-medium whitespace-pre-wrap break-words",
                                              isLongText ? "text-foreground leading-relaxed" : "text-right"
                                            )}>
                                              {displayValue}{unit && ` ${unit}`}
                                            </span>
                                          </div>
                                          {maxVal !== undefined && numericValue !== undefined && (maxVal - (minVal || 0) > 0) && (
                                            <div className="mt-1.5 flex items-center gap-2">
                                              <Progress
                                                value={Math.min(100, Math.max(0, ((numericValue - (minVal || 0)) / (maxVal - (minVal || 0))) * 100))}
                                                className="h-1.5"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">尚無狀態</span>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content (Chat) */}
      <ScrollArea className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {/* Story Update Alert */}
          {updateInfo && updateInfo.hasUpdates && !updateDismissed && (
            <StoryUpdateAlert
              updateInfo={updateInfo}
              onReset={() => setShowResetDialog(true)}
              onDismiss={handleDismissUpdate}
            />
          )}

          {/* Story Premise */}
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="p-4 md:p-6 flex gap-4">
              <div className="shrink-0 mt-1">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">故事開始</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{story.premise_text}</p>
              </div>
            </CardContent>
          </Card>

          {/* Turns */}
          {turns.map((turn, index) => (
            <div key={turn.turn_id} className="space-y-6">
              {/* User Input */}
              <div className="flex justify-end pl-12">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-full md:max-w-[85%] shadow-sm">
                  <p className="whitespace-pre-wrap leading-relaxed">{turn.user_input_text}</p>
                </div>
              </div>

              {/* AI-Response */}
              <div className="flex gap-4 pr-4">
                <div className="shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">回合 {turn.turn_index}</span>
                    <div className="flex items-center gap-2">
                      {index === turns.length - 1 && ( // Note: 'questions' isn't available here, using turns.length check is fine. 'index' comes from map.
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={() => handleRegenerate(turn.turn_index, turn.user_input_text)}
                          disabled={submitting || deletingTurnIndex !== null}
                          title="重新產生 (刪除此回應並重試)"
                        >
                          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-destructive p-0"
                        onClick={() => handleDeleteFromTurn(turn.turn_index)}
                        disabled={deletingTurnIndex !== null || submitting}
                      >
                        {deletingTurnIndex === turn.turn_index ? '刪除中...' : '回溯至此'}
                      </Button>
                    </div>
                  </div>
                  {/* Markdown Rendered Narrative */}
                  <div className="prose dark:prose-invert max-w-none text-foreground leading-relaxed">
                    <ReactMarkdown
                      components={{
                        blockquote: ({ children }) => (
                          <div className="my-3 pl-4 py-2 border-l-4 border-primary bg-primary/5 dark:bg-primary/10 rounded-r-lg">
                            <div className="text-foreground [&>p]:m-0 [&>p>strong]:text-primary [&>p>strong]:font-semibold">
                              {children}
                            </div>
                          </div>
                        ),
                      }}
                    >
                      {turn.narrative_text}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {turns.length === 0 && !pendingUserInput && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <Send className="h-6 w-6 opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">開始你的冒險</h3>
              <p>在下方輸入你的第一個行動</p>
            </div>
          )}

          {/* Pending Input */}
          {pendingUserInput && (
            <div className="space-y-6">
              <div className="flex justify-end pl-12">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-full md:max-w-[85%] shadow-sm opacity-70">
                  <p className="whitespace-pre-wrap leading-relaxed">{pendingUserInput}</p>
                </div>
              </div>

              <div className="flex gap-4 pr-4">
                <div className="shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                    {submitError ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  {submitError ? (
                    <Alert variant="destructive">
                      <AlertTitle>AI 回應失敗</AlertTitle>
                      <AlertDescription>{submitError}</AlertDescription>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => {
                          setUserInput(pendingUserInput);
                          setPendingUserInput(null);
                          setSubmitError(null);
                        }}>編輯後重試</Button>
                        <Button size="sm" onClick={() => {
                          setSubmitError(null);
                          handleSubmit();
                        }}>重試</Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setPendingUserInput(null);
                          setSubmitError(null);
                        }}>取消</Button>
                      </div>
                    </Alert>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">AI 正在思考...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="flex-none p-4 bg-background border-t">
        <div className="max-w-3xl mx-auto relative space-y-2">
          {/* Suggestions Display */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 border rounded-lg transition-colors max-w-full"
                >
                  <span className="line-clamp-2">{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 p-2 border rounded-xl bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary">
            {/* Suggestion Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleGenerateSuggestions}
              disabled={loadingSuggestions || submitting}
              className="mb-0.5 shrink-0"
              title="生成行動建議"
            >
              {loadingSuggestions ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
            </Button>

            <Textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入你的行動... (Shift+Enter 換行)"
              className="min-h-[44px] max-h-[200px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 px-2 py-2.5"
              disabled={submitting}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!userInput.trim() || submitting}
              className="mb-0.5 shrink-0"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {PROVIDER_INFO[tempProvider].name}: {tempUsePreset === 'preset' ? tempModel : tempCustomModel} | 上下文: {tempContextTurns} 回合
          </p>
        </div>
      </div>

      {/* Reset Story Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              確認重新開始故事
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">此操作將會：</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>刪除所有 {turns.length} 個回合記錄</li>
                  <li>清除所有對話歷史</li>
                  <li>刪除所有狀態變更記錄</li>
                  <li>將角色狀態重置為預設值</li>
                </ul>
                <div className="font-semibold text-orange-600 pt-2">此操作無法復原！</div>
                <div className="text-muted-foreground">故事設定和角色將會保留。</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetStory}
              disabled={resetting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  確認重新開始
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WorldDetailsDialog
        worldId={viewingWorldId}
        open={!!viewingWorldId}
        onOpenChange={(open) => !open && setViewingWorldId(null)}
      />

      <CharacterDetailsDialog
        characterId={viewingCharacterId}
        open={!!viewingCharacterId}
        onOpenChange={(open) => !open && setViewingCharacterId(null)}
      />
    </div>
  );
}

export default function StoryPlayPage() {
  return (
    <ProtectedRoute>
      <StoryPlayPageContent />
    </ProtectedRoute>
  );
}
