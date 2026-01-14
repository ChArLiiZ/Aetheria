'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppHeader } from '@/components/app-header';
import { Globe, User, BookOpen, Settings, Book, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { Story } from '@/types';
import { getStories } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';

interface StoryWithWorld extends Story {
  world_name?: string;
}

function DashboardContent() {
  const { user } = useAuth();
  const [recentStories, setRecentStories] = useState<StoryWithWorld[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  // 載入最近的故事
  useEffect(() => {
    let cancelled = false;

    const fetchRecentStories = async () => {
      if (!user?.user_id) {
        setStoriesLoading(false);
        return;
      }

      try {
        setStoriesLoading(true);

        // 同時取得故事和世界觀資料
        const [storiesData, worldsData] = await Promise.all([
          getStories(user.user_id),
          getWorldsByUserId(user.user_id),
        ]);

        if (cancelled) return;

        // 建立 world_id 到 world_name 的映射
        const worldMap = new Map(
          worldsData.map((world) => [world.world_id, world.name])
        );

        // 將世界觀名稱附加到故事上，並按更新時間排序取最近 3 個
        const storiesWithWorlds = storiesData
          .map((story) => ({
            ...story,
            world_name: worldMap.get(story.world_id) || '未知世界觀',
          }))
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 3);

        setRecentStories(storiesWithWorlds);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load recent stories:', err);
      } finally {
        if (!cancelled) {
          setStoriesLoading(false);
        }
      }
    };

    fetchRecentStories();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

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

  const getStoryModeLabel = (mode: string) => {
    switch (mode) {
      case 'PLAYER_CHARACTER':
        return '角色扮演';
      case 'DIRECTOR':
        return '導演模式';
      default:
        return mode;
    }
  };

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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>最近的故事</CardTitle>
            {recentStories.length > 0 && (
              <Link href="/stories">
                <Button variant="ghost" size="sm">
                  查看全部
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {storiesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : recentStories.length === 0 ? (
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
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {recentStories.map((story) => (
                  <Card key={story.story_id} className="flex flex-col hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base line-clamp-1">{story.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-xs mt-1">
                        <span className="flex items-center">
                          <Globe className="mr-1 h-3 w-3" />
                          {story.world_name}
                        </span>
                        <span>•</span>
                        <span>{getStoryModeLabel(story.story_mode)}</span>
                        <span>•</span>
                        <span>{story.turn_count || 0} 回合</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {story.premise_text}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-2 border-t">
                      <Link href={`/stories/${story.story_id}/play`} className="w-full">
                        <Button size="sm" className="w-full">
                          <Play className="mr-2 h-3 w-3" />
                          繼續遊玩
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Development Notice */}
        <Alert variant="default" className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>開發中</AlertTitle>
          <AlertDescription>
            應用程式仍在開發階段，部分功能尚未完善，且尚未經過仔細測試，可能存在錯誤或不穩定的情況。
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
