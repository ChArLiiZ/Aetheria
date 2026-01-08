'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Character } from '@/types';
import {
  getCharacterById,
  createCharacter,
  updateCharacter,
  characterNameExists,
} from '@/services/supabase/characters';

function CharacterEditorPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const characterId = params.characterId as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    canonical_name: '',
    core_profile_text: '',
    tags: [''],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isNewCharacter = characterId === 'new';

  useEffect(() => {
    if (!isNewCharacter) {
      loadCharacter();
    } else {
      setLoading(false);
    }
  }, [characterId, user, isNewCharacter]);

  const loadCharacter = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getCharacterById(characterId, user.user_id);

      if (!data) {
        alert('找不到此角色');
        router.push('/characters');
        return;
      }

      setCharacter(data);

      // Parse tags
      let tags: string[] = [''];
      if (data.tags_json) {
        try {
          tags = JSON.parse(data.tags_json);
          if (!Array.isArray(tags) || tags.length === 0) {
            tags = [''];
          }
        } catch (e) {
          tags = [''];
        }
      }

      setFormData({
        canonical_name: data.canonical_name,
        core_profile_text: data.core_profile_text,
        tags,
      });
    } catch (err: any) {
      console.error('Failed to load character:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
      router.push('/characters');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.canonical_name.trim()) {
      newErrors.canonical_name = '請輸入角色名稱';
    } else if (user) {
      const exists = await characterNameExists(
        user.user_id,
        formData.canonical_name.trim(),
        isNewCharacter ? undefined : characterId
      );
      if (exists) {
        newErrors.canonical_name = '此角色名稱已存在';
      }
    }

    if (!formData.core_profile_text.trim()) {
      newErrors.core_profile_text = '請輸入角色資料';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setSaving(true);

      const validTags = formData.tags.filter((tag) => tag.trim());

      if (isNewCharacter) {
        await createCharacter({
          canonical_name: formData.canonical_name.trim(),
          core_profile_text: formData.core_profile_text.trim(),
          tags: validTags.length > 0 ? validTags : undefined,
        });
        alert('✅ 角色建立成功！');
      } else {
        await updateCharacter(characterId, user.user_id, {
          canonical_name: formData.canonical_name.trim(),
          core_profile_text: formData.core_profile_text.trim(),
          tags: validTags.length > 0 ? validTags : undefined,
        });
        alert('✅ 儲存成功！');
      }

      router.push('/characters');
    } catch (err: any) {
      console.error('Failed to save character:', err);
      alert(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isNewCharacter ? '新增角色' : `編輯角色：${character?.canonical_name || ''}`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isNewCharacter
                ? '建立一個新的角色卡（背景、性格、說話風格等）'
                : '修改角色的核心資料'}
            </p>
          </div>
          <button
            onClick={() => router.push('/characters')}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← 返回列表
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          {/* Canonical Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              角色名稱 * <span className="text-gray-500">(canonical_name)</span>
            </label>
            <input
              type="text"
              value={formData.canonical_name}
              onChange={(e) =>
                setFormData({ ...formData, canonical_name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="例如：艾莉亞、約翰"
            />
            {errors.canonical_name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.canonical_name}
              </p>
            )}
          </div>

          {/* Core Profile Text */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              核心角色資料 * <span className="text-gray-500">(背景/性格/動機/秘密/說話風格)</span>
            </label>
            <textarea
              value={formData.core_profile_text}
              onChange={(e) =>
                setFormData({ ...formData, core_profile_text: e.target.value })
              }
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
              placeholder={`範例：

【背景】
艾莉亞是一名來自北方的遊俠，自幼在森林中長大...

【性格】
謹慎、獨立、對陌生人保持警戒...

【動機】
尋找失蹤的家人...

【秘密】
擁有精靈血統...

【說話風格】
簡潔、直接、少用修飾詞...`}
            />
            {errors.core_profile_text && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.core_profile_text}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              提示：詳細的角色資料有助於 AI 更準確地扮演這個角色
            </p>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              標籤 <span className="text-gray-500">(可選，用於分類)</span>
            </label>
            {formData.tags.map((tag, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => {
                    const newTags = [...formData.tags];
                    newTags[index] = e.target.value;
                    setFormData({ ...formData, tags: newTags });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder={`標籤 ${index + 1}（例如：戰士、法師、NPC）`}
                />
                {formData.tags.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTags = formData.tags.filter((_, i) => i !== index);
                      setFormData({ ...formData, tags: newTags });
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    刪除
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, tags: [...formData.tags, ''] })
              }
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              + 新增標籤
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/characters')}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {saving ? '儲存中...' : isNewCharacter ? '建立角色' : '儲存變更'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function CharacterEditorPage() {
  return (
    <ProtectedRoute>
      <CharacterEditorPageContent />
    </ProtectedRoute>
  );
}
