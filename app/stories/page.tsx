'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Story } from '@/types';
import { getStories, deleteStory } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, BookOpen, Play, Trash2, Calendar, Globe } from 'lucide-react';

interface StoryWithWorld extends Story {
  world_name?: string;
}

function StoriesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<StoryWithWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [storyToDelete, setStoryToDelete] = useState<{ id: string, title: string } | null>(null);

  // Load stories with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchStories = async () => {
      // 如果沒有 user_id，設定 loading = false 並返回
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch stories and worlds in parallel
        const [storiesData, worldsData] = await Promise.all([
          getStories(user.user_id),
          getWorldsByUserId(user.user_id),
        ]);

        if (cancelled) return;

        // Create a map of world_id to world_name for quick lookup
        const worldMap = new Map(
          worldsData.map((world) => [world.world_id, world.name])
        );

        // Match world names to stories
        const storiesWithWorlds = storiesData.map((story) => ({
          ...story,
          world_name: worldMap.get(story.world_id) || '未知世界觀',
        }));

        setStories(storiesWithWorlds);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load stories:', err);
        toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStories();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  // Reload stories function for use after updates
  const loadStories = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      // Fetch stories and worlds in parallel
      const [storiesData, worldsData] = await Promise.all([
        getStories(user.user_id),
        getWorldsByUserId(user.user_id),
      ]);

      // Create a map of world_id to world_name for quick lookup
      const worldMap = new Map(
        worldsData.map((world) => [world.world_id, world.name])
      );

      // Match world names to stories
      const storiesWithWorlds = storiesData.map((story) => ({
        ...story,
        world_name: worldMap.get(story.world_id) || '未知世界觀',
      }));

      setStories(storiesWithWorlds);
    } catch (err: any) {
      console.error('Failed to load stories:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (storyId: string, title: string) => {
    setStoryToDelete({ id: storyId, title });
  };

  const handleDelete = async () => {
    if (!user || !storyToDelete) return;

    try {
      setDeletingId(storyToDelete.id);
      await deleteStory(storyToDelete.id, user.user_id);
      await loadStories();
      toast.success('刪除成功！');
    } catch (err: any) {
      console.error('Failed to delete story:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setDeletingId(null);
      setStoryToDelete(null);
    }
  };

  const filteredStories = stories.filter((story) => {
    if (filter === 'all') return true;
    return story.status === filter;
  });

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">我的故事</h1>
            <p className="text-muted-foreground">
              管理你的互動故事，開始新的冒險
            </p>
          </div>
          <Link href="/stories/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              創建新故事
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full">
          <TabsList>
            <TabsTrigger value="all">全部 ({stories.length})</TabsTrigger>
            <TabsTrigger value="active">進行中 ({stories.filter(s => s.status === 'active').length})</TabsTrigger>
            <TabsTrigger value="ended">已結束 ({stories.filter(s => s.status === 'ended').length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Stories List */}
        {filteredStories.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              {filter === 'all' ? '還沒有故事' : `沒有${filter === 'active' ? '進行' : '結束'}的故事`}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {filter === 'all'
                ? '點擊「創建新故事」按鈕開始你的第一個互動故事'
                : '試試切換到其他篩選條件'}
            </p>
            {filter === 'all' && (
              <Link href="/stories/new">
                <Button>開始冒險</Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredStories.map((story) => (
              <Card key={story.story_id} className="flex flex-col hover:shadow-lg transition-shadow overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="line-clamp-1 leading-tight">{story.title}</CardTitle>
                    <Badge variant={story.status === 'active' ? 'default' : 'secondary'} className={story.status === 'active' ? 'bg-green-600 hover:bg-green-700' : ''}>
                      {story.status === 'active' ? '進行中' : '已結束'}
                    </Badge>
                  </div>
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
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {story.premise_text}
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t bg-muted/20">
                  {story.status === 'active' && (
                    <Link href={`/stories/${story.story_id}/play`} className="flex-1">
                      <Button className="w-full">
                        <Play className="mr-2 h-4 w-4" />
                        繼續
                      </Button>
                    </Link>
                  )}
                  <Link href={`/stories/${story.story_id}`} className={story.status === 'active' ? '' : 'flex-1'}>
                    <Button variant="outline" className="w-full">
                      詳情
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => confirmDelete(story.story_id, story.title)}
                    disabled={deletingId === story.story_id}
                  >
                    {deletingId === story.story_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!storyToDelete} onOpenChange={(open) => !open && setStoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除故事嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                您正在刪除「{storyToDelete?.title}」。
                刪除後將無法復原，包含所有回合記錄、角色狀態和關係數據。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                確認刪除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <ProtectedRoute>
      <StoriesPageContent />
    </ProtectedRoute>
  );
}
