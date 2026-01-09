'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="z-10 w-full max-w-5xl">
        {/* Auth Status Bar */}
        {isAuthenticated && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user?.display_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                登出
              </button>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Aetheria
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            AI 互動小說應用程式
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Next.js + TypeScript + Supabase + OpenRouter / OpenAI
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="p-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center"
              >
                <div className="text-3xl mb-2">📊</div>
                <div className="font-semibold text-lg">進入 Dashboard</div>
                <div className="text-sm opacity-90 mt-1">管理世界觀、角色與故事</div>
              </Link>
              <Link
                href="/test"
                className="p-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-center"
              >
                <div className="text-3xl mb-2">🧪</div>
                <div className="font-semibold text-lg">測試頁面</div>
                <div className="text-sm opacity-90 mt-1">查看系統狀態</div>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="p-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center"
              >
                <div className="text-3xl mb-2">🔐</div>
                <div className="font-semibold text-lg">登入</div>
                <div className="text-sm opacity-90 mt-1">使用現有帳號登入</div>
              </Link>
              <Link
                href="/register"
                className="p-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-center"
              >
                <div className="text-3xl mb-2">✨</div>
                <div className="font-semibold text-lg">註冊</div>
                <div className="text-sm opacity-90 mt-1">建立新帳號</div>
              </Link>
              <Link
                href="/test"
                className="p-6 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-center md:col-span-2"
              >
                <div className="text-3xl mb-2">🧪</div>
                <div className="font-semibold text-lg">測試頁面</div>
                <div className="text-sm opacity-90 mt-1">無需登入即可測試</div>
              </Link>
            </>
          )}
        </div>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>📝 專案狀態：開發中</p>
          <p>
            <a
              href="https://github.com/ChArLiiZ/Aetheria"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              查看 GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
