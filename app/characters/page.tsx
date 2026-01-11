'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Character } from '@/types';
import { getCharacters, deleteCharacter } from '@/services/supabase/characters';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
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
import { Loader2, Plus, User, Edit, Trash2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function CharactersListPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<{ id: string, name: string } | null>(null);

  // Load characters with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchCharacters = async () => {
      // 如果沒有 user_id，設定 loading = false 並返回
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getCharacters(user.user_id);
        if (cancelled) return;
        setCharacters(data);
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

    fetchCharacters();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  // Reload characters function for use after updates
  const loadCharacters = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);
      const data = await getCharacters(user.user_id);
      setCharacters(data);
    } catch (err: any) {
      console.error('Failed to load characters:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
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

  const parseTags = (tagsJson?: string): string[] => {
    if (!tagsJson) return [];
    try {
      return JSON.parse(tagsJson);
    } catch (e) {
      return [];
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
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => {
              const tags = parseTags(character.tags_json);
              return (
                <Card key={character.character_id} className="flex flex-col hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{character.canonical_name}</CardTitle>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
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
                  <CardFooter className="flex gap-2 pt-4 border-t">
                    <Link href={`/characters/${character.character_id}`} className="flex-1">
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
              );
            })}
          </div>
        )}

        {/* Delete Alert */}
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
