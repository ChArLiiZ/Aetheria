'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { World } from '@/types';
import { getWorldsByUserId, deleteWorld } from '@/services/supabase/worlds';
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
import { Loader2, Plus, Globe, Edit, Trash2, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function WorldsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [worldToDelete, setWorldToDelete] = useState<{ id: string, name: string } | null>(null);

  // Load worlds with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchWorlds = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const data = await getWorldsByUserId(user.user_id);
        if (cancelled) return;
        setWorlds(data);
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

    fetchWorlds();

    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  const loadWorlds = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);
      setError('');
      const data = await getWorldsByUserId(user.user_id);
      setWorlds(data);
    } catch (err: any) {
      console.error('Failed to load worlds:', err);
      setError(err.message || '載入世界觀失敗');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (worldId: string, worldName: string) => {
    setWorldToDelete({ id: worldId, name: worldName });
  };

  const handleDelete = async () => {
    if (!user || !worldToDelete) return;

    try {
      setDeletingId(worldToDelete.id);
      await deleteWorld(worldToDelete.id, user.user_id);
      await loadWorlds();
      toast.success(`已刪除世界觀「${worldToDelete.name}」`);
    } catch (err: any) {
      console.error('Failed to delete world:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setDeletingId(null);
      setWorldToDelete(null);
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
            <h1 className="text-3xl font-bold tracking-tight">我的世界觀</h1>
            <p className="text-muted-foreground">
              管理您的故事世界觀設定
            </p>
          </div>
          <Link href="/worlds/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新建世界觀
            </Button>
          </Link>
        </div>

        {/* Error Message */}
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
              建立您的第一個世界觀，開始創作故事吧！
            </p>
            <Link href="/worlds/new">
              <Button>開始建立</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {worlds.map((world) => (
              <Card key={world.world_id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{world.name}</CardTitle>
                  <CardDescription className="line-clamp-3 h-[4.5em]">
                    {world.description || '尚無描述'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center text-xs text-muted-foreground" suppressHydrationWarning>
                    <Calendar className="mr-1 h-3 w-3" />
                    建立於 {new Date(world.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t">
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

        <AlertDialog open={!!worldToDelete} onOpenChange={(open) => !open && setWorldToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除世界觀嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                您正在刪除「{worldToDelete?.name}」。
                此操作將同時刪除該世界的所有 Schema 設定、相關故事和資料。
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

export default function WorldsPage() {
  return (
    <ProtectedRoute>
      <WorldsPageContent />
    </ProtectedRoute>
  );
}
