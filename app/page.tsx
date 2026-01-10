'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, CardContent, Alert, Loading } from '@/components/ui';
import { Container, Grid, Stack } from '@/components/layout';
import { LogIn, UserPlus, LayoutDashboard, Github } from '@/components/icons';

export default function Home() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  // 載入中時顯示載入畫面
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <Loading size="lg" text="載入中..." />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Container size="lg">
        <Stack spacing="lg" className="w-full">
          {/* Auth Status Bar */}
          {isAuthenticated && (
            <Alert variant="info">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
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
                <Button variant="danger" size="sm" onClick={logout}>
                  登出
                </Button>
              </div>
            </Alert>
          )}

          {/* Hero Section */}
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Aetheria
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
              AI 互動小說應用程式
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Next.js + TypeScript + Supabase + OpenRouter / OpenAI
            </p>
          </div>

          {/* Action Cards */}
          <Grid
            cols={1}
            responsive={{ md: 2 }}
            gap="md"
            className="max-w-2xl mx-auto"
          >
            {isAuthenticated ? (
              <Link href="/dashboard" className="md:col-span-2">
                <Card variant="elevated" className="h-full hover:shadow-xl transition-shadow cursor-pointer">
                  <CardContent>
                    <Stack spacing="sm" align="center" className="text-center py-4">
                      <LayoutDashboard className="w-12 h-12 text-primary-600 dark:text-primary-400 mb-2" />
                      <div className="font-semibold text-lg">進入 Dashboard</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        管理世界觀、角色與故事
                      </div>
                    </Stack>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Card variant="elevated" className="h-full hover:shadow-xl transition-shadow cursor-pointer bg-primary-600 text-white">
                    <CardContent>
                      <Stack spacing="sm" align="center" className="text-center py-4">
                        <LogIn className="w-12 h-12 mb-2" />
                        <div className="font-semibold text-lg">登入</div>
                        <div className="text-sm opacity-90">使用現有帳號登入</div>
                      </Stack>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/register">
                  <Card variant="elevated" className="h-full hover:shadow-xl transition-shadow cursor-pointer bg-success-600 text-white">
                    <CardContent>
                      <Stack spacing="sm" align="center" className="text-center py-4">
                        <UserPlus className="w-12 h-12 mb-2" />
                        <div className="font-semibold text-lg">註冊</div>
                        <div className="text-sm opacity-90">建立新帳號</div>
                      </Stack>
                    </CardContent>
                  </Card>
                </Link>
              </>
            )}
          </Grid>

          {/* Footer Info */}
          <Stack spacing="sm" className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>專案狀態：開發中</p>
            <a
              href="https://github.com/ChArLiiZ/Aetheria"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Github className="w-4 h-4" />
              查看 GitHub
            </a>
          </Stack>
        </Stack>
      </Container>
    </main>
  );
}
