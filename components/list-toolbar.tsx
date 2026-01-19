'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Search,
    X,
    Tag,
    ArrowUpDown,
    CheckSquare,
    Square,
    Trash2,
    Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 從項目中收集所有唯一標籤的輔助函數
export function collectTagsFromItems<T extends { tags?: { name: string }[] }>(items: T[]): string[] {
    const tagSet = new Set<string>();
    items.forEach((item) => {
        (item.tags || []).forEach((tag) => tagSet.add(tag.name));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-TW'));
}

export type SortDirection = 'asc' | 'desc';
export type TagFilterMode = 'and' | 'or';

export interface SortOption {
    value: string;
    label: string;
}

export interface ListToolbarProps {
    // 搜尋
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;

    // Tag 篩選
    allTags: string[];
    selectedTags: string[];
    onTagsChange: (tags: string[]) => void;
    tagFilterMode?: TagFilterMode;
    onTagFilterModeChange?: (mode: TagFilterMode) => void;

    // 排序
    sortField: string;
    sortDirection: SortDirection;
    onSortChange: (field: string, direction: SortDirection) => void;
    sortOptions: SortOption[];

    // 多選模式（可選，傳入時才顯示多選功能）
    isSelectMode?: boolean;
    onSelectModeChange?: (enabled: boolean) => void;
    selectedCount?: number;
    onDeleteSelected?: () => void;
    totalCount?: number;
}

export function ListToolbar({
    searchValue,
    onSearchChange,
    searchPlaceholder = '搜尋...',
    allTags,
    selectedTags,
    onTagsChange,
    tagFilterMode = 'and',
    onTagFilterModeChange,
    sortField,
    sortDirection,
    onSortChange,
    sortOptions,
    isSelectMode = false,
    onSelectModeChange,
    selectedCount = 0,
    onDeleteSelected,
    totalCount = 0,
}: ListToolbarProps) {
    const [tagSearchValue, setTagSearchValue] = useState('');
    const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

    const hasActiveFilters = searchValue || selectedTags.length > 0;

    // 篩選標籤列表
    const filteredTags = useMemo(() => {
        if (!tagSearchValue.trim()) return allTags;
        const searchLower = tagSearchValue.toLowerCase();
        return allTags.filter(tag => tag.toLowerCase().includes(searchLower));
    }, [allTags, tagSearchValue]);

    const handleTagToggle = (tag: string) => {
        if (selectedTags.includes(tag)) {
            onTagsChange(selectedTags.filter((t) => t !== tag));
        } else {
            onTagsChange([...selectedTags, tag]);
        }
    };

    const handleClearFilters = () => {
        onSearchChange('');
        onTagsChange([]);
    };

    const toggleSortDirection = () => {
        onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc');
    };

    const currentSortLabel = sortOptions.find((opt) => opt.value === sortField)?.label || '排序';

    return (
        <div className="space-y-3">
            {/* 主工具列 */}
            <div className="flex flex-col md:flex-row gap-3">
                {/* 搜尋框 */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="pl-9 pr-9"
                    />
                    {searchValue && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                            onClick={() => onSearchChange('')}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* 右側工具組 */}
                <div className="flex flex-wrap gap-2">
                    {/* Tag 篩選 */}
                    {allTags.length > 0 && (
                        <div className="flex">
                            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={selectedTags.length > 0 && onTagFilterModeChange ? "rounded-r-none border-r-0" : ""}
                                    >
                                        <Tag className="mr-2 h-4 w-4" />
                                        標籤
                                        {selectedTags.length > 0 && (
                                            <Badge variant="secondary" className="ml-2">
                                                {selectedTags.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="start">
                                    {/* 標籤搜尋 */}
                                    {allTags.length > 8 && (
                                        <div className="p-2 border-b">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    value={tagSearchValue}
                                                    onChange={(e) => setTagSearchValue(e.target.value)}
                                                    placeholder="搜尋標籤..."
                                                    className="h-8 pl-7 text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 標籤列表 */}
                                    <ScrollArea className={allTags.length > 10 ? "h-64" : ""}>
                                        <div className="p-2 space-y-1">
                                            {filteredTags.length === 0 ? (
                                                <div className="text-sm text-muted-foreground text-center py-4">
                                                    沒有符合的標籤
                                                </div>
                                            ) : (
                                                filteredTags.map((tag) => {
                                                    const isSelected = selectedTags.includes(tag);
                                                    return (
                                                        <div
                                                            key={tag}
                                                            className={cn(
                                                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
                                                                "hover:bg-accent hover:text-accent-foreground",
                                                                isSelected && "bg-accent"
                                                            )}
                                                            onClick={() => handleTagToggle(tag)}
                                                        >
                                                            <div className={cn(
                                                                "flex h-4 w-4 items-center justify-center rounded border",
                                                                isSelected
                                                                    ? "bg-primary border-primary text-primary-foreground"
                                                                    : "border-muted-foreground/30"
                                                            )}>
                                                                {isSelected && <Check className="h-3 w-3" />}
                                                            </div>
                                                            <span className="flex-1 truncate">{tag}</span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>

                                    {/* 底部操作 */}
                                    {selectedTags.length > 0 && (
                                        <div className="p-2 border-t">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full h-8 text-xs"
                                                onClick={() => {
                                                    onTagsChange([]);
                                                    setTagSearchValue('');
                                                }}
                                            >
                                                <X className="mr-1 h-3 w-3" />
                                                清除全部 ({selectedTags.length})
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
                            {/* 篩選模式切換 */}
                            {selectedTags.length > 0 && onTagFilterModeChange && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="rounded-l-none text-xs px-2">
                                            {tagFilterMode === 'and' ? '全部符合' : '任一符合'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-1" align="start">
                                        <div
                                            className={cn(
                                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                                                "hover:bg-accent",
                                                tagFilterMode === 'and' && "bg-accent"
                                            )}
                                            onClick={() => onTagFilterModeChange('and')}
                                        >
                                            <div className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-full border",
                                                tagFilterMode === 'and'
                                                    ? "bg-primary border-primary text-primary-foreground"
                                                    : "border-muted-foreground/30"
                                            )}>
                                                {tagFilterMode === 'and' && <Check className="h-3 w-3" />}
                                            </div>
                                            <span>全部符合</span>
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                                                "hover:bg-accent",
                                                tagFilterMode === 'or' && "bg-accent"
                                            )}
                                            onClick={() => onTagFilterModeChange('or')}
                                        >
                                            <div className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-full border",
                                                tagFilterMode === 'or'
                                                    ? "bg-primary border-primary text-primary-foreground"
                                                    : "border-muted-foreground/30"
                                            )}>
                                                {tagFilterMode === 'or' && <Check className="h-3 w-3" />}
                                            </div>
                                            <span>任一符合</span>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    )}

                    {/* 排序 */}
                    <div className="flex">
                        <Select
                            value={sortField}
                            onValueChange={(value) => onSortChange(value, sortDirection)}
                        >
                            <SelectTrigger className="w-[120px] rounded-r-none border-r-0">
                                <SelectValue placeholder="排序" />
                            </SelectTrigger>
                            <SelectContent>
                                {sortOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-l-none"
                            onClick={toggleSortDirection}
                        >
                            <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    {/* 多選模式切換 - 只在有提供 onSelectModeChange 時顯示 */}
                    {onSelectModeChange && (
                        <Button
                            variant={isSelectMode ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => onSelectModeChange(!isSelectMode)}
                        >
                            {isSelectMode ? (
                                <CheckSquare className="mr-2 h-4 w-4" />
                            ) : (
                                <Square className="mr-2 h-4 w-4" />
                            )}
                            多選
                        </Button>
                    )}

                    {/* 多選刪除按鈕 */}
                    {isSelectMode && selectedCount > 0 && onDeleteSelected && (
                        <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            刪除 ({selectedCount})
                        </Button>
                    )}
                </div>
            </div>

            {/* 活動狀態列 */}
            {(hasActiveFilters || isSelectMode) && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    {/* 選取狀態 */}
                    {isSelectMode && (
                        <span className="text-muted-foreground">
                            已選取 {selectedCount} / {totalCount} 項
                        </span>
                    )}

                    {/* 活動篩選標籤 - 最多顯示 5 個，超過的摺疊 */}
                    {selectedTags.slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={() => handleTagToggle(tag)}
                            />
                        </Badge>
                    ))}
                    {selectedTags.length > 5 && (
                        <Badge variant="outline" className="text-muted-foreground">
                            +{selectedTags.length - 5} 個標籤
                        </Badge>
                    )}

                    {/* 清除所有標籤 */}
                    {selectedTags.length > 1 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-muted-foreground"
                            onClick={() => onTagsChange([])}
                        >
                            <X className="mr-1 h-3 w-3" />
                            清除標籤
                        </Button>
                    )}

                    {/* 清除所有篩選 */}
                    {searchValue && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-muted-foreground"
                            onClick={handleClearFilters}
                        >
                            <X className="mr-1 h-3 w-3" />
                            清除全部
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// ============ 列表項目共用元件 ============

export interface ListItemCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    isSelectMode: boolean;
}

export function ListItemCheckbox({ checked, onChange, isSelectMode }: ListItemCheckboxProps) {
    if (!isSelectMode) return null;

    return (
        <div
            className="absolute top-3 left-3 z-10"
            onClick={(e) => e.stopPropagation()}
        >
            <Button
                variant={checked ? 'default' : 'outline'}
                size="icon"
                className="h-6 w-6"
                onClick={() => onChange(!checked)}
            >
                {checked ? (
                    <CheckSquare className="h-4 w-4" />
                ) : (
                    <Square className="h-4 w-4" />
                )}
            </Button>
        </div>
    );
}

// ============ 工具函數 ============

/**
 * 從 JSON 字串解析標籤陣列
 */
export function parseTags(tagsJson?: string | null): string[] {
    if (!tagsJson) return [];
    try {
        const parsed = JSON.parse(tagsJson);
        if (Array.isArray(parsed)) {
            return parsed.filter((t) => typeof t === 'string' && t.trim());
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * 從項目陣列中收集所有唯一標籤
 */
export function collectAllTags<T extends { tags_json?: string | null }>(
    items: T[]
): string[] {
    const tagSet = new Set<string>();
    items.forEach((item) => {
        parseTags(item.tags_json).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
}

/**
 * 篩選項目（搜尋 + 標籤）
 */
export function filterItems<T extends { tags_json?: string | null }>(
    items: T[],
    searchValue: string,
    selectedTags: string[],
    getSearchableText: (item: T) => string,
    tagFilterMode: TagFilterMode = 'and'
): T[] {
    return items.filter((item) => {
        // 搜尋篩選
        if (searchValue) {
            const searchLower = searchValue.toLowerCase();
            const searchableText = getSearchableText(item).toLowerCase();
            if (!searchableText.includes(searchLower)) {
                return false;
            }
        }

        // 標籤篩選
        if (selectedTags.length > 0) {
            const itemTags = parseTags(item.tags_json);
            if (tagFilterMode === 'and') {
                // AND 模式：所有選取的標籤都必須存在
                const hasAllTags = selectedTags.every((tag) => itemTags.includes(tag));
                if (!hasAllTags) {
                    return false;
                }
            } else {
                // OR 模式：只要有任一標籤匹配就通過
                const hasMatchingTag = selectedTags.some((tag) => itemTags.includes(tag));
                if (!hasMatchingTag) {
                    return false;
                }
            }
        }

        return true;
    });
}

/**
 * 排序項目
 */
export function sortItems<T>(
    items: T[],
    sortField: string,
    sortDirection: SortDirection,
    getSortValue: (item: T, field: string) => any
): T[] {
    return [...items].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);

        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal, 'zh-TW');
        } else if (aVal instanceof Date && bVal instanceof Date) {
            comparison = aVal.getTime() - bVal.getTime();
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        } else {
            comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });
}
