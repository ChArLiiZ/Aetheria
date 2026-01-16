'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Story, StoryCharacter } from '@/types';
import { getStoryById } from '@/services/supabase/stories';
import { getStoryCharacters } from '@/services/supabase/story-characters';
import { getCharacterById } from '@/services/supabase/characters';
import { getWorldById } from '@/services/supabase/worlds';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
import { Loader2, Edit, Play, Globe } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface StoryDetailsDialogProps {
    storyId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onWorldClick?: (worldId: string) => void;
    onCharacterClick?: (characterId: string) => void;
}

interface StoryCharacterWithDetails extends StoryCharacter {
    canonical_name?: string;
    avatar_url?: string;
}

interface StoryWithDetails extends Story {
    world_name?: string;
}

export function StoryDetailsDialog({
    storyId,
    open,
    onOpenChange,
    onWorldClick,
    onCharacterClick
}: StoryDetailsDialogProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [story, setStory] = useState<StoryWithDetails | null>(null);
    const [characters, setCharacters] = useState<StoryCharacterWithDetails[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && storyId && user?.user_id) {
            const fetchData = async () => {
                try {
                    setLoading(true);
                    const [storyData, storyChars] = await Promise.all([
                        getStoryById(storyId, user.user_id),
                        getStoryCharacters(storyId, user.user_id),
                    ]);

                    if (storyData) {
                        let worldName = '未知世界觀';
                        try {
                            const world = await getWorldById(storyData.world_id, user.user_id);
                            if (world) worldName = world.name;
                        } catch (e) {
                            console.error('Failed to fetch world name', e);
                        }

                        setStory({ ...storyData, world_name: worldName });

                        // Fetch canonical names for characters
                        const charsWithDetails = await Promise.all(storyChars.map(async (sc) => {
                            try {
                                const charDetails = await getCharacterById(sc.character_id, user.user_id);
                                return {
                                    ...sc,
                                    canonical_name: charDetails?.canonical_name
                                };
                            } catch {
                                return sc;
                            }
                        }));

                        setCharacters(charsWithDetails);
                    } else {
                        toast.error('找不到此故事');
                        onOpenChange(false);
                    }
                } catch (err: any) {
                    console.error('Failed to load story data:', err);
                    toast.error('無法載入故事資料');
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        } else if (!open) {
            setStory(null);
            setCharacters([]);
        }
    }, [open, storyId, user?.user_id, onOpenChange]);

    const handleEdit = () => {
        if (storyId) {
            onOpenChange(false);
            router.push(`/stories/${storyId}`);
        }
    };

    const handlePlay = () => {
        if (storyId) {
            onOpenChange(false);
            router.push(`/stories/${storyId}/play`);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span className="truncate">{loading ? '載入中...' : story?.title}</span>
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            {!loading && story && (
                                <>
                                    <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md">
                                        <Globe className="h-3 w-3" />
                                        <button
                                            className="hover:underline hover:text-primary transition-colors focus:outline-none"
                                            onClick={() => onWorldClick?.(story.world_id)}
                                        >
                                            {story.world_name}
                                        </button>
                                    </span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        {story.story_mode === 'PLAYER_CHARACTER' ? '玩家角色模式' : '導演模式'}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : story ? (
                    <div className="space-y-6">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                            {story.premise_text || '無描述'}
                        </div>

                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm font-medium">登場角色</CardTitle>
                            </CardHeader>
                            <CardContent className="py-3">
                                <div className="flex flex-wrap gap-2">
                                    {characters.map(char => (
                                        <button
                                            key={char.story_character_id}
                                            className={`text-xs px-2 py-1 rounded border transition-colors focus:outline-none flex items-center gap-1.5 ${char.is_player ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted/50 border-muted text-foreground hover:bg-muted'}`}
                                            onClick={() => onCharacterClick?.(char.character_id)}
                                        >
                                            <span>{char.display_name_override || char.canonical_name}</span>
                                            {char.is_player && <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0">玩家</Badge>}
                                        </button>
                                    ))}
                                    {characters.length === 0 && <span className="text-xs text-muted-foreground">無角色</span>}
                                </div>
                            </CardContent>
                        </Card>

                        <DialogFooter className="flex gap-2 sm:justify-between sm:space-x-0">
                            <Button variant="outline" onClick={handleEdit} className="w-full sm:w-auto">
                                <Edit className="mr-2 h-4 w-4" />
                                編輯設定
                            </Button>
                            <Button onClick={handlePlay} className="w-full sm:w-auto">
                                <Play className="mr-2 h-4 w-4" />
                                繼續故事
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        無法顯示故事資料
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
