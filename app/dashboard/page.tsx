'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
                Aetheria
              </Link>
              <span className="text-sm text-gray-500 dark:text-gray-400">Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.display_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {user?.display_name}
                </span>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            歡迎回來，{user?.display_name}！
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            從這裡開始管理您的世界觀、角色與故事
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link
            href="/worlds"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <div className="text-4xl mb-3">🌍</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              世界觀
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              建立與管理世界觀設定
            </p>
          </Link>

          <Link
            href="/characters"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <div className="text-4xl mb-3">👤</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              角色
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              建立與編輯角色卡
            </p>
          </Link>

          <Link
            href="/stories"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <div className="text-4xl mb-3">📖</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              故事
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              開始新故事或繼續遊玩
            </p>
          </Link>

          <Link
            href="/settings"
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <div className="text-4xl mb-3">⚙️</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              設定
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI 設定與偏好
            </p>
          </Link>
        </div>

        {/* Recent Stories Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            最近的故事
          </h2>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              您還沒有建立任何故事
            </p>
            <Link
              href="/stories/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              建立第一個故事
            </Link>
          </div>
        </div>

        {/* Development Notice */}
        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
            🚧 開發中
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Dashboard 頁面正在開發中。世界觀、角色與故事管理功能將陸續加入。
          </p>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
