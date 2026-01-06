'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { World } from '@/types';
import {
  getWorldById,
  updateWorld,
  worldNameExists,
} from '@/services/sheets/worlds-appsscript';

function EditWorldPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const worldId = params.worldId as string;

  const [world, setWorld] = useState<World | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rules_text: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load world
  useEffect(() => {
    loadWorld();
  }, [worldId, user]);

  const loadWorld = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getWorldById(worldId, user.user_id);

      if (!data) {
        alert('找不到此世界觀');
        router.push('/worlds');
        return;
      }

      setWorld(data);
      setFormData({
        name: data.name,
        description: data.description,
        rules_text: data.rules_text,
      });
    } catch (err: any) {
      console.error('Failed to load world:', err);
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
      router.push('/worlds');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '請輸入世界觀名稱';
    } else if (user && formData.name !== world?.name) {
      const exists = await worldNameExists(user.user_id, formData.name.trim(), worldId);
      if (exists) {
        newErrors.name = '此世界觀名稱已存在';
      }
    }

    if (!formData.description.trim()) {
      newErrors.description = '請輸入世界觀描述';
    }

    if (!formData.rules_text.trim()) {
      newErrors.rules_text = '請輸入世界規則';
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
      setSubmitting(true);
      await updateWorld(worldId, user.user_id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rules_text: formData.rules_text.trim(),
      });

      router.push('/worlds');
    } catch (err: any) {
      console.error('Failed to update world:', err);
      alert(`更新失敗: ${err.message || '未知錯誤'}`);
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

  if (!world) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            編輯世界觀
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            修改「{world.name}」的設定
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          {/* Name */}
          <div className="mb-6">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              世界觀名稱 *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              世界描述 *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
            )}
          </div>

          {/* Rules Text */}
          <div className="mb-6">
            <label
              htmlFor="rules_text"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              世界規則 *
            </label>
            <textarea
              id="rules_text"
              value={formData.rules_text}
              onChange={(e) => setFormData({ ...formData, rules_text: e.target.value })}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
            />
            {errors.rules_text && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.rules_text}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/worlds')}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {submitting ? '儲存中...' : '儲存變更'}
            </button>
          </div>
        </form>

        {/* Additional Actions */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push(`/worlds/${worldId}/schema`)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            前往 Schema 編輯器 →
          </button>
        </div>
      </div>
    </main>
  );
}

export default function EditWorldPage() {
  return (
    <ProtectedRoute>
      <EditWorldPageContent />
    </ProtectedRoute>
  );
}
