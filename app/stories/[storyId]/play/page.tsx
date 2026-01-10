'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
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

  // Character states
  const [storyCharacters, setStoryCharacters] = useState<StoryCharacter[]>([]);
  const [characters, setCharacters] = useState<Map<string, Character>>(new Map());
  const [stateValues, setStateValues] = useState<StoryStateValue[]>([]);
  const [relationships, setRelationships] = useState<StoryRelationship[]>([]);
  const [worldSchema, setWorldSchema] = useState<WorldStateSchema[]>([]);
  const [showStatePanel, setShowStatePanel] = useState(false);

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

  useEffect(() => {
    loadStory();
  }, [user, storyId]);

  useEffect(() => {
    // Auto-scroll to bottom when new turns are added
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const loadStory = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load story, turns, and provider settings in parallel
      const [storyData, turnsData, settings] = await Promise.all([
        getStoryById(storyId, user.user_id),
        getStoryTurns(storyId, user.user_id),
        getProviderSetting(user.user_id, 'openrouter'),
      ]);

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
      await loadCharacterStates(storyData.world_id);
    } catch (err: any) {
      console.error('Failed to load story:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCharacterStates = async (worldId: string) => {
    if (!user) return;

    try {
      // Load all character-related data in parallel
      const [storyChars, states, rels, schema] = await Promise.all([
        getStoryCharacters(storyId, user.user_id),
        getAllStateValuesForStory(storyId, user.user_id),
        getStoryRelationships(storyId, user.user_id),
        getSchemaByWorldId(worldId, user.user_id),
      ]);

      setStoryCharacters(storyChars);
      setStateValues(states);
      setRelationships(rels);
      setWorldSchema(schema);

      // Load character details
      const charDetails = await Promise.all(
        storyChars.map((sc) => getCharacterById(sc.character_id, user.user_id))
      );

      const charMap = new Map<string, Character>();
      charDetails.forEach((char, index) => {
        if (char) {
          charMap.set(storyChars[index].story_character_id, char);
        }
      });
      setCharacters(charMap);
    } catch (err: any) {
      console.error('Failed to load character states:', err);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userInput.trim() || submitting || !user || !story || !providerSettings) return;

    const input = userInput.trim();

    try {
      setSubmitting(true);
      setUserInput('');

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

      // Add new turn to the list
      setTurns([...turns, result.turn]);

      // Update story object with new turn count
      setStory({ ...story, turn_count: result.turn.turn_index });

      // Reload character states to reflect changes
      await loadCharacterStates(story.world_id);
    } catch (err: any) {
      console.error('Failed to submit:', err);
      toast.error(`提交失敗: ${err.message || '未知錯誤'}`, {
        description: '請檢查 AI 設定是否正確。',
      });
      // Restore user input on error
      setUserInput(input);
    } finally {
      setSubmitting(false);
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

  if (!story) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {story.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              回合 {turns.length} • {story.story_mode === 'PLAYER_CHARACTER' ? '玩家角色模式' : '導演模式'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowStatePanel(!showStatePanel)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
            >
              {showStatePanel ? '隱藏狀態' : '顯示狀態'}
            </button>
            <button
              onClick={() => router.push(`/stories/${storyId}`)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              ← 返回設定
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Story Premise (Turn 0) */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  📖
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    故事開始
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {story.premise_text}
                  </p>
                </div>
              </div>
            </div>

            {/* Turn History */}
            {turns.map((turn, index) => (
              <div key={turn.turn_id} className="space-y-4">
                {/* User Input */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-blue-600 text-white rounded-lg p-4">
                    <p className="text-sm font-medium mb-1">你的行動</p>
                    <p className="whitespace-pre-wrap">{turn.user_input_text}</p>
                  </div>
                </div>

                {/* AI Response */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      AI
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          回合 {turn.turn_index}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(turn.created_at).toLocaleString('zh-TW')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFromTurn(turn.turn_index)}
                          disabled={deletingTurnIndex !== null}
                          className="ml-auto text-xs text-red-600 hover:text-red-700 disabled:text-gray-400"
                        >
                          {deletingTurnIndex === turn.turn_index ? '刪除中...' : '刪除此回合'}
                        </button>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {turn.narrative_text}
                      </p>

                      {/* Dialogue */}
                      {turn.dialogue_json && turn.dialogue_json !== '[]' && (
                        <div className="mt-4 space-y-2">
                          {JSON.parse(turn.dialogue_json).map((dialogue: any, idx: number) => {
                            const speakerName = resolveSpeakerName(
                              dialogue.speaker_story_character_id,
                              dialogue.speaker
                            );

                            return (
                              <div
                                key={idx}
                                className="pl-4 border-l-2 border-gray-300 dark:border-gray-600"
                              >
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {speakerName}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {dialogue.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty state */}
            {turns.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎮</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  準備開始你的冒險
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  在下方輸入你的第一個行動
                </p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* State Panel */}
        {showStatePanel && (
          <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                角色狀態
              </h2>

              {/* Characters */}
              <div className="space-y-4">
                {storyCharacters.map((sc) => {
                  const char = characters.get(sc.story_character_id);
                  if (!char) return null;

                  // Get this character's state values
                  const charStates = stateValues.filter(
                    (sv) => sv.story_character_id === sc.story_character_id
                  );

                  return (
                    <div
                      key={sc.story_character_id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {sc.display_name_override || char.canonical_name}
                        </h3>
                        {sc.is_player && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                            玩家
                          </span>
                        )}
                      </div>

                      {/* State Values */}
                      {charStates.length > 0 ? (
                        <div className="space-y-2">
                          {charStates.map((sv) => {
                            const schema = worldSchema.find(
                              (s) => s.schema_key === sv.schema_key
                            );
                            if (!schema) return null;

                            let displayValue;
                            try {
                              const value = JSON.parse(sv.value_json);
                              if (schema.type === 'list_text') {
                                displayValue = Array.isArray(value)
                                  ? value.join(', ')
                                  : value;
                              } else if (typeof value === 'boolean') {
                                displayValue = value ? '是' : '否';
                              } else {
                                displayValue = String(value);
                              }
                            } catch {
                              displayValue = sv.value_json;
                            }

                            return (
                              <div key={sv.schema_key} className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                  {schema.display_name}:
                                </span>{' '}
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {displayValue}
                                  {schema.type === 'number' &&
                                    schema.number_constraints_json &&
                                    (() => {
                                      const constraints = JSON.parse(
                                        schema.number_constraints_json
                                      );
                                      return constraints.unit
                                        ? ` ${constraints.unit}`
                                        : '';
                                    })()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          尚無狀態設定
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Relationships */}
              {relationships.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    角色關係
                  </h3>
                  <div className="space-y-2">
                    {relationships.map((rel, index) => {
                      const fromChar = storyCharacters.find(
                        (sc) => sc.story_character_id === rel.from_story_character_id
                      );
                      const toChar = storyCharacters.find(
                        (sc) => sc.story_character_id === rel.to_story_character_id
                      );

                      if (!fromChar || !toChar) return null;

                      const fromCharDetail = characters.get(fromChar.story_character_id);
                      const toCharDetail = characters.get(toChar.story_character_id);

                      const tags = JSON.parse(rel.tags_json || '[]');

                      return (
                        <div
                          key={`${rel.from_story_character_id}-${rel.to_story_character_id}`}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {fromChar.display_name_override ||
                                fromCharDetail?.canonical_name}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {toChar.display_name_override ||
                                toCharDetail?.canonical_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">
                              分數:
                            </span>
                            <span
                              className={`font-medium ${rel.score > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : rel.score < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}
                            >
                              {rel.score}
                            </span>
                          </div>
                          {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {tags.map((tag: string) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="描述你的行動... (Enter 送出，Shift+Enter 換行)"
              disabled={submitting}
              rows={3}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!userInput.trim() || submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold self-end"
            >
              {submitting ? '思考中...' : '送出'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            💡 提示：描述你想做的事情，AI 會根據故事設定生成回應
          </p>
        </form>
      </div>
    </main>
  );
}

export default function StoryPlayPage() {
  return (
    <ProtectedRoute>
      <StoryPlayPageContent />
    </ProtectedRoute>
  );
}
