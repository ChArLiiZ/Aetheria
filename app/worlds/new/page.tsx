'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { createWorld, worldNameExists } from '@/services/sheets/worlds-appsscript';

function NewWorldPageContent() {
  const { user } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rules_text: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '請輸入世界觀名稱';
    } else if (user) {
      const exists = await worldNameExists(user.user_id, formData.name.trim());
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
      const newWorld = await createWorld(user.user_id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rules_text: formData.rules_text.trim(),
      });

      // Redirect to schema editor
      router.push(`/worlds/${newWorld.world_id}/schema`);
    } catch (err: any) {
      console.error('Failed to create world:', err);
      alert(`建立失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            新建世界觀
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            建立一個新的故事世界觀，定義世界的基本設定和規則
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
              placeholder="例如：賽博龐克 2088"
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
              placeholder="描述這個世界的背景、時代、特色..."
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
              placeholder="定義這個世界的運作規則、物理法則、社會規範、禁忌事項等...&#10;&#10;例如：&#10;- 魔法系統：元素魔法需要詠唱咒語&#10;- 科技水平：蒸汽機械時代&#10;- 社會結構：貴族與平民階級分明"
            />
            {errors.rules_text && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.rules_text}</p>
            )}
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              這些規則將用於引導 AI 生成符合世界觀的故事內容
            </p>
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
              {submitting ? '建立中...' : '建立並設定 Schema'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function NewWorldPage() {
  return (
    <ProtectedRoute>
      <NewWorldPageContent />
    </ProtectedRoute>
  );
}
