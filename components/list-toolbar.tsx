'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Search,
    X,
    Tag,
    ArrowUpDown,
    CheckSquare,
    Square,
    LayoutGrid,
    List,
    Trash2,
} from 'lucide-react';

export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';

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

    // 排序
    sortField: string;
    sortDirection: SortDirection;
    onSortChange: (field: string, direction: SortDirection) => void;
    sortOptions: SortOption[];

    // 多選模式
    isSelectMode: boolean;
    onSelectModeChange: (enabled: boolean) => void;
    selectedCount: number;
    onDeleteSelected: () => void;
    totalCount: number;

    // 檢視模式
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

export function ListToolbar({
    searchValue,
    onSearchChange,
    searchPlaceholder = '搜尋...',
    allTags,
    selectedTags,
    onTagsChange,
    sortField,
    sortDirection,
    onSortChange,
    sortOptions,
    isSelectMode,
    onSelectModeChange,
    selectedCount,
    onDeleteSelected,
    totalCount,
    viewMode,
    onViewModeChange,
}: ListToolbarProps) {
    const hasActiveFilters = searchValue || selectedTags.length > 0;

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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Tag className="mr-2 h-4 w-4" />
                                    標籤
                                    {selectedTags.length > 0 && (
                                        <Badge variant="secondary" className="ml-2">
                                            {selectedTags.length}
                                        </Badge>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 max-h-64 overflow-y-auto">
                                <DropdownMenuLabel>篩選標籤</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {allTags.map((tag) => (
                                    <DropdownMenuCheckboxItem
                                        key={tag}
                                        checked={selectedTags.includes(tag)}
                                        onCheckedChange={() => handleTagToggle(tag)}
                                    >
                                        {tag}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
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

                    {/* 多選模式切換 */}
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

                    {/* 多選刪除按鈕 */}
                    {isSelectMode && selectedCount > 0 && (
                        <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            刪除 ({selectedCount})
                        </Button>
                    )}

                    {/* 檢視模式切換 */}
                    <div className="flex border rounded-md">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="rounded-r-none border-0"
                            onClick={() => onViewModeChange('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="rounded-l-none border-0"
                            onClick={() => onViewModeChange('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
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

                    {/* 活動篩選標籤 */}
                    {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={() => handleTagToggle(tag)}
                            />
                        </Badge>
                    ))}

                    {/* 清除篩選 */}
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-muted-foreground"
                            onClick={handleClearFilters}
                        >
                            <X className="mr-1 h-3 w-3" />
                            清除篩選
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
    getSearchableText: (item: T) => string
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
            const hasMatchingTag = selectedTags.some((tag) => itemTags.includes(tag));
            if (!hasMatchingTag) {
                return false;
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
