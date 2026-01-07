'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Character } from '@/types';
import { getCharacters, deleteCharacter } from '@/services/sheets/characters-appsscript';

function CharactersListPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCharacters();
  }, [user]);

  const loadCharacters = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getCharacters(user.user_id);
      setCharacters(data);
    } catch (err: any) {
      console.error('Failed to load characters:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (characterId: string, name: string) => {
    if (!user) return;

    if (!confirm(`確定要刪除角色「${name}」嗎？\n\n此操作無法復原！`)) {
      return;
    }

    try {
      await deleteCharacter(characterId, user.user_id);
      await loadCharacters();
      alert('✅ 刪除成功！');
    } catch (err: any) {
      console.error('Failed to delete character:', err);
      alert(`刪除失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const parseTags = (tagsJson?: string): string[] => {
    if (!tagsJson) return [];
    try {
      return JSON.parse(tagsJson);
    } catch (e) {
      return [];
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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              ← 返回主選單
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                角色管理
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                建立與管理跨世界共用的角色卡
              </p>
            </div>
            <button
              onClick={() => router.push('/characters/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              + 新增角色
            </button>
          </div>
        </div>

        {/* Characters List */}
        {characters.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              還沒有任何角色
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              建立第一個角色來開始您的故事之旅
            </p>
            <button
              onClick={() => router.push('/characters/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              建立第一個角色
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => {
              const tags = parseTags(character.tags_json);
              return (
                <div
                  key={character.character_id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {character.canonical_name}
                    </h3>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                      {character.core_profile_text}
                    </p>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                    建立時間：{new Date(character.created_at).toLocaleDateString('zh-TW')}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/characters/${character.character_id}`)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(character.character_id, character.canonical_name)
                      }
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function CharactersListPage() {
  return (
    <ProtectedRoute>
      <CharactersListPageContent />
    </ProtectedRoute>
  );
}
