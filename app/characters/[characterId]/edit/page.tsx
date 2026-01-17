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
import { uploadImage, deleteImage } from '@/services/supabase/storage';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save, Trash2, Plus, Sparkles, FileText } from 'lucide-react';
import { AIGenerationDialog } from '@/components/ai-generation-dialog';
import { TagSelector } from '@/components/tag-selector';
import { Tag, getEntityTags, setEntityTags } from '@/services/supabase/tags';
import type { CharacterGenerationOutput } from '@/types/api/agents';
import { CHARACTER_EMPTY_TEMPLATE } from '@/lib/character-template';
import { ImageUpload } from '@/components/image-upload';

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
    });
    const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // 圖片上傳狀態
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [shouldDeleteImage, setShouldDeleteImage] = useState(false);
    const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);

    // 管理 pendingImageFile 的 object URL 生命週期，避免記憶體洩漏
    useEffect(() => {
        if (pendingImageFile) {
            const objectUrl = URL.createObjectURL(pendingImageFile);
            setPendingImagePreviewUrl(objectUrl);
            return () => {
                URL.revokeObjectURL(objectUrl);
            };
        } else {
            setPendingImagePreviewUrl(null);
        }
    }, [pendingImageFile]);

    // AI 生成對話框
    const [showAIDialog, setShowAIDialog] = useState(false);

    const isNewCharacter = characterId === 'new';

    // 插入格式範本
    const handleInsertTemplate = () => {
        if (formData.core_profile_text.trim()) {
            if (!confirm('這將覆蓋目前的角色資料，確定要繼續嗎？')) {
                return;
            }
        }
        setFormData({ ...formData, core_profile_text: CHARACTER_EMPTY_TEMPLATE });
        toast.success('已插入格式範本（僅供參考，可自由調整）');
    };

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

                setFormData({
                    canonical_name: data.canonical_name,
                    core_profile_text: data.core_profile_text,
                });

                // 載入圖片並重置暫存狀態
                setCurrentImageUrl(data.image_url || null);
                setPendingImageFile(null);
                setShouldDeleteImage(false);

                // 載入標籤
                const tags = await getEntityTags('character', characterId, user.user_id);
                setSelectedTags(tags);
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
            let finalImageUrl: string | null | undefined = undefined;

            if (isNewCharacter) {
                // 先建立角色
                const newChar = await createCharacter(user.user_id, {
                    canonical_name: formData.canonical_name.trim(),
                    core_profile_text: formData.core_profile_text.trim(),
                });

                // 如果有待上傳的圖片，上傳它
                if (pendingImageFile) {
                    try {
                        finalImageUrl = await uploadImage('characters', user.user_id, newChar.character_id, pendingImageFile);
                        // 更新角色的 image_url
                        await updateCharacter(newChar.character_id, user.user_id, {
                            canonical_name: formData.canonical_name.trim(),
                            core_profile_text: formData.core_profile_text.trim(),
                            image_url: finalImageUrl,
                        });
                    } catch (imgErr) {
                        console.error('圖片上傳失敗:', imgErr);
                        toast.error('圖片上傳失敗，但角色已建立');
                    }
                }

                // 設定標籤
                if (selectedTags.length > 0) {
                    await setEntityTags('character', newChar.character_id, user.user_id, selectedTags.map(t => t.tag_id));
                }
                toast.success('角色建立成功！');
                // 清除圖片相關狀態，避免導向後重複上傳
                setPendingImageFile(null);
                setShouldDeleteImage(false);
                // 導向新建立的角色編輯頁面
                router.replace(`/characters/${newChar.character_id}/edit`);
            } else {
                // 處理圖片刪除
                if (shouldDeleteImage && currentImageUrl) {
                    try {
                        await deleteImage('characters', user.user_id, characterId);
                        finalImageUrl = null;
                    } catch (imgErr) {
                        console.error('圖片刪除失敗:', imgErr);
                        toast.error('圖片刪除失敗，原圖片將保留');
                        // 不設定 finalImageUrl，讓 service 層保留原有值
                    }
                }

                // 處理圖片上傳
                if (pendingImageFile) {
                    try {
                        finalImageUrl = await uploadImage('characters', user.user_id, characterId, pendingImageFile);
                    } catch (imgErr) {
                        console.error('圖片上傳失敗:', imgErr);
                        toast.error('圖片上傳失敗');
                    }
                }

                await updateCharacter(characterId, user.user_id, {
                    canonical_name: formData.canonical_name.trim(),
                    core_profile_text: formData.core_profile_text.trim(),
                    image_url: finalImageUrl,
                });

                // 更新標籤
                await setEntityTags('character', characterId, user.user_id, selectedTags.map(t => t.tag_id));
                toast.success('儲存成功！');
                // 留在編輯頁面，重新載入資料
                setCurrentImageUrl(finalImageUrl !== undefined ? finalImageUrl : currentImageUrl);
                setPendingImageFile(null);
                setShouldDeleteImage(false);
            }
        } catch (err: any) {
            console.error('Failed to save character:', err);
            toast.error(`儲存失敗: ${err.message || '未知錯誤'}`);
        } finally {
            setSaving(false);
        }
    };

    // 圖片變更處理
    const handleImageChange = (file: File | null) => {
        if (file) {
            setPendingImageFile(file);
            setShouldDeleteImage(false);
        } else {
            setPendingImageFile(null);
            setShouldDeleteImage(true);
        }
    };

    // AI 生成結果處理
    const handleAIGenerated = (data: CharacterGenerationOutput) => {
        setFormData({
            canonical_name: data.canonical_name || formData.canonical_name,
            core_profile_text: data.core_profile_text || formData.core_profile_text,
        });
        // AI 生成的 tags 保留現有選取
        toast.success('AI 生成完成！請檢查並調整內容。');
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
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowAIDialog(true)}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI 生成
                            </Button>
                            <Button onClick={handleSubmit} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" /> 儲存變更
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>基本資料</CardTitle>
                        <CardDescription>設定角色的名稱、屬性與詳細設定。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 基本資訊區：圖片 + 名稱 */}
                        <div className="flex flex-col sm:flex-row gap-6">
                            {/* 角色圖片 */}
                            <div className="space-y-2">
                                <Label>角色圖片</Label>
                                <ImageUpload
                                    imageUrl={pendingImagePreviewUrl || currentImageUrl}
                                    onImageChange={handleImageChange}
                                    isLoading={saving}
                                    disabled={saving}
                                />
                                <p className="text-xs text-muted-foreground max-w-[200px]">
                                    上傳角色的代表圖片（選填）
                                </p>
                            </div>

                            {/* 角色名稱 */}
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="char-name">角色名稱 (canonical_name)</Label>
                                <Input
                                    id="char-name"
                                    placeholder="例如：艾莉亞"
                                    value={formData.canonical_name}
                                    onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
                                />
                                {errors.canonical_name && <p className="text-sm text-destructive">{errors.canonical_name}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="char-profile">核心角色資料</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleInsertTemplate}
                                >
                                    <FileText className="mr-2 h-3.5 w-3.5" />
                                    插入格式範本
                                </Button>
                            </div>
                            <Textarea
                                id="char-profile"
                                placeholder={"描述這個角色的背景、性格、說話風格等...\n\n可使用「插入格式範本」作為參考，但格式不限。"}
                                rows={14}
                                className="font-mono text-sm"
                                value={formData.core_profile_text}
                                onChange={(e) => setFormData({ ...formData, core_profile_text: e.target.value })}
                            />
                            {errors.core_profile_text && <p className="text-sm text-destructive">{errors.core_profile_text}</p>}
                            <p className="text-xs text-muted-foreground">
                                詳細的角色資料有助於 AI 更準確地扮演這個角色。格式不限，可自由發揮。
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>標籤</Label>
                            <TagSelector
                                tagType="character"
                                selectedTags={selectedTags}
                                onTagsChange={setSelectedTags}
                                placeholder="選擇或新增標籤..."
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-4 border-t pt-4">
                        <Button variant="outline" onClick={() => router.push('/characters')}>取消</Button>
                        <Button onClick={handleSubmit} disabled={saving}>
                            {saving ? '儲存中...' : '儲存變更'}
                        </Button>
                    </CardFooter>
                </Card>

                {/* AI 生成對話框 */}
                <AIGenerationDialog
                    open={showAIDialog}
                    onOpenChange={setShowAIDialog}
                    type="character"
                    currentData={{
                        canonical_name: formData.canonical_name,
                        core_profile_text: formData.core_profile_text,
                        tags: selectedTags.map(t => t.name),
                    }}
                    onGenerated={(data) => handleAIGenerated(data as CharacterGenerationOutput)}
                />
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
