'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Character } from '@/types';
import { getCharacterById } from '@/services/supabase/characters';
import { getEntityTags, Tag } from '@/services/supabase/tags';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Edit } from 'lucide-react';

function CharacterDetailsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const characterId = params.characterId as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect 'new' directly to edit page
  useEffect(() => {
    if (characterId === 'new') {
      router.replace('/characters/new/edit');
    }
  }, [characterId, router]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // 'new' 由第一個 useEffect 處理 redirect
      if (characterId === 'new') return;

      // 沒有使用者時停止 loading，避免卡住
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [charData, tagsData] = await Promise.all([
          getCharacterById(characterId, user.user_id),
          getEntityTags('character', characterId, user.user_id),
        ]);

        if (cancelled) return;

        if (!charData) {
          toast.error('找不到此角色');
          router.push('/characters');
          return;
        }

        setCharacter(charData);
        setTags(tagsData);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load character:', err);
        toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
        router.push('/characters');
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
  }, [characterId, user?.user_id, router]);

  if (loading || characterId === 'new') {
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
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-muted-foreground text-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push('/characters')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {character?.canonical_name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge key={tag.tag_id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Button onClick={() => router.push(`/characters/${characterId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> 編輯角色
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>核心資料</CardTitle>
            <CardDescription>角色的詳細設定資料</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 bg-muted/50 rounded-md">
              {character?.core_profile_text || '無資料'}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CharacterPage() {
  return (
    <ProtectedRoute>
      <CharacterDetailsPage />
    </ProtectedRoute>
  );
}
