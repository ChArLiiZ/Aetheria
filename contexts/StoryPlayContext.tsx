'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
import { apiPost } from '@/lib/api-client';
import { rollbackStoryToTurn } from '@/services/gameplay/rollback-turns';
import { resetStory } from '@/services/supabase/story-reset';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharacterById } from '@/services/supabase/characters';
import { getAllStateValuesForStory } from '@/services/supabase/story-state-values';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import {
  checkStoryUpdates,
  type StoryUpdateCheck,
} from '@/services/supabase/check-story-updates';
import type { ExecuteTurnResult } from '@/services/gameplay/execute-turn';
import type { SuggestionAgentOutput } from '@/types/api/agents';
import { toast } from 'sonner';
import {
  MODEL_PRESETS,
  PROVIDER_INFO,
  Provider,
  DEFAULT_PROVIDER,
  DEFAULT_MODELS,
} from '@/lib/ai-providers';
import { PlaySkeleton } from '@/components/story/play-skeleton';

// 預設上下文回合數
const DEFAULT_CONTEXT_TURNS = 5;

interface StoryPlayContextType {
  // Core state
  loading: boolean;
  story: Story | null;
  turns: StoryTurn[];
  userInput: string;
  setUserInput: (value: string) => void;
  submitting: boolean;
  deletingTurnIndex: number | null;
  providerSettings: ProviderSettings | null;

  // UX state
  pendingUserInput: string | null;
  setPendingUserInput: (value: string | null) => void;

  // Suggestions
  suggestions: string[];
  loadingSuggestions: boolean;
  submitError: string | null;
  setSubmitError: (value: string | null) => void;

  // Character states
  storyCharacters: StoryCharacter[];
  characters: Map<string, Character>;
  stateValues: StoryStateValue[];
  worldSchema: WorldStateSchema[];
  showStatePanel: boolean;
  setShowStatePanel: (value: boolean) => void;

  // Settings panel
  showSettingsPanel: boolean;
  setShowSettingsPanel: (value: boolean) => void;
  tempProvider: Provider;
  setTempProvider: (value: Provider) => void;
  tempUsePreset: 'preset' | 'custom';
  setTempUsePreset: (value: 'preset' | 'custom') => void;
  tempModel: string;
  setTempModel: (value: string) => void;
  tempCustomModel: string;
  setTempCustomModel: (value: string) => void;
  tempTemperature: number;
  setTempTemperature: (value: number) => void;
  tempContextTurns: number;
  setTempContextTurns: (value: number) => void;
  savingSettings: boolean;

  // Reset story
  showResetDialog: boolean;
  setShowResetDialog: (value: boolean) => void;
  resetting: boolean;

  // Details Dialogs
  viewingWorldId: string | null;
  setViewingWorldId: (value: string | null) => void;
  viewingCharacterId: string | null;
  setViewingCharacterId: (value: string | null) => void;

  // Story update check
  updateInfo: StoryUpdateCheck | null;
  updateDismissed: boolean;

  // Refs
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  // Handlers
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleDeleteFromTurn: (turnIndex: number) => Promise<void>;
  handleRegenerate: (turnIndex: number, previousInput: string) => Promise<void>;
  handleGenerateSuggestions: () => Promise<void>;
  handleSelectSuggestion: (suggestion: string) => void;
  handleSaveSettings: () => Promise<void>;
  handleResetStory: () => Promise<void>;
  handleDismissUpdate: () => void;

  // Navigation
  storyId: string;
  router: ReturnType<typeof useRouter>;
}

const StoryPlayContext = createContext<StoryPlayContextType | null>(null);

export function useStoryPlay(): StoryPlayContextType {
  const context = useContext(StoryPlayContext);
  if (!context) {
    throw new Error('useStoryPlay must be used within a StoryPlayProvider');
  }
  return context;
}

