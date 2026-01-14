'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { World } from '@/types';
import { getWorldsByUserId, deleteWorld, deleteWorlds } from '@/services/supabase/worlds';
import { Tag, getTagsForEntities } from '@/services/supabase/tags';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import { Loader2, Plus, Globe, Edit, Trash2, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ListToolbar,
  ListItemCheckbox,
  SortDirection,
  TagFilterMode,
  sortItems,
  collectTagsFromItems,
} from '@/components/list-toolbar';

interface WorldWithTags extends World {
  tags?: Tag[];
}

const SORT_OPTIONS = [
  { value: 'name', label: '名稱' },
  { value: 'created_at', label: '建立日期' },
  { value: 'updated_at', label: '更新日期' },
];

function WorldsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [worldToDelete, setWorldToDelete] = useState<{ id: string, name: string } | null>(null);

  // QOL 功能狀態
  const [searchValue, setSearchValue] = useState('');
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>('and');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  // Load worlds with cancellation support
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // 載入世界觀
        const worldsData = await getWorldsByUserId(user.user_id);

        if (cancelled) return;

        // 批次載入世界觀的標籤
        const worldIds = worldsData.map((w) => w.world_id);
        const tagsMap = await getTagsForEntities('world', worldIds, user.user_id);

        if (cancelled) return;

        // 合併標籤到世界觀
        const worldsWithTags = worldsData.map((world) => ({
          ...world,
          tags: tagsMap.get(world.world_id) || [],
        }));

        setWorlds(worldsWithTags);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load worlds:', err);
        setError(err.message || '載入世界觀失敗');
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

  const loadWorlds = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);
      setError('');

      const worldsData = await getWorldsByUserId(user.user_id);

      const worldIds = worldsData.map((w) => w.world_id);
      const tagsMap = await getTagsForEntities('world', worldIds, user.user_id);

      const worldsWithTags = worldsData.map((world) => ({
        ...world,
        tags: tagsMap.get(world.world_id) || [],
      }));

      setWorlds(worldsWithTags);
    } catch (err: any) {
      console.error('Failed to load worlds:', err);
      setError(err.message || '載入世界觀失敗');
    } finally {
      setLoading(false);
    }
  };

  // 從目前項目收集所有標籤名稱用於篩選
  const allTagNames = useMemo(() => collectTagsFromItems(worlds), [worlds]);

  // 篩選和排序
  const filteredAndSortedWorlds = useMemo(() => {
    let filtered = worlds;

    // 搜尋篩選
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter((world) =>
        world.name.toLowerCase().includes(searchLower) ||
        world.description.toLowerCase().includes(searchLower)
      );
    }

    // 標籤篩選
    if (selectedTagNames.length > 0) {
      filtered = filtered.filter((world) => {
        const worldTagNames = (world.tags || []).map((t) => t.name);
        if (tagFilterMode === 'and') {
          return selectedTagNames.every((tag) => worldTagNames.includes(tag));
        } else {
          return selectedTagNames.some((tag) => worldTagNames.includes(tag));
        }
      });
    }

    // 排序
    return sortItems(filtered, sortField, sortDirection, (world, field) => {
      switch (field) {
        case 'name':
          return world.name;
        case 'created_at':
          return new Date(world.created_at);
        case 'updated_at':
          return new Date(world.updated_at);
        default:
          return world.name;
      }
    });
  }, [worlds, searchValue, selectedTagNames, tagFilterMode, sortField, sortDirection]);

  // 選取功能
  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectModeChange = (enabled: boolean) => {
    setIsSelectMode(enabled);
    if (!enabled) {
      setSelectedIds(new Set());
    }
  };

  const confirmDelete = (worldId: string, name: string) => {
    setWorldToDelete({ id: worldId, name });
  };

  const handleDelete = async () => {
    if (!user || !worldToDelete) return;

    try {
      setDeletingId(worldToDelete.id);
      await deleteWorld(worldToDelete.id, user.user_id);
      await loadWorlds();
      toast.success('刪除成功！');
    } catch (err: any) {
      console.error('Failed to delete world:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setWorldToDelete(null);
      setDeletingId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (!user || selectedIds.size === 0) return;

    try {
      setLoading(true);
      await deleteWorlds(Array.from(selectedIds), user.user_id);
      await loadWorlds();
      toast.success(`已刪除 ${selectedIds.size} 個世界觀`);
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (err: any) {
      console.error('Failed to delete worlds:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
      setShowBatchDeleteDialog(false);
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

  const renderWorldTags = (world: WorldWithTags) => {
    const tags = world.tags || [];
    if (tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {tags.map((tag) => (
          <Badge key={tag.tag_id} variant="secondary" className="text-xs font-normal">
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
            <h1 className="text-3xl font-bold tracking-tight">世界觀管理</h1>
            <p className="text-muted-foreground">
              建立與管理你的故事世界
            </p>
          </div>
          <Link href="/worlds/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新增世界觀
            </Button>
          </Link>
        </div>

        {/* 工具列 */}
        {worlds.length > 0 && (
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="搜尋世界觀..."
            allTags={allTagNames}
            selectedTags={selectedTagNames}
            onTagsChange={setSelectedTagNames}
            tagFilterMode={tagFilterMode}
            onTagFilterModeChange={setTagFilterMode}
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
            totalCount={filteredAndSortedWorlds.length}
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>錯誤</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Worlds List */}
        {worlds.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">還沒有世界觀</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              建立第一個世界觀，開始打造專屬於你的故事舞台
            </p>
            <Link href="/worlds/new">
              <Button>建立第一個世界觀</Button>
            </Link>
          </Card>
        ) : filteredAndSortedWorlds.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Globe className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">沒有符合條件的世界觀</h2>
            <p className="text-muted-foreground mb-4">
              嘗試調整搜尋條件或清除篩選
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedWorlds.map((world) => (
              <Card
                key={world.world_id}
                className={`relative flex flex-col hover:shadow-lg transition-shadow ${selectedIds.has(world.world_id) ? 'ring-2 ring-primary' : ''} ${isSelectMode ? 'cursor-pointer' : ''}`}
                onClick={isSelectMode ? () => handleToggleSelect(world.world_id) : undefined}
              >
                <ListItemCheckbox
                  checked={selectedIds.has(world.world_id)}
                  onChange={() => handleToggleSelect(world.world_id)}
                  isSelectMode={isSelectMode}
                />
                <CardHeader className={isSelectMode ? 'pl-12' : ''}>
                  <CardTitle className="line-clamp-1">{world.name}</CardTitle>
                  {renderWorldTags(world)}
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {world.description}
                  </p>
                  <div className="flex items-center text-xs text-muted-foreground mt-auto" suppressHydrationWarning>
                    <Calendar className="mr-1 h-3 w-3" />
                    建立於 {new Date(world.created_at).toLocaleDateString('zh-TW')}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/worlds/${world.world_id}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Edit className="mr-2 h-4 w-4" />
                      編輯
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => confirmDelete(world.world_id, world.name)}
                    disabled={deletingId === world.world_id}
                  >
                    {deletingId === world.world_id ? (
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

        {/* 單個刪除確認 */}
        <AlertDialog open={!!worldToDelete} onOpenChange={(open) => !open && setWorldToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除世界觀嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                您正在刪除「{worldToDelete?.name}」。
                此操作無法復原！
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
              <AlertDialogTitle>確定要刪除 {selectedIds.size} 個世界觀嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作無法復原！
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

export default function WorldsPage() {
  return (
    <ProtectedRoute>
      <WorldsPageContent />
    </ProtectedRoute>
  );
}
