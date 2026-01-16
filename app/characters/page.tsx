'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Character } from '@/types';
import { getCharacters, deleteCharacter, deleteCharacters } from '@/services/supabase/characters';
import { Tag, getTagsForEntities } from '@/services/supabase/tags';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Loader2, Plus, User, Edit, Trash2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  ListToolbar,
  ListItemCheckbox,
  SortDirection,
  TagFilterMode,
  sortItems,
  collectTagsFromItems,
} from '@/components/list-toolbar';
import { CharacterDetailsDialog } from '@/components/character-details-dialog';

interface CharacterWithTags extends Character {
  tags?: Tag[];
}

const SORT_OPTIONS = [
  { value: 'canonical_name', label: '名稱' },
  { value: 'created_at', label: '建立日期' },
  { value: 'updated_at', label: '更新日期' },
];

function CharactersListPageContent() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<CharacterWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<{ id: string, name: string } | null>(null);

  // QOL 功能狀態
  const [searchValue, setSearchValue] = useState('');
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>('and');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [viewingCharacterId, setViewingCharacterId] = useState<string | null>(null);

  // Load characters
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const charactersData = await getCharacters(user.user_id);

        if (cancelled) return;

        const characterIds = charactersData.map((c) => c.character_id);
        const tagsMap = await getTagsForEntities('character', characterIds, user.user_id);

        if (cancelled) return;

        const charactersWithTags = charactersData.map((char) => ({
          ...char,
          tags: tagsMap.get(char.character_id) || [],
        }));

        setCharacters(charactersWithTags);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load characters:', err);
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

  const loadCharacters = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      const charactersData = await getCharacters(user.user_id);

      const characterIds = charactersData.map((c) => c.character_id);
      const tagsMap = await getTagsForEntities('character', characterIds, user.user_id);

      const charactersWithTags = charactersData.map((char) => ({
        ...char,
        tags: tagsMap.get(char.character_id) || [],
      }));

      setCharacters(charactersWithTags);
    } catch (err: any) {
      console.error('Failed to load characters:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  // 從目前項目收集所有標籤名稱用於篩選
  const allTagNames = useMemo(() => collectTagsFromItems(characters), [characters]);

  // 篩選和排序
  const filteredAndSortedCharacters = useMemo(() => {
    let filtered = characters;

    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter((char) =>
        char.canonical_name.toLowerCase().includes(searchLower) ||
        char.core_profile_text.toLowerCase().includes(searchLower)
      );
    }

    if (selectedTagNames.length > 0) {
      filtered = filtered.filter((char) => {
        const charTagNames = (char.tags || []).map((t) => t.name);
        if (tagFilterMode === 'and') {
          return selectedTagNames.every((tag) => charTagNames.includes(tag));
        } else {
          return selectedTagNames.some((tag) => charTagNames.includes(tag));
        }
      });
    }

    return sortItems(filtered, sortField, sortDirection, (char, field) => {
      switch (field) {
        case 'canonical_name':
          return char.canonical_name;
        case 'created_at':
          return new Date(char.created_at);
        case 'updated_at':
          return new Date(char.updated_at);
        default:
          return char.canonical_name;
      }
    });
  }, [characters, searchValue, selectedTagNames, tagFilterMode, sortField, sortDirection]);

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

  const confirmDelete = (characterId: string, name: string) => {
    setCharacterToDelete({ id: characterId, name });
  };

  const handleDelete = async () => {
    if (!user || !characterToDelete) return;

    try {
      setDeletingId(characterToDelete.id);
      await deleteCharacter(characterToDelete.id, user.user_id);
      await loadCharacters();
      toast.success('刪除成功！');
    } catch (err: any) {
      console.error('Failed to delete character:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setCharacterToDelete(null);
      setDeletingId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (!user || selectedIds.size === 0) return;

    try {
      setLoading(true);
      await deleteCharacters(Array.from(selectedIds), user.user_id);
      await loadCharacters();
      toast.success(`已刪除 ${selectedIds.size} 個角色`);
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (err: any) {
      console.error('Failed to delete characters:', err);
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

  const renderCharacterTags = (character: CharacterWithTags) => {
    const tags = character.tags || [];
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
            <h1 className="text-3xl font-bold tracking-tight">角色管理</h1>
            <p className="text-muted-foreground">
              建立與管理跨世界共用的角色卡
            </p>
          </div>
          <Link href="/characters/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新增角色
            </Button>
          </Link>
        </div>

        {/* 工具列 */}
        {characters.length > 0 && (
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="搜尋角色..."
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
            totalCount={filteredAndSortedCharacters.length}
          />
        )}

        {/* Characters List */}
        {characters.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">還沒有任何角色</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              建立第一個角色來開始您的故事之旅
            </p>
            <Link href="/characters/new">
              <Button>建立第一個角色</Button>
            </Link>
          </Card>
        ) : filteredAndSortedCharacters.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="p-4 rounded-full bg-muted mb-4">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">沒有符合條件的角色</h2>
            <p className="text-muted-foreground mb-4">
              嘗試調整搜尋條件或清除篩選
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedCharacters.map((character) => (
              <Card
                key={character.character_id}
                className={`relative flex flex-col hover:shadow-lg transition-shadow ${selectedIds.has(character.character_id) ? 'ring-2 ring-primary' : ''} cursor-pointer`}
                onClick={isSelectMode ? () => handleToggleSelect(character.character_id) : () => setViewingCharacterId(character.character_id)}
              >
                <ListItemCheckbox
                  checked={selectedIds.has(character.character_id)}
                  onChange={() => handleToggleSelect(character.character_id)}
                  isSelectMode={isSelectMode}
                />
                <CardHeader className={isSelectMode ? 'pl-12' : ''}>
                  <CardTitle className="line-clamp-1">{character.canonical_name}</CardTitle>
                  {renderCharacterTags(character)}
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {character.core_profile_text}
                  </p>
                  <div className="flex items-center text-xs text-muted-foreground mt-auto" suppressHydrationWarning>
                    <Calendar className="mr-1 h-3 w-3" />
                    建立於 {new Date(character.created_at).toLocaleDateString('zh-TW')}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/characters/${character.character_id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Edit className="mr-2 h-4 w-4" />
                      編輯
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => confirmDelete(character.character_id, character.canonical_name)}
                    disabled={deletingId === character.character_id}
                  >
                    {deletingId === character.character_id ? (
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
        <AlertDialog open={!!characterToDelete} onOpenChange={(open) => !open && setCharacterToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除角色嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                您正在刪除「{characterToDelete?.name}」。
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
              <AlertDialogTitle>確定要刪除 {selectedIds.size} 個角色嗎？</AlertDialogTitle>
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

        <CharacterDetailsDialog
          characterId={viewingCharacterId}
          open={!!viewingCharacterId}
          onOpenChange={(open) => !open && setViewingCharacterId(null)}
        />
      </main>
    </div>
  );
}

export default function CharactersListPage() {
  return (
    <ProtectedRoute>
      <CharactersListPageContent />
    </ProtectedRoute>
  );
}
