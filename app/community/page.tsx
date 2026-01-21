'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LongPressCard } from '@/components/ui/long-press-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, User, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
    getPublicWorlds,
    getPublicCharacters,
    copyWorldsToCollection,
    copyCharactersToCollection,
    PublicWorld,
    PublicCharacter,
} from '@/services/supabase/community';
import { WorldDetailsDialog } from '@/components/world-details-dialog';
import { CharacterDetailsDialog } from '@/components/character-details-dialog';
import {
    ListToolbar,
    collectTagsFromItems,
    sortItems,
    SortDirection,
    TagFilterMode,
    ListItemCheckbox,
} from '@/components/list-toolbar';

const WORLD_SORT_OPTIONS = [
    { value: 'published_at', label: '發布日期' },
    { value: 'name', label: '名稱' },
    { value: 'creator_name', label: '創建者' },
];

const CHARACTER_SORT_OPTIONS = [
    { value: 'published_at', label: '發布日期' },
    { value: 'canonical_name', label: '名稱' },
    { value: 'creator_name', label: '創建者' },
];

function CommunityContent() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'worlds' | 'characters'>('worlds');
    const [worlds, setWorlds] = useState<PublicWorld[]>([]);
    const [characters, setCharacters] = useState<PublicCharacter[]>([]);
    const [loadingWorlds, setLoadingWorlds] = useState(true);
    const [loadingCharacters, setLoadingCharacters] = useState(true);

    // Filter/Sort state - worlds
    const [worldSearch, setWorldSearch] = useState('');
    const [worldSortField, setWorldSortField] = useState('published_at');
    const [worldSortDir, setWorldSortDir] = useState<SortDirection>('desc');
    const [worldSelectedTags, setWorldSelectedTags] = useState<string[]>([]);
    const [worldTagFilterMode, setWorldTagFilterMode] = useState<TagFilterMode>('and');

    // Filter/Sort state - characters
    const [charSearch, setCharSearch] = useState('');
    const [charSortField, setCharSortField] = useState('published_at');
    const [charSortDir, setCharSortDir] = useState<SortDirection>('desc');
    const [charSelectedTags, setCharSelectedTags] = useState<string[]>([]);
    const [charTagFilterMode, setCharTagFilterMode] = useState<TagFilterMode>('and');

    // Detail dialog state
    const [viewingWorldId, setViewingWorldId] = useState<string | null>(null);
    const [viewingCharacterId, setViewingCharacterId] = useState<string | null>(null);

    // Multi-select state for batch copy
    const [isWorldSelectMode, setIsWorldSelectMode] = useState(false);
    const [selectedWorldIds, setSelectedWorldIds] = useState<Set<string>>(new Set());
    const [isCharSelectMode, setIsCharSelectMode] = useState(false);
    const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
    const [batchCopying, setBatchCopying] = useState(false);

    // Load public worlds
    useEffect(() => {
        const loadWorlds = async () => {
            try {
                setLoadingWorlds(true);
                // 排除當前用戶的內容
                const data = await getPublicWorlds(user?.user_id);
                setWorlds(data);
            } catch (err: any) {
                console.error('Failed to load public worlds:', err);
                toast.error('無法載入公開世界觀');
            } finally {
                setLoadingWorlds(false);
            }
        };
        loadWorlds();
    }, [user?.user_id]);

    // Load public characters
    useEffect(() => {
        const loadCharacters = async () => {
            try {
                setLoadingCharacters(true);
                // 排除當前用戶的內容
                const data = await getPublicCharacters(user?.user_id);
                setCharacters(data);
            } catch (err: any) {
                console.error('Failed to load public characters:', err);
                toast.error('無法載入公開角色');
            } finally {
                setLoadingCharacters(false);
            }
        };
        loadCharacters();
    }, [user?.user_id]);

    // Collect all unique tags for filtering
    const allWorldTags = useMemo(() => collectTagsFromItems(worlds), [worlds]);
    const allCharTags = useMemo(() => collectTagsFromItems(characters), [characters]);

    // Filtered and sorted worlds
    const filteredWorlds = useMemo(() => {
        let result = [...worlds];

        // Search filter
        if (worldSearch) {
            const search = worldSearch.toLowerCase();
            result = result.filter(
                (w) =>
                    w.name.toLowerCase().includes(search) ||
                    w.description.toLowerCase().includes(search) ||
                    w.creator_name.toLowerCase().includes(search)
            );
        }

        // Tag filter
        if (worldSelectedTags.length > 0) {
            result = result.filter((w) => {
                const tagNames = (w.tags || []).map((t) => t.name);
                if (worldTagFilterMode === 'and') {
                    return worldSelectedTags.every((tag) => tagNames.includes(tag));
                } else {
                    return worldSelectedTags.some((tag) => tagNames.includes(tag));
                }
            });
        }

        // Sort
        return sortItems(result, worldSortField, worldSortDir, (item, field) => {
            switch (field) {
                case 'name':
                    return item.name;
                case 'creator_name':
                    return item.creator_name;
                case 'published_at':
                default:
                    return new Date(item.published_at || item.created_at);
            }
        });
    }, [worlds, worldSearch, worldSelectedTags, worldTagFilterMode, worldSortField, worldSortDir]);

    // Filtered and sorted characters
    const filteredCharacters = useMemo(() => {
        let result = [...characters];

        // Search filter
        if (charSearch) {
            const search = charSearch.toLowerCase();
            result = result.filter(
                (c) =>
                    c.canonical_name.toLowerCase().includes(search) ||
                    c.core_profile_text.toLowerCase().includes(search) ||
                    c.creator_name.toLowerCase().includes(search)
            );
        }

        // Tag filter
        if (charSelectedTags.length > 0) {
            result = result.filter((c) => {
                const tagNames = (c.tags || []).map((t) => t.name);
                if (charTagFilterMode === 'and') {
                    return charSelectedTags.every((tag) => tagNames.includes(tag));
                } else {
                    return charSelectedTags.some((tag) => tagNames.includes(tag));
                }
            });
        }

        // Sort
        return sortItems(result, charSortField, charSortDir, (item, field) => {
            switch (field) {
                case 'canonical_name':
                    return item.canonical_name;
                case 'creator_name':
                    return item.creator_name;
                case 'published_at':
                default:
                    return new Date(item.published_at || item.created_at);
            }
        });
    }, [characters, charSearch, charSelectedTags, charTagFilterMode, charSortField, charSortDir]);

    // 切換選取
    const handleWorldToggleSelect = (id: string) => {
        const newSelected = new Set(selectedWorldIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedWorldIds(newSelected);
    };

    const handleCharToggleSelect = (id: string) => {
        const newSelected = new Set(selectedCharIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedCharIds(newSelected);
    };

    // 批次複製
    const handleBatchCopyWorlds = async () => {
        if (!user?.user_id || selectedWorldIds.size === 0) return;

        try {
            setBatchCopying(true);
            const result = await copyWorldsToCollection(Array.from(selectedWorldIds), user.user_id);
            if (result.success.length > 0) {
                toast.success(`已複製 ${result.success.length} 個世界觀到我的收藏`);
            }
            if (result.failed.length > 0) {
                toast.error(`${result.failed.length} 個世界觀複製失敗`);
            }
            setSelectedWorldIds(new Set());
            setIsWorldSelectMode(false);
        } catch (err: any) {
            console.error('Batch copy failed:', err);
            toast.error('批次複製失敗');
        } finally {
            setBatchCopying(false);
        }
    };

    const handleBatchCopyCharacters = async () => {
        if (!user?.user_id || selectedCharIds.size === 0) return;

        try {
            setBatchCopying(true);
            const result = await copyCharactersToCollection(Array.from(selectedCharIds), user.user_id);
            if (result.success.length > 0) {
                toast.success(`已複製 ${result.success.length} 個角色到我的收藏`);
            }
            if (result.failed.length > 0) {
                toast.error(`${result.failed.length} 個角色複製失敗`);
            }
            setSelectedCharIds(new Set());
            setIsCharSelectMode(false);
        } catch (err: any) {
            console.error('Batch copy failed:', err);
            toast.error('批次複製失敗');
        } finally {
            setBatchCopying(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <AppHeader />

            <main className="container mx-auto px-4 py-8 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">社群探索</h1>
                    <p className="text-muted-foreground">探索其他創作者分享的公開世界觀與角色</p>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'worlds' | 'characters')}>
                    <TabsList>
                        <TabsTrigger value="worlds" className="flex items-center gap-2">
                            <Globe className="h-4 w-4" /> 世界觀
                            {!loadingWorlds && <span className="text-xs text-muted-foreground">({filteredWorlds.length})</span>}
                        </TabsTrigger>
                        <TabsTrigger value="characters" className="flex items-center gap-2">
                            <User className="h-4 w-4" /> 角色
                            {!loadingCharacters && <span className="text-xs text-muted-foreground">({filteredCharacters.length})</span>}
                        </TabsTrigger>
                    </TabsList>

                    {/* Worlds Tab */}
                    <TabsContent value="worlds" className="mt-6 space-y-4">
                        {loadingWorlds ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <ListToolbar
                                    searchValue={worldSearch}
                                    onSearchChange={setWorldSearch}
                                    searchPlaceholder="搜尋世界觀名稱、描述或創建者..."
                                    allTags={allWorldTags}
                                    selectedTags={worldSelectedTags}
                                    onTagsChange={setWorldSelectedTags}
                                    tagFilterMode={worldTagFilterMode}
                                    onTagFilterModeChange={setWorldTagFilterMode}
                                    sortField={worldSortField}
                                    sortDirection={worldSortDir}
                                    onSortChange={(field, dir) => {
                                        setWorldSortField(field);
                                        setWorldSortDir(dir);
                                    }}
                                    sortOptions={WORLD_SORT_OPTIONS}
                                    isSelectMode={isWorldSelectMode}
                                    onSelectModeChange={(enabled) => {
                                        setIsWorldSelectMode(enabled);
                                        if (!enabled) setSelectedWorldIds(new Set());
                                    }}
                                    selectedCount={selectedWorldIds.size}
                                    totalCount={filteredWorlds.length}
                                />

                                {/* 批次複製按鈕 */}
                                {isWorldSelectMode && selectedWorldIds.size > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleBatchCopyWorlds}
                                            disabled={batchCopying}
                                        >
                                            {batchCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                            複製到收藏 ({selectedWorldIds.size})
                                        </Button>
                                    </div>
                                )}

                                {filteredWorlds.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>{worlds.length === 0 ? '目前沒有公開的世界觀' : '沒有符合篩選條件的世界觀'}</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                        {filteredWorlds.map((world) => (
                                            <LongPressCard
                                                key={world.world_id}
                                                className={`relative overflow-hidden hover:shadow-lg transition-shadow ${isWorldSelectMode && selectedWorldIds.has(world.world_id) ? 'ring-2 ring-primary' : ''}`}
                                                isSelectMode={isWorldSelectMode}
                                                onEnterSelectMode={() => {
                                                    setIsWorldSelectMode(true);
                                                    setSelectedWorldIds(new Set([world.world_id]));
                                                }}
                                                onClick={() => setViewingWorldId(world.world_id)}
                                                onSelectModeClick={() => handleWorldToggleSelect(world.world_id)}
                                            >
                                                {/* Select Checkbox */}
                                                <ListItemCheckbox
                                                    checked={selectedWorldIds.has(world.world_id)}
                                                    onChange={() => handleWorldToggleSelect(world.world_id)}
                                                    isSelectMode={isWorldSelectMode}
                                                />

                                                {/* World Image */}
                                                <div className="relative h-32 bg-gradient-to-br from-muted to-muted/50">
                                                    {world.image_url && (
                                                        <img
                                                            src={world.image_url}
                                                            alt={world.name}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                        />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                                                </div>

                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-lg line-clamp-1">{world.name}</CardTitle>
                                                    <CardDescription className="line-clamp-2">{world.description}</CardDescription>
                                                    {world.tags && world.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {world.tags.slice(0, 3).map((tag) => (
                                                                <Badge key={tag.tag_id} variant="secondary" className="text-xs font-normal">
                                                                    {tag.name}
                                                                </Badge>
                                                            ))}
                                                            {world.tags.length > 3 && (
                                                                <Badge variant="outline" className="text-xs font-normal">
                                                                    +{world.tags.length - 3}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardHeader>

                                                <CardContent className="pt-0">
                                                    {/* Creator Info */}
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                                            {world.creator_avatar_url ? (
                                                                <img
                                                                    src={world.creator_avatar_url}
                                                                    alt={world.creator_name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <User className="h-3 w-3" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="truncate">{world.creator_name}</span>
                                                    </div>
                                                </CardContent>
                                            </LongPressCard>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    {/* Characters Tab */}
                    <TabsContent value="characters" className="mt-6 space-y-4">
                        {loadingCharacters ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <ListToolbar
                                    searchValue={charSearch}
                                    onSearchChange={setCharSearch}
                                    searchPlaceholder="搜尋角色名稱、描述或創建者..."
                                    allTags={allCharTags}
                                    selectedTags={charSelectedTags}
                                    onTagsChange={setCharSelectedTags}
                                    tagFilterMode={charTagFilterMode}
                                    onTagFilterModeChange={setCharTagFilterMode}
                                    sortField={charSortField}
                                    sortDirection={charSortDir}
                                    onSortChange={(field, dir) => {
                                        setCharSortField(field);
                                        setCharSortDir(dir);
                                    }}
                                    sortOptions={CHARACTER_SORT_OPTIONS}
                                    isSelectMode={isCharSelectMode}
                                    onSelectModeChange={(enabled) => {
                                        setIsCharSelectMode(enabled);
                                        if (!enabled) setSelectedCharIds(new Set());
                                    }}
                                    selectedCount={selectedCharIds.size}
                                    totalCount={filteredCharacters.length}
                                />

                                {/* 批次複製按鈕 */}
                                {isCharSelectMode && selectedCharIds.size > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={handleBatchCopyCharacters}
                                            disabled={batchCopying}
                                        >
                                            {batchCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                            複製到收藏 ({selectedCharIds.size})
                                        </Button>
                                    </div>
                                )}

                                {filteredCharacters.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>{characters.length === 0 ? '目前沒有公開的角色' : '沒有符合篩選條件的角色'}</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                        {filteredCharacters.map((character) => (
                                            <LongPressCard
                                                key={character.character_id}
                                                className={`relative overflow-hidden hover:shadow-lg transition-shadow ${isCharSelectMode && selectedCharIds.has(character.character_id) ? 'ring-2 ring-primary' : ''}`}
                                                isSelectMode={isCharSelectMode}
                                                onEnterSelectMode={() => {
                                                    setIsCharSelectMode(true);
                                                    setSelectedCharIds(new Set([character.character_id]));
                                                }}
                                                onClick={() => setViewingCharacterId(character.character_id)}
                                                onSelectModeClick={() => handleCharToggleSelect(character.character_id)}
                                            >
                                                {/* Select Checkbox */}
                                                <ListItemCheckbox
                                                    checked={selectedCharIds.has(character.character_id)}
                                                    onChange={() => handleCharToggleSelect(character.character_id)}
                                                    isSelectMode={isCharSelectMode}
                                                />

                                                {/* Character Image */}
                                                <div className="relative h-32 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                                    {character.image_url ? (
                                                        <img
                                                            src={character.image_url}
                                                            alt={character.canonical_name}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <User className="h-12 w-12 text-muted-foreground/30" />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                                                </div>

                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-lg line-clamp-1">{character.canonical_name}</CardTitle>
                                                    <CardDescription className="line-clamp-2">{character.core_profile_text}</CardDescription>
                                                    {character.tags && character.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {character.tags.slice(0, 3).map((tag) => (
                                                                <Badge key={tag.tag_id} variant="secondary" className="text-xs font-normal">
                                                                    {tag.name}
                                                                </Badge>
                                                            ))}
                                                            {character.tags.length > 3 && (
                                                                <Badge variant="outline" className="text-xs font-normal">
                                                                    +{character.tags.length - 3}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardHeader>

                                                <CardContent className="pt-0">
                                                    {/* Creator Info */}
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                                            {character.creator_avatar_url ? (
                                                                <img
                                                                    src={character.creator_avatar_url}
                                                                    alt={character.creator_name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <User className="h-3 w-3" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="truncate">{character.creator_name}</span>
                                                    </div>
                                                </CardContent>
                                            </LongPressCard>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Detail Dialogs */}
                <WorldDetailsDialog
                    worldId={viewingWorldId}
                    open={!!viewingWorldId}
                    onOpenChange={(open) => !open && setViewingWorldId(null)}
                    readOnly
                />

                <CharacterDetailsDialog
                    characterId={viewingCharacterId}
                    open={!!viewingCharacterId}
                    onOpenChange={(open) => !open && setViewingCharacterId(null)}
                    readOnly
                />
            </main>
        </div>
    );
}

export default function CommunityPage() {
    return (
        <ProtectedRoute>
            <CommunityContent />
        </ProtectedRoute>
    );
}
