'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { World } from '@/types';
import { getWorldsByUserId, deleteWorld } from '@/services/sheets/worlds-appsscript';

function WorldsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load worlds
  useEffect(() => {
    loadWorlds();
  }, [user]);

  const loadWorlds = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError('');
      const data = await getWorldsByUserId(user.user_id);
      setWorlds(data);
    } catch (err: any) {
      console.error('Failed to load worlds:', err);
      setError(err.message || '載入世界觀失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (worldId: string, worldName: string) => {
    if (!user) return;

    if (!confirm(`確定要刪除世界觀「${worldName}」嗎？\n\n此操作將同時刪除該世界的所有 Schema 設定、相關故事和資料。\n\n此操作無法復原！`)) {
      return;
    }

    try {
      setDeletingId(worldId);
      await deleteWorld(worldId, user.user_id);
      await loadWorlds();
    } catch (err: any) {
      console.error('Failed to delete world:', err);
      alert(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setDeletingId(null);
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              我的世界觀
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              管理您的故事世界觀設定
            </p>
          </div>
          <button
            onClick={() => router.push('/worlds/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + 新建世界觀
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Worlds List */}
        {worlds.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🌍</div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              還沒有世界觀
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              建立您的第一個世界觀，開始創作故事吧！
            </p>
            <button
              onClick={() => router.push('/worlds/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              開始建立
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {worlds.map((world) => (
              <div
                key={world.world_id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {world.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {world.description || '尚無描述'}
                  </p>

                  {/* Stats */}
                  <div className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                    <div>建立時間：{new Date(world.created_at).toLocaleDateString()}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/worlds/${world.world_id}`)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      編輯設定
                    </button>
                    <button
                      onClick={() => handleDelete(world.world_id, world.name)}
                      disabled={deletingId === world.world_id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-gray-400"
                    >
                      {deletingId === world.world_id ? '...' : '刪除'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← 返回 Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}

export default function WorldsPage() {
  return (
    <ProtectedRoute>
      <WorldsPageContent />
    </ProtectedRoute>
  );
}
