'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Story } from '@/types';
import { getStories, deleteStory, deleteStories } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';
import { Tag, getAllTagsForType, getTagsForEntities } from '@/services/supabase/tags';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Loader2, Plus, BookOpen, Play, Trash2, Globe, Edit } from 'lucide-react';
import {
  ListToolbar,
  ListItemCheckbox,
  SortDirection,
  ViewMode,
  sortItems,
} from '@/components/list-toolbar';

interface StoryWithWorld extends Story {
  world_name?: string;
  tags?: Tag[];
}

const SORT_OPTIONS = [
  { value: 'title', label: '標題' },
  { value: 'created_at', label: '建立日期' },
  { value: 'updated_at', label: '更新日期' },
  { value: 'turn_count', label: '回合數' },
];

function StoriesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<StoryWithWorld[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [storyToDelete, setStoryToDelete] = useState<{ id: string, title: string } | null>(null);

  // QOL 功能狀態
  const [searchValue, setSearchValue] = useState('');
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [sortField, setSortField] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  // Load stories
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [storiesData, worldsData, tagsData] = await Promise.all([
          getStories(user.user_id),
          getWorldsByUserId(user.user_id),
          getAllTagsForType(user.user_id, 'story'),
        ]);

        if (cancelled) return;

        const worldMap = new Map(
          worldsData.map((world) => [world.world_id, world.name])
        );

        const storyIds = storiesData.map((s) => s.story_id);
        const tagsMap = await getTagsForEntities('story', storyIds, user.user_id);

        if (cancelled) return;

        const storiesWithData = storiesData.map((story) => ({
          ...story,
          world_name: worldMap.get(story.world_id) || '未知世界觀',
          tags: tagsMap.get(story.story_id) || [],
        }));

        setStories(storiesWithData);
        setAllTags(tagsData);
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

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  const loadStories = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      const [storiesData, worldsData, tagsData] = await Promise.all([
        getStories(user.user_id),
        getWorldsByUserId(user.user_id),
        getAllTagsForType(user.user_id, 'story'),
      ]);

      const worldMap = new Map(
        worldsData.map((world) => [world.world_id, world.name])
      );

      const storyIds = storiesData.map((s) => s.story_id);
      const tagsMap = await getTagsForEntities('story', storyIds, user.user_id);

      const storiesWithData = storiesData.map((story) => ({
        ...story,
        world_name: worldMap.get(story.world_id) || '未知世界觀',
        tags: tagsMap.get(story.story_id) || [],
      }));

      setStories(storiesWithData);
      setAllTags(tagsData);
    } catch (err: any) {
      console.error('Failed to load stories:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const allTagNames = useMemo(() => allTags.map((t) => t.name).sort(), [allTags]);

  // 狀態篩選
  const statusFilteredStories = useMemo(() => {
    if (statusFilter === 'all') return stories;
    return stories.filter((story) => story.status === statusFilter);
  }, [stories, statusFilter]);

  // 搜尋和標籤篩選 + 排序
  const filteredAndSortedStories = useMemo(() => {
    let filtered = statusFilteredStories;

    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter((story) =>
        story.title.toLowerCase().includes(searchLower) ||
        story.premise_text.toLowerCase().includes(searchLower) ||
        (story.world_name || '').toLowerCase().includes(searchLower)
      );
    }

    if (selectedTagNames.length > 0) {
      filtered = filtered.filter((story) => {
        const storyTagNames = (story.tags || []).map((t) => t.name);
        return selectedTagNames.some((tag) => storyTagNames.includes(tag));
      });
    }

    return sortItems(filtered, sortField, sortDirection, (story, field) => {
      switch (field) {
        case 'title':
          return story.title;
        case 'created_at':
          return new Date(story.created_at);
        case 'updated_at':
          return new Date(story.updated_at);
        case 'turn_count':
          return story.turn_count || 0;
        default:
          return story.title;
      }
    });
  }, [statusFilteredStories, searchValue, selectedTagNames, sortField, sortDirection]);

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedStories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedStories.map((s) => s.story_id)));
    }
  };

  const handleSelectModeChange = (enabled: boolean) => {
    setIsSelectMode(enabled);
    if (!enabled) {
      setSelectedIds(new Set());
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

  const handleBatchDelete = async () => {
    if (!user || selectedIds.size === 0) return;

    try {
      setLoading(true);
      await deleteStories(Array.from(selectedIds), user.user_id);
      await loadStories();
      toast.success(`已刪除 ${selectedIds.size} 個故事`);
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (err: any) {
      console.error('Failed to delete stories:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
      setShowBatchDeleteDialog(false);
    }
  };

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

  const renderStoryTags = (story: StoryWithWorld) => {
    const tags = story.tags || [];
    if (tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.map((tag) => (
          <Badge key={tag.tag_id} variant="outline" className="text-xs font-normal">
            {tag.name}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 space-y-6">
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

        {/* 狀態篩選 */}
        {stories.length > 0 && (
          <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList>
              <TabsTrigger value="all">全部 ({stories.length})</TabsTrigger>
              <TabsTrigger value="active">進行中 ({stories.filter(s => s.status === 'active').length})</TabsTrigger>
              <TabsTrigger value="ended">已結束 ({stories.filter(s => s.status === 'ended').length})</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* 工具列 */}
        {stories.length > 0 && (
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="搜尋故事..."
            allTags={allTagNames}
            selectedTags={selectedTagNames}
            onTagsChange={setSelectedTagNames}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(field, dir) => {
              setSortField(field);
              setSortDirection(dir);
            }}
            sortOptions={SORT_OPTIONS}
            isSelectMode={isSelectMode}
            onSelectModeChange={handleSelectModeChange}
            selectedCount={selectedIds.size}
            onDeleteSelected={() => setShowBatchDeleteDialog(true)}
            totalCount={filteredAndSortedStories.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}

        {/* Stories List */}
        {stories.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">還沒有故事</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              點擊「創建新故事」按鈕開始你的第一個互動故事
            </p>
            <Link href="/stories/new">
              <Button>開始冒險</Button>
            </Link>
          </Card>
        ) : filteredAndSortedStories.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-muted mb-4">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {statusFilter === 'all' ? '沒有符合條件的故事' : `沒有${statusFilter === 'active' ? '進行中' : '已結束'}的故事`}
            </h2>
            <p className="text-muted-foreground mb-4">
              嘗試調整搜尋條件或清除篩選
            </p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedStories.map((story) => (
              <Card
                key={story.story_id}
                className={`relative flex flex-col hover:shadow-lg transition-shadow overflow-hidden ${selectedIds.has(story.story_id) ? 'ring-2 ring-primary' : ''
                  }`}
              >
                <ListItemCheckbox
                  checked={selectedIds.has(story.story_id)}
                  onChange={() => handleToggleSelect(story.story_id)}
                  isSelectMode={isSelectMode}
                />
                <CardHeader className={isSelectMode ? 'pl-12' : ''}>
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
                    <span>-</span>
                    <span>{getStoryModeLabel(story.story_mode)}</span>
                    <span>-</span>
                    <span>{story.turn_count || 0} 回合</span>
                  </CardDescription>
                  {renderStoryTags(story)}
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
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {isSelectMode && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredAndSortedStories.length && filteredAndSortedStories.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>標題</TableHead>
                  <TableHead className="hidden md:table-cell">世界觀</TableHead>
                  <TableHead className="hidden md:table-cell">狀態</TableHead>
                  <TableHead className="hidden md:table-cell">回合</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStories.map((story) => (
                  <TableRow
                    key={story.story_id}
                    className={selectedIds.has(story.story_id) ? 'bg-muted/50' : ''}
                  >
                    {isSelectMode && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(story.story_id)}
                          onCheckedChange={() => handleToggleSelect(story.story_id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div>
                        <div className="font-medium">{story.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {story.premise_text}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(story.tags || []).map((tag) => (
                            <Badge key={tag.tag_id} variant="outline" className="text-xs">
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {story.world_name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={story.status === 'active' ? 'default' : 'secondary'} className={story.status === 'active' ? 'bg-green-600' : ''}>
                        {story.status === 'active' ? '進行中' : '已結束'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {story.turn_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {story.status === 'active' && (
                          <Link href={`/stories/${story.story_id}/play`}>
                            <Button variant="ghost" size="icon">
                              <Play className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Link href={`/stories/${story.story_id}`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => confirmDelete(story.story_id, story.title)}
                          disabled={deletingId === story.story_id}
                        >
                          {deletingId === story.story_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* 單個刪除確認 */}
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

        {/* 批次刪除確認 */}
        <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除 {selectedIds.size} 個故事嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                刪除後將無法復原，包含所有回合記錄、角色狀態和關係數據。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
