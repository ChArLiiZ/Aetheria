'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Character } from '@/types';
import {
  getCharacterById,
  createCharacter,
  updateCharacter,
  characterNameExists,
} from '@/services/supabase/characters';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save, Trash2, Plus } from 'lucide-react';

function CharacterEditorPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const characterId = params.characterId as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    canonical_name: '',
    core_profile_text: '',
    tags: [''],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isNewCharacter = characterId === 'new';

  // Load character with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchCharacter = async () => {
      if (isNewCharacter) {
        setLoading(false);
        return;
      }

      // 如果沒有 user_id，設定 loading = false 並返回
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getCharacterById(characterId, user.user_id);

        if (cancelled) return;

        if (!data) {
          toast.error('找不到此角色');
          router.push('/characters');
          return;
        }

        setCharacter(data);

        // Parse tags
        let tags: string[] = [''];
        if (data.tags_json) {
          try {
            tags = JSON.parse(data.tags_json);
            if (!Array.isArray(tags) || tags.length === 0) {
              tags = [''];
            }
          } catch (e) {
            tags = [''];
          }
        }

        setFormData({
          canonical_name: data.canonical_name,
          core_profile_text: data.core_profile_text,
          tags,
        });
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

    fetchCharacter();

    return () => {
      cancelled = true;
    };
  }, [characterId, user?.user_id, isNewCharacter, router]);

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.canonical_name.trim()) {
      newErrors.canonical_name = '請輸入角色名稱';
    } else if (user) {
      const exists = await characterNameExists(
        user.user_id,
        formData.canonical_name.trim(),
        isNewCharacter ? undefined : characterId
      );
      if (exists) {
        newErrors.canonical_name = '此角色名稱已存在';
      }
    }

    if (!formData.core_profile_text.trim()) {
      newErrors.core_profile_text = '請輸入角色資料';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!user) return;

    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setSaving(true);

      const validTags = formData.tags.filter((tag) => tag.trim());

      if (isNewCharacter) {
        await createCharacter(user.user_id, {
          canonical_name: formData.canonical_name.trim(),
          core_profile_text: formData.core_profile_text.trim(),
          tags: validTags.length > 0 ? validTags : undefined,
        });
        toast.success('角色建立成功！');
      } else {
        await updateCharacter(characterId, user.user_id, {
          canonical_name: formData.canonical_name.trim(),
          core_profile_text: formData.core_profile_text.trim(),
          tags: validTags.length > 0 ? validTags : undefined,
        });
        toast.success('儲存成功！');
      }

      router.push('/characters');
    } catch (err: any) {
      console.error('Failed to save character:', err);
      toast.error(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
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
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-muted-foreground text-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push('/characters')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {isNewCharacter ? '新增角色' : `編輯角色：${character?.canonical_name || ''}`}
              </h1>
              <p className="text-muted-foreground">
                {isNewCharacter
                  ? '建立一個新的角色卡（背景、性格、說話風格等）'
                  : '修改角色的核心資料'}
              </p>
            </div>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> 儲存變更
            </Button>
          </div>
        </div>

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>基本資料</CardTitle>
            <CardDescription>設定角色的名稱、屬性與詳細設定。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="char-name">角色名稱 (canonical_name)</Label>
              <Input
                id="char-name"
                placeholder="例如：艾莉亞"
                value={formData.canonical_name}
                onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
              />
              {errors.canonical_name && <p className="text-sm text-destructive">{errors.canonical_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="char-profile">核心角色資料 (背景/性格/動機/秘密/說話風格)</Label>
              <Textarea
                id="char-profile"
                placeholder="詳細描述這個角色..."
                rows={12}
                className="font-mono text-sm"
                value={formData.core_profile_text}
                onChange={(e) => setFormData({ ...formData, core_profile_text: e.target.value })}
              />
              {errors.core_profile_text && <p className="text-sm text-destructive">{errors.core_profile_text}</p>}
              <p className="text-xs text-muted-foreground">詳細的角色資料有助於 AI 更準確地扮演這個角色。</p>
            </div>

            <div className="space-y-2">
              <Label>標籤 (分類用)</Label>
              <div className="space-y-2">
                {formData.tags.map((tag, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={tag}
                      placeholder={`標籤 ${idx + 1}`}
                      onChange={(e) => {
                        const newTags = [...formData.tags];
                        newTags[idx] = e.target.value;
                        setFormData({ ...formData, tags: newTags });
                      }}
                    />
                    {formData.tags.length > 1 && (
                      <Button variant="outline" size="icon" onClick={() => {
                        const newTags = formData.tags.filter((_, i) => i !== idx);
                        setFormData({ ...formData, tags: newTags });
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setFormData({ ...formData, tags: [...formData.tags, ''] })}>
                  <Plus className="mr-2 h-4 w-4" /> 新增標籤
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4 border-t pt-4">
            <Button variant="outline" onClick={() => router.push('/characters')}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? '儲存中...' : '儲存變更'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

export default function CharacterEditorPage() {
  return (
    <ProtectedRoute>
      <CharacterEditorPageContent />
    </ProtectedRoute>
  );
}
