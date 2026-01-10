'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui';
import { Container, Grid, Header, Stack } from '@/components/layout';
import { Globe, User, BookOpen, Settings, Book, LogOut } from '@/components/icons';

function DashboardContent() {
  const { user, logout } = useAuth();

  const quickActions = [
    {
      href: '/worlds',
      icon: Globe,
      title: '世界觀',
      description: '建立與管理世界觀設定',
    },
    {
      href: '/characters',
      icon: User,
      title: '角色',
      description: '建立與編輯角色卡',
    },
    {
      href: '/stories',
      icon: BookOpen,
      title: '故事',
      description: '開始新故事或繼續遊玩',
    },
    {
      href: '/settings',
      icon: Settings,
      title: '設定',
      description: 'AI 設定與偏好',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header
        title="Aetheria"
        subtitle="Dashboard"
        actions={
          <Stack direction="row" spacing="sm" align="center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.display_name}
              </span>
            </div>
            <Button variant="danger" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">登出</span>
            </Button>
          </Stack>
        }
        sticky
      />

      {/* Main Content */}
      <main className="py-8">
        <Container>
          <Stack spacing="lg">
            {/* Welcome Section */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                歡迎回來，{user?.display_name}！
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                從這裡開始管理您的世界觀、角色與故事
              </p>
            </div>

            {/* Quick Actions */}
            <Grid
              cols={1}
              responsive={{ sm: 2, lg: 4 }}
              gap="md"
            >
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href}>
                    <Card variant="elevated" className="h-full hover:shadow-xl transition-shadow cursor-pointer">
                      <CardContent>
                        <Stack spacing="sm">
                          <div className="text-4xl mb-2">
                            <Icon className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {action.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {action.description}
                          </p>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </Grid>

            {/* Recent Stories Section */}
            <Card>
              <CardHeader>
                <CardTitle>最近的故事</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Book className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    您還沒有建立任何故事
                  </p>
                  <Link href="/stories/new">
                    <Button>
                      <BookOpen className="w-4 h-4 mr-2" />
                      建立第一個故事
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Development Notice */}
            <Alert variant="warning" title="開發中">
              Dashboard 頁面正在開發中。世界觀、角色與故事管理功能將陸續加入。
            </Alert>
          </Stack>
        </Container>
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
