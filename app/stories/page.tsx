'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Story } from '@/types';
import { getStories, deleteStory } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';
import { toast } from 'sonner';

interface StoryWithWorld extends Story {
  world_name?: string;
}

function StoriesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<StoryWithWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');

  // Load stories with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchStories = async () => {
      // 如果沒有 user_id，設定 loading = false 並返回
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch stories and worlds in parallel
        const [storiesData, worldsData] = await Promise.all([
          getStories(user.user_id),
          getWorldsByUserId(user.user_id),
        ]);

        if (cancelled) return;

        // Create a map of world_id to world_name for quick lookup
        const worldMap = new Map(
          worldsData.map((world) => [world.world_id, world.name])
        );

        // Match world names to stories
        const storiesWithWorlds = storiesData.map((story) => ({
          ...story,
          world_name: worldMap.get(story.world_id) || '未知世界觀',
        }));

        setStories(storiesWithWorlds);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load stories:', err);
        toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStories();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  // Reload stories function for use after updates
  const loadStories = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      // Fetch stories and worlds in parallel
      const [storiesData, worldsData] = await Promise.all([
        getStories(user.user_id),
        getWorldsByUserId(user.user_id),
      ]);

      // Create a map of world_id to world_name for quick lookup
      const worldMap = new Map(
        worldsData.map((world) => [world.world_id, world.name])
      );

      // Match world names to stories
      const storiesWithWorlds = storiesData.map((story) => ({
        ...story,
        world_name: worldMap.get(story.world_id) || '未知世界觀',
      }));

      setStories(storiesWithWorlds);
    } catch (err: any) {
      console.error('Failed to load stories:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (storyId: string, title: string) => {
    if (!user) return;

    if (!confirm(`確定要刪除故事「${title}」嗎？\n\n刪除後將無法復原，包含所有回合記錄、角色狀態和關係數據。`)) {
      return;
    }

    try {
      await deleteStory(storyId, user.user_id);
      toast.success('刪除成功！');
      loadStories();
    } catch (err: any) {
      console.error('Failed to delete story:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const filteredStories = stories.filter((story) => {
    if (filter === 'all') return true;
    return story.status === filter;
  });

  const getStoryModeLabel = (mode: string) => {
    switch (mode) {
      case 'PLAYER_CHARACTER':
        return '玩家角色模式';
      case 'DIRECTOR':
        return '導演模式';
      default:
        return mode;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded">
          進行中
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded">
          已結束
        </span>
      );
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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← 返回主選單
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">我的故事</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              管理你的互動故事，開始新的冒險
            </p>
          </div>
          <button
            onClick={() => router.push('/stories/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            ✨ 創建新故事
          </button>
        </div>

        {/* Filter */}
        {stories.length > 0 && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition ${filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              全部 ({stories.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg transition ${filter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              進行中 ({stories.filter((s) => s.status === 'active').length})
            </button>
            <button
              onClick={() => setFilter('ended')}
              className={`px-4 py-2 rounded-lg transition ${filter === 'ended'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              已結束 ({stories.filter((s) => s.status === 'ended').length})
            </button>
          </div>
        )}

        {/* Stories List */}
        {filteredStories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📖</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {filter === 'all' ? '還沒有故事' : `沒有${filter === 'active' ? '進行中' : '已結束'}的故事`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {filter === 'all'
                ? '點擊「創建新故事」按鈕開始你的第一個互動故事'
                : '試試切換到其他篩選條件'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => router.push('/stories/new')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                ✨ 創建新故事
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map((story) => (
              <div
                key={story.story_id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 pr-2">
                      {story.title}
                    </h3>
                    {getStatusBadge(story.status)}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium mr-2">世界觀:</span>
                      <span>{story.world_name}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium mr-2">模式:</span>
                      <span>{getStoryModeLabel(story.story_mode)}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium mr-2">回合數:</span>
                      <span>{story.turn_count || 0}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {story.premise_text}
                  </p>

                  <div className="flex gap-2">
                    {story.status === 'active' && (
                      <button
                        onClick={() => router.push(`/stories/${story.story_id}/play`)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                      >
                        繼續遊玩
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/stories/${story.story_id}`)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      查看詳情
                    </button>
                    <button
                      onClick={() => handleDelete(story.story_id, story.title)}
                      className="px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      title="刪除故事"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                  最後更新: {new Date(story.updated_at).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function StoriesPage() {
  return (
    <ProtectedRoute>
      <StoriesPageContent />
    </ProtectedRoute>
  );
}
