'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppHeader } from '@/components/app-header';
import { Globe, User, BookOpen, Settings, Book, AlertTriangle, Play, Loader2, Sparkles, Users } from 'lucide-react';
import { Story } from '@/types';
import { getStories } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';
import { getCharacters } from '@/services/supabase/characters';
import { getStoryCharactersForStories } from '@/services/supabase/story-characters';
import { WorldDetailsDialog } from '@/components/world-details-dialog';
import { CharacterDetailsDialog } from '@/components/character-details-dialog';
import { StoryDetailsDialog } from '@/components/story-details-dialog';

interface StoryCharacterInfo {
  id: string;
  name: string;
  isPlayer: boolean;
  imageUrl?: string | null;
}

interface StoryWithWorld extends Story {
  world_name?: string;
  world_image_url?: string | null;
  characters?: StoryCharacterInfo[];
}

function DashboardContent() {
  const { user } = useAuth();
  const [recentStories, setRecentStories] = useState<StoryWithWorld[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  // Details Dialogs State
  const [viewingWorldId, setViewingWorldId] = useState<string | null>(null);
  const [viewingCharacterId, setViewingCharacterId] = useState<string | null>(null);
  const [viewingStoryId, setViewingStoryId] = useState<string | null>(null);

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

        // 同時取得故事、世界觀、角色資料
        const [storiesData, worldsData, charactersData] = await Promise.all([
          getStories(user.user_id),
          getWorldsByUserId(user.user_id),
          getCharacters(user.user_id),
        ]);

        if (cancelled) return;

        // 建立映射
        const worldMap = new Map(
          worldsData.map((world) => [world.world_id, { name: world.name, imageUrl: world.image_url }])
        );

        const characterMap = new Map(
          charactersData.map((char) => [char.character_id, { name: char.canonical_name, imageUrl: char.image_url }])
        );

        // 取得最近 3 個故事的 ID
        const sortedStories = [...storiesData].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 3);
        const storyIds = sortedStories.map(s => s.story_id);

        // 取得這些故事的角色
        const storyCharsMap = await getStoryCharactersForStories(storyIds, user.user_id);

        if (cancelled) return;

        // 組合資料
        const storiesWithData = sortedStories.map((story) => {
          const storyChars = storyCharsMap.get(story.story_id) || [];
          const worldInfo = worldMap.get(story.world_id);
          const characters: StoryCharacterInfo[] = storyChars.map((sc) => {
            const charInfo = characterMap.get(sc.character_id);
            return {
              id: sc.character_id,
              name: sc.display_name_override || charInfo?.name || '未知角色',
              isPlayer: sc.is_player,
              imageUrl: charInfo?.imageUrl,
            };
          });

          return {
            ...story,
            world_name: worldInfo?.name || '未知世界觀',
            world_image_url: worldInfo?.imageUrl,
            characters,
          };
        });

        setRecentStories(storiesWithData);
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
      href: '/community',
      icon: Users,
      title: '社群',
      description: '探索公開的世界觀與角色',
    },
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              歡迎回來，{user?.display_name}！
            </h1>
            <p className="text-muted-foreground">
              從這裡開始管理您的世界觀、角色與故事
            </p>
          </div>
        </div>

        {/* AI Quick Start Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-primary/10 p-6 md:p-8">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI 快速開始
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                沒有靈感？讓 AI 協助您快速建立獨特的世界觀與故事，只需簡單描述即可開始您的冒險。
              </p>
            </div>
            <Link href="/stories/generate">
              <Button size="lg" className="w-full md:w-auto shadow-lg hover:shadow-primary/25 transition-all">
                <Play className="mr-2 h-4 w-4 fill-current" />
                立即開始
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
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
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                {recentStories.map((story) => (
                  <Card
                    key={story.story_id}
                    className="flex flex-col hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => setViewingStoryId(story.story_id)}
                  >
                    {/* 世界觀背景橫幅 + 角色頭像 */}
                    <div className="relative h-20 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                      {story.world_image_url && (
                        <img
                          src={story.world_image_url}
                          alt={story.world_name}
                          className="absolute inset-0 w-full h-full object-cover object-center opacity-70"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

                      {/* 角色頭像疊加在底部 */}
                      {story.characters && story.characters.length > 0 && (
                        <div className="absolute bottom-2 left-2 flex -space-x-1.5">
                          {story.characters.slice(0, 3).map((char, idx) => (
                            <button
                              key={idx}
                              className={`relative w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted hover:z-10 hover:scale-110 transition-transform focus:outline-none ${char.isPlayer ? 'ring-1 ring-primary' : ''}`}
                              style={{ zIndex: story.characters!.length - idx }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setViewingCharacterId(char.id);
                              }}
                              title={char.name}
                            >
                              {char.imageUrl ? (
                                <img
                                  src={char.imageUrl}
                                  alt={char.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    {char.name.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </button>
                          ))}
                          {story.characters.length > 3 && (
                            <div className="relative w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground">+{story.characters.length - 3}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-2">
                      <CardTitle className="text-base line-clamp-1">{story.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1 text-xs mt-1 flex-wrap">
                        <span className="flex items-center">
                          <Globe className="mr-1 h-3 w-3" />
                          <button
                            className="hover:underline hover:text-primary transition-colors focus:outline-none"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setViewingWorldId(story.world_id);
                            }}
                          >
                            {story.world_name}
                          </button>
                        </span>
                        <span>•</span>
                        <span>{story.turn_count || 0} 回合</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {story.premise_text}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
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

        {/* Dialogs */}
        <WorldDetailsDialog
          worldId={viewingWorldId}
          open={!!viewingWorldId}
          onOpenChange={(open) => !open && setViewingWorldId(null)}
        />

        <CharacterDetailsDialog
          characterId={viewingCharacterId}
          open={!!viewingCharacterId}
          onOpenChange={(open) => !open && setViewingCharacterId(null)}
        />

        <StoryDetailsDialog
          storyId={viewingStoryId}
          open={!!viewingStoryId}
          onOpenChange={(open) => !open && setViewingStoryId(null)}
          onWorldClick={(id) => {
            setViewingStoryId(null);
            setTimeout(() => setViewingWorldId(id), 100);
          }}
          onCharacterClick={(id) => {
            setViewingStoryId(null);
            setTimeout(() => setViewingCharacterId(id), 100);
          }}
        />
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
