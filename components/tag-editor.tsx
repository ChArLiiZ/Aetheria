'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { TagType, getTagsByType } from '@/services/supabase/tags';

interface TagEditorProps {
    tagType: TagType;
    /** 目前的標籤（字串陣列） */
    tags: string[];
    /** 當標籤變更時呼叫 */
    onTagsChange: (tags: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * 標籤編輯器
 * 用於編輯字串陣列形式的標籤，支援從現有標籤中選擇或新增
 * 不會立即寫入資料庫，只是更新字串陣列
 */
export function TagEditor({
    tagType,
    tags,
    onTagsChange,
    placeholder = '選擇或新增標籤...',
    disabled = false,
}: TagEditorProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [existingTags, setExistingTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // 載入現有標籤
    const loadTags = useCallback(async () => {
        if (!user?.user_id) return;

        try {
            setLoading(true);
            const dbTags = await getTagsByType(user.user_id, tagType);
            setExistingTags(dbTags.map(t => t.name));
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

    // 合併現有標籤和目前選擇的標籤（去重）
    const allAvailableTags = useMemo(() => {
        const combined = new Set([...existingTags, ...tags]);
        return Array.from(combined).sort((a, b) => a.localeCompare(b));
    }, [existingTags, tags]);

    // 篩選標籤
    const filteredTags = useMemo(() => {
        if (!search.trim()) return allAvailableTags;
        const searchLower = search.toLowerCase().trim();
        return allAvailableTags.filter((tag) =>
            tag.toLowerCase().includes(searchLower)
        );
    }, [allAvailableTags, search]);

    // 檢查搜尋的標籤是否已存在
    const searchTagExists = useMemo(() => {
        if (!search.trim()) return true;
        const searchLower = search.toLowerCase().trim();
        return allAvailableTags.some((tag) => tag.toLowerCase() === searchLower);
    }, [allAvailableTags, search]);

    // 選取/取消選取標籤
    const handleToggleTag = (tag: string) => {
        const isSelected = tags.includes(tag);
        if (isSelected) {
            onTagsChange(tags.filter((t) => t !== tag));
        } else {
            onTagsChange([...tags, tag]);
        }
    };

    // 移除標籤
    const handleRemoveTag = (tag: string) => {
        onTagsChange(tags.filter((t) => t !== tag));
    };

    // 新增標籤
    const handleAddTag = () => {
        if (!search.trim() || searchTagExists) return;
        onTagsChange([...tags, search.trim()]);
        setSearch('');
    };

    // 按 Enter 新增標籤
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !searchTagExists && search.trim()) {
            e.preventDefault();
            handleAddTag();
        }
    };

    return (
        <div className="space-y-2">
            {/* 已選取的標籤 */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {tags.length > 0 ? (
                    tags.map((tag) => (
                        <Badge
                            key={tag}
                            variant="secondary"
                            className="pl-2 pr-1 py-1 gap-1"
                        >
                            {tag}
                            {!disabled && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 p-0 hover:bg-transparent hover:text-destructive"
                                    onClick={() => handleRemoveTag(tag)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </Badge>
                    ))
                ) : (
                    <span className="text-xs text-muted-foreground">尚無標籤</span>
                )}
            </div>

            {/* 標籤選擇器 */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-start text-muted-foreground font-normal h-9"
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
                                尚無標籤，輸入文字新增
                            </div>
                        ) : (
                            <>
                                {filteredTags.map((tag) => {
                                    const isSelected = tags.includes(tag);
                                    const isFromDb = existingTags.includes(tag);
                                    return (
                                        <div
                                            key={tag}
                                            className={cn(
                                                'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer',
                                                'hover:bg-accent hover:text-accent-foreground',
                                                isSelected && 'bg-accent'
                                            )}
                                            onClick={() => handleToggleTag(tag)}
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
                                            <span>{tag}</span>
                                            {!isFromDb && (
                                                <Badge variant="outline" className="ml-auto text-xs px-1 py-0">
                                                    新
                                                </Badge>
                                            )}
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
                                    'hover:bg-accent hover:text-accent-foreground'
                                )}
                                onClick={handleAddTag}
                            >
                                <Plus className="h-4 w-4" />
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
