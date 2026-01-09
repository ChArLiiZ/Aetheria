'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Story, StoryTurn, ProviderSettings } from '@/types';
import { getStoryById } from '@/services/supabase/stories';
import { getStoryTurns } from '@/services/supabase/story-turns';
import { getProviderSetting } from '@/services/supabase/provider-settings';
import { executeTurn } from '@/services/gameplay/execute-turn';

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
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

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
        alert('故事不存在');
        router.push('/stories');
        return;
      }

      if (!settings) {
        alert('請先到設定頁面設定 AI 提供商');
        router.push('/settings');
        return;
      }

      setStory(storyData);
      setTurns(turnsData);
      setProviderSettings(settings);
    } catch (err: any) {
      console.error('Failed to load story:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
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
    } catch (err: any) {
      console.error('Failed to submit:', err);
      alert(`提交失敗: ${err.message || '未知錯誤'}\n\n請檢查 AI 設定是否正確。`);
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {story.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              回合 {turns.length} • {story.story_mode === 'PLAYER_CHARACTER' ? '玩家角色模式' : '導演模式'}
            </p>
          </div>
          <button
            onClick={() => router.push(`/stories/${storyId}`)}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← 返回設定
          </button>
        </div>
      </div>

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
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {turn.narrative_text}
                    </p>

                    {/* Dialogue */}
                    {turn.dialogue_json && turn.dialogue_json !== '[]' && (
                      <div className="mt-4 space-y-2">
                        {JSON.parse(turn.dialogue_json).map((dialogue: any, idx: number) => (
                          <div
                            key={idx}
                            className="pl-4 border-l-2 border-gray-300 dark:border-gray-600"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {dialogue.speaker}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {dialogue.text}
                            </p>
                          </div>
                        ))}
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
