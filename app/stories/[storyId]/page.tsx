'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Story, World, Character, StoryMode } from '@/types';
import { getStoryById, createStory, updateStory, storyTitleExists } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';
import { getCharacters } from '@/services/supabase/characters';

function StoryDetailPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const storyId = params.storyId as string;
  const isNewStory = storyId === 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    world_id: '',
    title: '',
    premise_text: '',
    story_mode: 'PLAYER_CHARACTER' as StoryMode,
    player_character_id: '',
    story_prompt: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [user, storyId]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load worlds and characters
      const [worldsData, charactersData] = await Promise.all([
        getWorldsByUserId(user.user_id),
        getCharacters(user.user_id),
      ]);

      setWorlds(worldsData);
      setCharacters(charactersData);

      // Load story if editing
      if (!isNewStory) {
        const storyData = await getStoryById(storyId, user.user_id);
        if (!storyData) {
          alert('故事不存在');
          router.push('/stories');
          return;
        }

        setStory(storyData);
        setFormData({
          world_id: storyData.world_id,
          title: storyData.title,
          premise_text: storyData.premise_text,
          story_mode: storyData.story_mode,
          player_character_id: storyData.player_character_id || '',
          story_prompt: storyData.story_prompt,
        });
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.world_id.trim()) {
      newErrors.world_id = '請選擇世界觀';
    }

    if (!formData.title.trim()) {
      newErrors.title = '請輸入故事標題';
    } else {
      // Check for duplicate title
      const exists = await storyTitleExists(
        user!.user_id,
        formData.title.trim(),
        isNewStory ? undefined : storyId
      );
      if (exists) {
        newErrors.title = '此標題已存在，請使用不同的標題';
      }
    }

    if (!formData.premise_text.trim()) {
      newErrors.premise_text = '請輸入故事前提';
    }

    if (formData.story_mode === 'PLAYER_CHARACTER' && !formData.player_character_id) {
      newErrors.player_character_id = '玩家角色模式需要選擇一個角色';
    }

    if (!formData.story_prompt.trim()) {
      newErrors.story_prompt = '請輸入 AI 提示詞';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!user) return;

    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setSaving(true);

      if (isNewStory) {
        const newStory = await createStory(user.user_id, {
          world_id: formData.world_id,
          title: formData.title.trim(),
          premise_text: formData.premise_text.trim(),
          story_mode: formData.story_mode,
          player_character_id: formData.story_mode === 'PLAYER_CHARACTER' ? formData.player_character_id : undefined,
          story_prompt: formData.story_prompt.trim(),
        });

        alert('✅ 故事創建成功！');
        router.push(`/stories/${newStory.story_id}`);
      } else {
        await updateStory(storyId, user.user_id, {
          title: formData.title.trim(),
          premise_text: formData.premise_text.trim(),
          story_prompt: formData.story_prompt.trim(),
        });

        alert('✅ 更新成功！');
        loadData();
      }
    } catch (err: any) {
      console.error('Failed to save story:', err);
      alert(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-600 dark:text-gray-400">載入中...</p>
        </div>
      </main>
    );
  }

  const selectedWorld = worlds.find((w) => w.world_id === formData.world_id);
  const playerCharacter = characters.find((c) => c.character_id === formData.player_character_id);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isNewStory ? '創建新故事' : story?.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {isNewStory ? '設定你的互動故事' : '查看和管理故事設定'}
            </p>
          </div>
          <button
            onClick={() => router.push('/stories')}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← 返回列表
          </button>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          {/* World Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              世界觀 *
            </label>
            {isNewStory ? (
              <>
                <select
                  value={formData.world_id}
                  onChange={(e) => setFormData({ ...formData, world_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">請選擇世界觀</option>
                  {worlds.map((world) => (
                    <option key={world.world_id} value={world.world_id}>
                      {world.name}
                    </option>
                  ))}
                </select>
                {errors.world_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.world_id}</p>
                )}
                {worlds.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    還沒有世界觀，請先{' '}
                    <button
                      onClick={() => router.push('/worlds/new')}
                      className="text-blue-600 hover:underline"
                    >
                      創建世界觀
                    </button>
                  </p>
                )}
              </>
            ) : (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-gray-900 dark:text-white font-medium">
                  {selectedWorld?.name || '未知世界觀'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedWorld?.description}
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              故事標題 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="給你的故事起個名字"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Premise */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              故事前提 *
            </label>
            <textarea
              value={formData.premise_text}
              onChange={(e) => setFormData({ ...formData, premise_text: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
              placeholder="描述故事的背景和起始狀況"
            />
            {errors.premise_text && <p className="mt-1 text-sm text-red-600">{errors.premise_text}</p>}
          </div>

          {/* Story Mode */}
          {isNewStory && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                遊戲模式 *
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <input
                    type="radio"
                    name="story_mode"
                    value="PLAYER_CHARACTER"
                    checked={formData.story_mode === 'PLAYER_CHARACTER'}
                    onChange={(e) =>
                      setFormData({ ...formData, story_mode: e.target.value as StoryMode })
                    }
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      玩家角色模式
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      你將扮演一個特定角色，從第一人稱視角體驗故事
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <input
                    type="radio"
                    name="story_mode"
                    value="DIRECTOR"
                    checked={formData.story_mode === 'DIRECTOR'}
                    onChange={(e) =>
                      setFormData({ ...formData, story_mode: e.target.value as StoryMode })
                    }
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">導演模式</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      你將作為導演，從上帝視角控制整個故事的發展
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Player Character (only in PLAYER_CHARACTER mode) */}
          {formData.story_mode === 'PLAYER_CHARACTER' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                玩家角色 *
              </label>
              {isNewStory ? (
                <>
                  <select
                    value={formData.player_character_id}
                    onChange={(e) =>
                      setFormData({ ...formData, player_character_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">請選擇玩家角色</option>
                    {characters.map((char) => (
                      <option key={char.character_id} value={char.character_id}>
                        {char.canonical_name}
                      </option>
                    ))}
                  </select>
                  {errors.player_character_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.player_character_id}</p>
                  )}
                  {characters.length === 0 && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      還沒有角色，請先{' '}
                      <button
                        onClick={() => router.push('/characters/new')}
                        className="text-blue-600 hover:underline"
                      >
                        創建角色
                      </button>
                    </p>
                  )}
                </>
              ) : (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {playerCharacter?.canonical_name || '未知角色'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Story Prompt */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI 提示詞 *
            </label>
            <textarea
              value={formData.story_prompt}
              onChange={(e) => setFormData({ ...formData, story_prompt: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm font-mono"
              placeholder="給 AI 的指示，例如：\n- 故事風格和語氣\n- 角色行為準則\n- 特殊規則"
            />
            {errors.story_prompt && <p className="mt-1 text-sm text-red-600">{errors.story_prompt}</p>}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              這個提示詞會在每次 AI 生成回應時使用，用來指導 AI 的行為
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving || worlds.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {saving ? '儲存中...' : isNewStory ? '✨ 創建故事' : '💾 儲存更改'}
            </button>
            <button
              onClick={() => router.push('/stories')}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              取消
            </button>
          </div>
        </div>

        {/* Play Button (only for existing stories) */}
        {!isNewStory && story?.status === 'active' && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-6 text-white text-center">
            <h3 className="text-xl font-semibold mb-2">準備好開始冒險了嗎？</h3>
            <p className="mb-4 opacity-90">
              當前回合數: {story.turn_count || 0}
            </p>
            <button
              onClick={() => router.push(`/stories/${storyId}/play`)}
              className="px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-semibold"
            >
              🎮 進入遊戲
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StoryDetailPage() {
  return (
    <ProtectedRoute>
      <StoryDetailPageContent />
    </ProtectedRoute>
  );
}