export function StoryPlayProvider({ children }: { children: ReactNode }) {
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

  // UX
  const [pendingUserInput, setPendingUserInput] = useState<string | null>(null);

  // Suggestions
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Internal helpers ───

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

  // ─── Data loading effect ───

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

        // Initialize settings
        const existingModel =
          storyData.model_override || settings.default_model || DEFAULT_MODELS[DEFAULT_PROVIDER];
        const inferredProvider = existingModel.includes('/')
          ? ('openrouter' as Provider)
          : ('openai' as Provider);
        setTempProvider(inferredProvider);

        const isPreset = MODEL_PRESETS[inferredProvider].includes(existingModel);
        setTempUsePreset(isPreset ? 'preset' : 'custom');
        if (isPreset) {
          setTempModel(existingModel);
        } else {
          setTempModel(MODEL_PRESETS[inferredProvider][0] || '');
          setTempCustomModel(existingModel);
        }

        const aiParams = storyData.params_override_json
          ? JSON.parse(storyData.params_override_json)
          : JSON.parse(settings.default_params_json || '{}');
        setTempTemperature(aiParams.temperature ?? 0.7);
        setTempContextTurns(
          storyData.context_turns_override ??
          settings.default_context_turns ??
          DEFAULT_CONTEXT_TURNS
        );

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

  // ─── Auto-scroll ───

  useEffect(() => {
    if (!loading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, turns, pendingUserInput, submitError]);

  // ─── Auto-resize textarea ───

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  // ─── Handlers ───

  const handleDeleteFromTurn = useCallback(
    async (turnIndex: number) => {
      if (!user || !story || deletingTurnIndex !== null || submitting) return;

      if (
        !confirm(
          `確定要刪除回合 ${turnIndex} 及其後所有內容嗎？\n\n此操作將回溯角色狀態，且無法復原。`
        )
      ) {
        return;
      }

      try {
        setDeletingTurnIndex(turnIndex);
        const remainingTurns = await rollbackStoryToTurn(storyId, turnIndex, user.user_id);
        const newTurnCount =
          remainingTurns.length > 0
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
    },
    [user, story, deletingTurnIndex, submitting, storyId]
  );

  const handleRegenerate = useCallback(
    async (turnIndex: number, previousInput: string) => {
      if (!user || !story || !providerSettings || submitting || deletingTurnIndex !== null) return;

      try {
        setSubmitError(null);
        setSubmitting(true);
        setPendingUserInput(previousInput);
        setUserInput('');

        // 1. Rollback
        const remainingTurns = await rollbackStoryToTurn(storyId, turnIndex, user.user_id);

        // 2. Update local state
        const rolledBackTurnCount =
          remainingTurns.length > 0
            ? Math.max(...remainingTurns.map((turn) => turn.turn_index))
            : 0;
        setTurns(remainingTurns);
        setStory({ ...story, turn_count: rolledBackTurnCount });

        // 3. Re-execute turn
        const selectedModel = tempUsePreset === 'preset' ? tempModel : tempCustomModel;
        const result = await apiPost<ExecuteTurnResult>('/api/story/turn', {
          story: { ...story, turn_count: rolledBackTurnCount },
          userInput: previousInput,
          model: selectedModel,
          params: {
            temperature: tempTemperature,
          },
          contextTurns: tempContextTurns,
        });

        // 4. Update state
        setPendingUserInput(null);
        setTurns([...remainingTurns, result.turn]);
        setStory({ ...story, turn_count: result.turn.turn_index });
        await loadCharacterStates(story.world_id);
      } catch (err: any) {
        console.error('Failed to regenerate:', err);
        setSubmitError(err.message || '重新產生失敗');
        try {
          const turnsData = await getStoryTurns(storyId, user.user_id);
          setTurns(turnsData);
          await loadCharacterStates(story.world_id);
        } catch (recoveryErr) {
          console.error('Failed to recover state after regeneration error:', recoveryErr);
        }
        toast.error(`重新產生失敗: ${err.message || '未知錯誤'}`);
      } finally {
        setSubmitting(false);
      }
    },
    [
      user,
      story,
      providerSettings,
      submitting,
      deletingTurnIndex,
      tempUsePreset,
      tempModel,
      tempCustomModel,
      tempTemperature,
      tempContextTurns,
      turns,
      storyId,
    ]
  );

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
      const result = await apiPost<ExecuteTurnResult>('/api/story/turn', {
        story,
        userInput: input,
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

      const { getWorldById } = await import('@/services/supabase/worlds');
      const { getLatestSummaryForTurn } = await import('@/services/supabase/story-summaries');

      const [world, latestSummary] = await Promise.all([
        getWorldById(story.world_id, user.user_id),
        getLatestSummaryForTurn(storyId, turns.length + 1, user.user_id),
      ]);

      if (!world) throw new Error('World not found');

      const characterContexts = storyCharacters.map((sc) => {
        const char = characters.get(sc.story_character_id);
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

      const recentTurnContexts = turns.slice(-tempContextTurns).map((turn) => ({
        turn_index: turn.turn_index,
        user_input: turn.user_input_text,
        narrative: turn.narrative_text,
      }));

      const selectedModel = tempUsePreset === 'preset' ? tempModel : tempCustomModel;

      const result = await apiPost<SuggestionAgentOutput>('/api/story/suggest', {
        input: {
          story_mode: story.story_mode,
          world_rules: world.rules_text,
          story_prompt: story.story_prompt,
          characters: characterContexts,
          recent_turns: recentTurnContexts,
          story_summary: latestSummary?.summary_text,
        },
        model: selectedModel,
        params: { temperature: 0.8 },
      });

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

  const handleDismissUpdate = () => {
    setUpdateDismissed(true);
    setUpdateInfo(null);
    sessionStorage.setItem(`story-update-dismissed-${storyId}`, 'true');
  };

  // ─── Loading / not-found states ───

  if (loading) {
    return <PlaySkeleton />;
  }

  if (!story) {
    return null;
  }

  const value: StoryPlayContextType = {
    loading,
    story,
    turns,
    userInput,
    setUserInput,
    submitting,
    deletingTurnIndex,
    providerSettings,

    pendingUserInput,
    setPendingUserInput,

    suggestions,
    loadingSuggestions,
    submitError,
    setSubmitError,

    storyCharacters,
    characters,
    stateValues,
    worldSchema,
    showStatePanel,
    setShowStatePanel,

    showSettingsPanel,
    setShowSettingsPanel,
    tempProvider,
    setTempProvider,
    tempUsePreset,
    setTempUsePreset,
    tempModel,
    setTempModel,
    tempCustomModel,
    setTempCustomModel,
    tempTemperature,
    setTempTemperature,
    tempContextTurns,
    setTempContextTurns,
    savingSettings,

    showResetDialog,
    setShowResetDialog,
    resetting,

    viewingWorldId,
    setViewingWorldId,
    viewingCharacterId,
    setViewingCharacterId,

    updateInfo,
    updateDismissed,

    chatEndRef,
    textareaRef,

    handleSubmit,
    handleKeyDown,
    handleDeleteFromTurn,
    handleRegenerate,
    handleGenerateSuggestions,
    handleSelectSuggestion,
    handleSaveSettings,
    handleResetStory,
    handleDismissUpdate,

    storyId,
    router,
  };

  return <StoryPlayContext.Provider value={value}>{children}</StoryPlayContext.Provider>;
}
