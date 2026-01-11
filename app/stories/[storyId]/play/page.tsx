'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import {
  Story,
  StoryTurn,
  ProviderSettings,
  StoryCharacter,
  Character,
  StoryStateValue,
  StoryRelationship,
  WorldStateSchema,
} from '@/types';
import { getStoryById } from '@/services/supabase/stories';
import { getStoryTurns } from '@/services/supabase/story-turns';
import { getProviderSetting } from '@/services/supabase/provider-settings';
import { executeTurn } from '@/services/gameplay/execute-turn';
import { rollbackStoryToTurn } from '@/services/gameplay/rollback-turns';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharacterById } from '@/services/supabase/characters';
import { getAllStateValuesForStory } from '@/services/supabase/story-state-values';
import { getStoryRelationships } from '@/services/supabase/story-relationships';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Trash2, ArrowLeft, Menu, BookOpen, Bot, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Character states
  const [storyCharacters, setStoryCharacters] = useState<StoryCharacter[]>([]);
  const [characters, setCharacters] = useState<Map<string, Character>>(new Map());
  const [stateValues, setStateValues] = useState<StoryStateValue[]>([]);
  const [relationships, setRelationships] = useState<StoryRelationship[]>([]);
  const [worldSchema, setWorldSchema] = useState<WorldStateSchema[]>([]);
  const [showStatePanel, setShowStatePanel] = useState(false); // Used for mobile/sheet state or desktop toggle? Actually with Sheet we can just use open state.
  // Let's use it for the Sheet open state on mobile/desktop.

  const chatEndRef = useRef<HTMLDivElement>(null);

  const resolveSpeakerName = (speakerId?: string, fallback?: string) => {
    if (!speakerId) return fallback || '未知角色';
    const storyChar = storyCharacters.find(
      (sc) => sc.story_character_id === speakerId
    );
    if (!storyChar) return fallback || '未知角色';
    const character = characters.get(storyChar.story_character_id);
    return storyChar.display_name_override || character?.canonical_name || fallback || '未知角色';
  };

  // 載入故事資料，使用 cancelled 標記防止 race condition
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      // 如果沒有 user_id，設定 loading = false 並返回
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Load story, turns, and provider settings in parallel
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

        // Load character states
        await loadCharacterStatesInternal(storyData.world_id, cancelled);
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

  // 內部載入角色狀態函式（支援 cancelled 參數）
  const loadCharacterStatesInternal = async (worldId: string, cancelled: boolean) => {
    if (!user) return;

    try {
      // Load all character-related data in parallel
      const [storyChars, states, rels, schema] = await Promise.all([
        getStoryCharacters(storyId, user.user_id),
        getAllStateValuesForStory(storyId, user.user_id),
        getStoryRelationships(storyId, user.user_id),
        getSchemaByWorldId(worldId, user.user_id),
      ]);

      if (cancelled) return;

      setStoryCharacters(storyChars);
      setStateValues(states);
      setRelationships(rels);
      setWorldSchema(schema);

      // Load character details
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

  // 公開的載入角色狀態函式（供其他地方呼叫）
  const loadCharacterStates = async (worldId: string) => {
    return loadCharacterStatesInternal(worldId, false);
  };

  // Auto-scroll to bottom when new turns are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pendingUserInput, submitError]); // Also scroll on pending/error to keep focus

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  const handleDeleteFromTurn = async (turnIndex: number) => {
    if (!user || !story || deletingTurnIndex) return;

    if (
      !confirm(
        `確定要刪除回合 ${turnIndex} 及其後所有內容嗎？\n\n此操作將回溯角色狀態與關係，且無法復原。`
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
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!userInput.trim() || submitting || !user || !story || !providerSettings) return;

    const input = userInput.trim();

    try {
      // 立即顯示用戶輸入（樂觀 UI）
      setPendingUserInput(input);
      setSubmitError(null);
      setSubmitting(true);
      setUserInput('');

      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Execute turn with AI
      const result = await executeTurn({
        story,
        userInput: input,
        userId: user.user_id,
        apiKey: providerSettings.api_key,
        model: story.model_override || providerSettings.default_model,
        params: story.params_override_json
          ? JSON.parse(story.params_override_json)
          : JSON.parse(providerSettings.default_params_json || '{}'),
      });

      // 成功：清除 pending 狀態，加入回合
      setPendingUserInput(null);
      setTurns([...turns, result.turn]);

      // Update story object with new turn count
      setStory({ ...story, turn_count: result.turn.turn_index });

      // Reload character states to reflect changes
      await loadCharacterStates(story.world_id);
    } catch (err: any) {
      console.error('Failed to submit:', err);
      // 顯示錯誤訊息在 UI 中
      setSubmitError(err.message || '提交失敗，請稍後再試');
      toast.error(`提交失敗: ${err.message || '未知錯誤'}`, {
        description: '請檢查 AI 設定是否正確。',
      });
      // 保留 pending 狀態讓用戶可以看到他們的輸入
      // 不清除 pendingUserInput，讓用戶可以重試
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
            <Button variant="ghost" size="icon" onClick={() => router.push(`/stories/${storyId}`)} title="返回設定">
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
            <Sheet open={showStatePanel} onOpenChange={setShowStatePanel}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="hidden lg:flex">
                  <BookOpen className="mr-2 h-4 w-4" /> 狀態
                </Button>
              </SheetTrigger>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>角色狀態</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  {/* Characters */}
                  <div className="space-y-4">
                    {storyCharacters.map((sc) => {
                      const char = characters.get(sc.story_character_id);
                      if (!char) return null;
                      const charStates = stateValues.filter(
                        (sv) => sv.story_character_id === sc.story_character_id
                      );

                      return (
                        <Card key={sc.story_character_id}>
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold flex items-center gap-2">
                                {sc.display_name_override || char.canonical_name}
                                {sc.is_player && <Badge variant="secondary" className="text-[10px] h-5">玩家</Badge>}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            {charStates.length > 0 ? (
                              <div className="space-y-1 text-sm">
                                {charStates.map((sv) => {
                                  const schema = worldSchema.find((s) => s.schema_key === sv.schema_key);
                                  if (!schema) return null;

                                  let displayValue;
                                  try {
                                    const value = JSON.parse(sv.value_json);
                                    if (schema.type === 'list_text') {
                                      displayValue = Array.isArray(value) ? value.join(', ') : value;
                                    } else if (typeof value === 'boolean') {
                                      displayValue = value ? '是' : '否';
                                    } else {
                                      displayValue = String(value);
                                    }
                                  } catch {
                                    displayValue = sv.value_json;
                                  }

                                  return (
                                    <div key={sv.schema_key} className="flex justify-between border-b last:border-0 py-1 border-muted">
                                      <span className="text-muted-foreground">{schema.display_name}</span>
                                      <span className="font-medium text-right">
                                        {displayValue}
                                        {schema.type === 'number' && schema.number_constraints_json && (() => {
                                          const constraints = JSON.parse(schema.number_constraints_json);
                                          return constraints.unit ? ` ${constraints.unit}` : '';
                                        })()}
                                      </span>
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

                  {/* Relationships */}
                  {relationships.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">角色關係</h3>
                      <div className="space-y-2">
                        {relationships.map((rel) => {
                          const fromChar = storyCharacters.find(sc => sc.story_character_id === rel.from_story_character_id);
                          const toChar = storyCharacters.find(sc => sc.story_character_id === rel.to_story_character_id);
                          if (!fromChar || !toChar) return null;
                          const tags = JSON.parse(rel.tags_json || '[]');

                          return (
                            <div key={`${rel.from_story_character_id}-${rel.to_story_character_id}`} className="flex items-center justify-between p-3 border rounded-lg bg-card text-card-foreground">
                              <div className="flex flex-col gap-1">
                                <div className="text-sm font-medium">
                                  {fromChar.display_name_override || characters.get(fromChar.story_character_id)?.canonical_name}
                                  <span className="text-muted-foreground mx-1">→</span>
                                  {toChar.display_name_override || characters.get(toChar.story_character_id)?.canonical_name}
                                </div>
                                {tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {tags.map((tag: string) => <Badge key={tag} variant="outline" className="text-[10px] px-1 h-4">{tag}</Badge>)}
                                  </div>
                                )}
                              </div>
                              <div className={cn("text-sm font-bold", rel.score > 0 ? "text-green-600" : rel.score < 0 ? "text-red-600" : "text-muted-foreground")}>
                                {rel.score}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content (Chat) */}
      <ScrollArea className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
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
          {turns.map((turn) => (
            <div key={turn.turn_id} className="space-y-6">
              {/* User Input */}
              <div className="flex justify-end pl-12">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-full md:max-w-[85%] shadow-sm">
                  {/* <p className="text-xs font-medium opacity-70 mb-1">你的行動</p> */}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-destructive p-0"
                      onClick={() => handleDeleteFromTurn(turn.turn_index)}
                      disabled={deletingTurnIndex !== null}
                    >
                      {deletingTurnIndex === turn.turn_index ? '刪除中...' : '回溯至此'}
                    </Button>
                  </div>
                  <div className="prose dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
                    {turn.narrative_text}
                  </div>

                  {turn.dialogue_json && turn.dialogue_json !== '[]' && (
                    <div className="mt-4 pl-4 border-l-2 space-y-3">
                      {JSON.parse(turn.dialogue_json).map((dialogue: any, idx: number) => {
                        const speakerName = resolveSpeakerName(dialogue.speaker_story_character_id, dialogue.speaker);
                        return (
                          <div key={idx} className="space-y-0.5">
                            <p className="text-sm font-semibold text-primary">{speakerName}</p>
                            <p className="text-muted-foreground">{dialogue.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

              {/* Loading / Error State */}
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
                          handleSubmit(); // Try again directly
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
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 p-2 border rounded-xl bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary">
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
            AI 模型: {story.model_override || providerSettings?.default_model || 'Loading...'}
          </p>
        </div>
      </div>
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
