'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Character } from '@/types';
import { getCharacterById } from '@/services/supabase/characters';
import { getPublicCharacterById, copyCharacterToCollection } from '@/services/supabase/community';
import { getEntityTags, Tag } from '@/services/supabase/tags';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, User, Globe, Lock, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CharacterDetailsDialogProps {
    characterId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    readOnly?: boolean;
}

export function CharacterDetailsDialog({ characterId, open, onOpenChange, readOnly = false }: CharacterDetailsDialogProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [character, setCharacter] = useState<Character | null>(null);
    const [tags, setTags] = useState<Tag[]>([]);
    const [creatorInfo, setCreatorInfo] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
    const [loading, setLoading] = useState(false);
    const [copying, setCopying] = useState(false);

    useEffect(() => {
        // readOnly 模式不需要 user，可以查看公開內容
        const canFetch = open && characterId && (readOnly || user?.user_id);

        if (canFetch) {
            const fetchData = async () => {
                try {
                    setLoading(true);

                    if (readOnly) {
                        // 唯讀模式：使用公開查詢函式
                        const publicChar = await getPublicCharacterById(characterId);

                        if (publicChar) {
                            setCharacter(publicChar);
                            // 公開查詢已包含創建者資訊
                            setCreatorInfo({
                                display_name: publicChar.creator_name,
                                avatar_url: publicChar.creator_avatar_url,
                            });
                            // 公開查詢已包含標籤（但需要轉換格式）
                            setTags(publicChar.tags || []);
                        } else {
                            toast.error('找不到此角色或該角色非公開');
                            onOpenChange(false);
                        }
                    } else {
                        // 編輯模式：使用原本的查詢函式（需要 user_id）
                        const [charData, tagsData] = await Promise.all([
                            getCharacterById(characterId, user!.user_id),
                            getEntityTags('character', characterId, user!.user_id),
                        ]);

                        if (charData) {
                            setCharacter(charData);
                            setTags(tagsData);
                            // 自己的角色，創建者就是自己
                            setCreatorInfo({
                                display_name: user!.display_name,
                                avatar_url: user!.avatar_url || null,
                            });
                        } else {
                            toast.error('找不到此角色');
                            onOpenChange(false);
                        }
                    }
                } catch (err: any) {
                    console.error('Failed to load character data:', err);
                    toast.error('無法載入角色資料');
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        } else if (!open) {
            // 關閉時重置所有狀態，避免舊資料殘留
            setCharacter(null);
            setTags([]);
            setCreatorInfo(null);
        }
    }, [open, characterId, user, readOnly, onOpenChange]);

    const handleEdit = () => {
        if (characterId) {
            onOpenChange(false);
            router.push(`/characters/${characterId}/edit`);
        }
    };

    const handleCopyToCollection = async () => {
        if (!characterId || !user?.user_id) return;

        try {
            setCopying(true);
            const newCharacterId = await copyCharacterToCollection(characterId, user.user_id);
            toast.success('已複製到我的收藏');
            onOpenChange(false);
            router.push(`/characters/${newCharacterId}/edit`);
        } catch (err: any) {
            console.error('Failed to copy character:', err);
            toast.error(err.message || '複製失敗');
        } finally {
            setCopying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span className="truncate">{loading ? '載入中...' : character?.canonical_name}</span>
                        <div className="flex gap-2">
                            {!loading && character && readOnly && user && (
                                <Button size="sm" variant="outline" onClick={handleCopyToCollection} disabled={copying}>
                                    {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                    複製到收藏
                                </Button>
                            )}
                            {!loading && character && !readOnly && (
                                <Button size="sm" variant="outline" onClick={handleEdit}>
                                    <Edit className="mr-2 h-4 w-4" /> 編輯
                                </Button>
                            )}
                        </div>
                    </DialogTitle>
                    {!loading && character && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            {/* 可見性 Badge */}
                            {character.visibility === 'public' ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                    <Globe className="h-3 w-3 mr-1" />
                                    公開
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                    <Lock className="h-3 w-3 mr-1" />
                                    私人
                                </Badge>
                            )}
                            {/* 創建者資訊 */}
                            {creatorInfo && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <span className="text-muted-foreground/60">|</span>
                                    <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                        {creatorInfo.avatar_url ? (
                                            <img
                                                src={creatorInfo.avatar_url}
                                                alt={creatorInfo.display_name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <span>{creatorInfo.display_name}</span>
                                </div>
                            )}
                            {/* 原作者資訊（如果是複製的內容） */}
                            {character.original_author_id && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <span className="text-muted-foreground/60">|</span>
                                    <span>原作者:</span>
                                    <span className="font-medium">{character.original_author_name || '未知'}</span>
                                </div>
                            )}
                            {tags.map(tag => (
                                <Badge key={tag.tag_id} variant="secondary">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                    <DialogDescription className="sr-only">
                        角色詳情
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : character ? (
                    <div className="space-y-4 mt-2">
                        {/* 角色圖片 */}
                        {character.image_url && (
                            <div className="flex justify-center">
                                <div className="w-40 h-40 rounded-lg overflow-hidden border bg-muted">
                                    <img
                                        src={character.image_url}
                                        alt={character.canonical_name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">核心資料</CardTitle>
                                <CardDescription>角色的詳細設定資料</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 bg-muted/50 rounded-md overflow-x-auto">
                                    {character.core_profile_text || '無資料'}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        無法顯示角色資料
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

