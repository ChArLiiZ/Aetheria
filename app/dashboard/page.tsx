'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppHeader } from '@/components/app-header';
import { Globe, User, BookOpen, Settings, Book, AlertTriangle } from 'lucide-react';

function DashboardContent() {
  const { user } = useAuth();

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
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            歡迎回來，{user?.display_name}！
          </h1>
          <p className="text-muted-foreground">
            從這裡開始管理您的世界觀、角色與故事
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {action.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {/* Maybe count here later */}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Recent Stories Section */}
        <Card>
          <CardHeader>
            <CardTitle>最近的故事</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Book className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                您還沒有建立任何故事
              </p>
              <Link href="/stories/new">
                <Button>
                  <BookOpen className="mr-2 h-4 w-4" />
                  建立第一個故事
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Development Notice */}
        <Alert variant="default" className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>開發中</AlertTitle>
          <AlertDescription>
            Dashboard 頁面正在開發中。世界觀、角色與故事管理功能將陸續加入。
          </AlertDescription>
        </Alert>
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
