'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Character } from '@/types';
import { getCharacterById } from '@/services/supabase/characters';
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
import { Loader2, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface CharacterDetailsDialogProps {
    characterId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CharacterDetailsDialog({ characterId, open, onOpenChange }: CharacterDetailsDialogProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [character, setCharacter] = useState<Character | null>(null);
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && characterId && user?.user_id) {
            const fetchData = async () => {
                try {
                    setLoading(true);
                    const [charData, tagsData] = await Promise.all([
                        getCharacterById(characterId, user.user_id),
                        getEntityTags('character', characterId, user.user_id),
                    ]);

                    if (charData) {
                        setCharacter(charData);
                        setTags(tagsData);
                    } else {
                        toast.error('找不到此角色');
                        onOpenChange(false);
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
            setCharacter(null);
            setTags([]);
        }
    }, [open, characterId, user?.user_id, onOpenChange]);

    const handleEdit = () => {
        if (characterId) {
            onOpenChange(false);
            router.push(`/characters/${characterId}/edit`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span className="truncate">{loading ? '載入中...' : character?.canonical_name}</span>
                        {!loading && character && (
                            <Button size="sm" variant="outline" onClick={handleEdit}>
                                <Edit className="mr-2 h-4 w-4" /> 編輯
                            </Button>
                        )}
                    </DialogTitle>
                    {!loading && character && (
                        <div className="flex flex-wrap gap-2 mt-2">
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
