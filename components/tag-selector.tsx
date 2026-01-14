'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { X, Check, Plus, Search, Tag as TagIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tag,
    TagType,
    getTagsByType,
    searchTags,
    getOrCreateTag,
} from '@/services/supabase/tags';

interface TagSelectorProps {
    tagType: TagType;
    selectedTags: Tag[];
    onTagsChange: (tags: Tag[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function TagSelector({
    tagType,
    selectedTags,
    onTagsChange,
    placeholder = '選擇或新增標籤...',
    disabled = false,
}: TagSelectorProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // 載入所有標籤
    const loadTags = useCallback(async () => {
        if (!user?.user_id) return;

        try {
            setLoading(true);
            const tags = await getTagsByType(user.user_id, tagType);
            setAllTags(tags);
        } catch (err) {
            console.error('Failed to load tags:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.user_id, tagType]);

    useEffect(() => {
        if (open && user?.user_id) {
            loadTags();
        }
    }, [open, user?.user_id, loadTags]);

    // 篩選標籤
    const filteredTags = useMemo(() => {
        if (!search.trim()) return allTags;
        const searchLower = search.toLowerCase().trim();
        return allTags.filter((tag) =>
            tag.name.toLowerCase().includes(searchLower)
        );
    }, [allTags, search]);

    // 檢查搜尋的標籤是否已存在
    const searchTagExists = useMemo(() => {
        if (!search.trim()) return true;
        const searchLower = search.toLowerCase().trim();
        return allTags.some((tag) => tag.name.toLowerCase() === searchLower);
    }, [allTags, search]);

    // 選取標籤
    const handleSelectTag = (tag: Tag) => {
        const isSelected = selectedTags.some((t) => t.tag_id === tag.tag_id);
        if (isSelected) {
            onTagsChange(selectedTags.filter((t) => t.tag_id !== tag.tag_id));
        } else {
            onTagsChange([...selectedTags, tag]);
        }
    };

    // 移除已選取的標籤
    const handleRemoveTag = (tagId: string) => {
        onTagsChange(selectedTags.filter((t) => t.tag_id !== tagId));
    };

    // 建立新標籤
    const handleCreateTag = async () => {
        if (!user?.user_id || !search.trim() || searchTagExists) return;

        try {
            setCreating(true);
            const newTag = await getOrCreateTag(user.user_id, tagType, search.trim());
            setAllTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
            onTagsChange([...selectedTags, newTag]);
            setSearch('');
        } catch (err) {
            console.error('Failed to create tag:', err);
        } finally {
            setCreating(false);
        }
    };

    // 按 Enter 新增標籤
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !searchTagExists && search.trim()) {
            e.preventDefault();
            handleCreateTag();
        }
    };

    return (
        <div className="space-y-2">
            {/* 已選取的標籤 */}
            {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                        <Badge
                            key={tag.tag_id}
                            variant="secondary"
                            className="pl-2 pr-1 py-1 gap-1"
                        >
                            {tag.name}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => handleRemoveTag(tag.tag_id)}
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* 標籤選擇器 */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-start text-muted-foreground font-normal"
                        disabled={disabled}
                    >
                        <TagIcon className="mr-2 h-4 w-4" />
                        {placeholder}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    {/* 搜尋框 */}
                    <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                            ref={inputRef}
                            placeholder="搜尋或輸入新標籤..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                    </div>

                    {/* 標籤列表 */}
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : filteredTags.length === 0 && !search.trim() ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                尚無標籤
                            </div>
                        ) : (
                            <>
                                {filteredTags.map((tag) => {
                                    const isSelected = selectedTags.some(
                                        (t) => t.tag_id === tag.tag_id
                                    );
                                    return (
                                        <div
                                            key={tag.tag_id}
                                            className={cn(
                                                'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer',
                                                'hover:bg-accent hover:text-accent-foreground',
                                                isSelected && 'bg-accent'
                                            )}
                                            onClick={() => handleSelectTag(tag)}
                                        >
                                            <div
                                                className={cn(
                                                    'flex h-4 w-4 items-center justify-center rounded-sm border',
                                                    isSelected
                                                        ? 'bg-primary border-primary text-primary-foreground'
                                                        : 'border-muted-foreground/30'
                                                )}
                                            >
                                                {isSelected && <Check className="h-3 w-3" />}
                                            </div>
                                            <span>{tag.name}</span>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* 新增標籤選項 */}
                    {search.trim() && !searchTagExists && (
                        <>
                            <div className="border-t" />
                            <div
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
                                    'hover:bg-accent hover:text-accent-foreground',
                                    creating && 'opacity-50 pointer-events-none'
                                )}
                                onClick={handleCreateTag}
                            >
                                {creating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                <span>
                                    新增「<strong>{search.trim()}</strong>」標籤
                                </span>
                            </div>
                        </>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
