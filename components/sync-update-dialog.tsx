'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, X, ArrowRight } from 'lucide-react';
import { WorldDiff, CharacterDiff } from '@/services/supabase/community';

interface SyncUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'world' | 'character';
    itemName: string;
    diff: WorldDiff | CharacterDiff;
    onSync: () => Promise<void>;
    onSkip: () => Promise<void>;
}

function DiffItem({
    label,
    oldValue,
    newValue,
    isText = false
}: {
    label: string;
    oldValue: string | null;
    newValue: string | null;
    isText?: boolean;
}) {
    if (oldValue === null && newValue === null) return null;

    return (
        <div className="border rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-sm">{label}</h4>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                <div className={`bg-red-500/10 rounded p-2 ${isText ? 'max-h-32 overflow-y-auto' : ''}`}>
                    <p className="text-xs text-muted-foreground mb-1">目前</p>
                    {oldValue ? (
                        <p className={`text-sm ${isText ? 'whitespace-pre-wrap' : ''}`}>{oldValue}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">(無)</p>
                    )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
                <div className={`bg-green-500/10 rounded p-2 ${isText ? 'max-h-32 overflow-y-auto' : ''}`}>
                    <p className="text-xs text-muted-foreground mb-1">更新後</p>
                    {newValue ? (
                        <p className={`text-sm ${isText ? 'whitespace-pre-wrap' : ''}`}>{newValue}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">(無)</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function TagsDiffItem({
    oldTags,
    newTags
}: {
    oldTags: string[];
    newTags: string[];
}) {
    return (
        <div className="border rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-sm">標籤</h4>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                <div className="bg-red-500/10 rounded p-2">
                    <p className="text-xs text-muted-foreground mb-1">目前</p>
                    <div className="flex flex-wrap gap-1">
                        {oldTags.length > 0 ? oldTags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        )) : (
                            <span className="text-sm text-muted-foreground italic">(無)</span>
                        )}
                    </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
                <div className="bg-green-500/10 rounded p-2">
                    <p className="text-xs text-muted-foreground mb-1">更新後</p>
                    <div className="flex flex-wrap gap-1">
                        {newTags.length > 0 ? newTags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        )) : (
                            <span className="text-sm text-muted-foreground italic">(無)</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SyncUpdateDialog({
    open,
    onOpenChange,
    type,
    itemName,
    diff,
    onSync,
    onSkip,
}: SyncUpdateDialogProps) {
    const [syncing, setSyncing] = useState(false);
    const [skipping, setSkipping] = useState(false);

    const handleSync = async () => {
        try {
            setSyncing(true);
            await onSync();
            onOpenChange(false);
        } catch {
            // 錯誤已在 onSync 中處理（顯示 toast），這裡捕獲以防止未處理的 promise rejection
            // 不關閉對話框，讓用戶可以重試
        } finally {
            setSyncing(false);
        }
    };

    const handleSkip = async () => {
        try {
            setSkipping(true);
            await onSkip();
            onOpenChange(false);
        } catch {
            // 錯誤已在 onSkip 中處理（顯示 toast），這裡捕獲以防止未處理的 promise rejection
            // 不關閉對話框，讓用戶可以重試
        } finally {
            setSkipping(false);
        }
    };

    const isWorldDiff = type === 'world';
    const worldDiff = diff as WorldDiff;
    const characterDiff = diff as CharacterDiff;

    // 檢查是否有任何差異
    const hasDiff = Object.values(diff).some(v => v !== null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {type === 'world' ? '世界觀' : '角色'}有可用更新
                    </DialogTitle>
                    <DialogDescription>
                        「{itemName}」的原作者已更新內容。以下是變更的部分：
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!hasDiff ? (
                        <p className="text-center text-muted-foreground py-4">
                            沒有差異（可能只有更新時間改變）
                        </p>
                    ) : (
                        <>
                            {isWorldDiff ? (
                                <>
                                    {worldDiff.name && (
                                        <DiffItem
                                            label="名稱"
                                            oldValue={worldDiff.name.old}
                                            newValue={worldDiff.name.new}
                                        />
                                    )}
                                    {worldDiff.description && (
                                        <DiffItem
                                            label="描述"
                                            oldValue={worldDiff.description.old}
                                            newValue={worldDiff.description.new}
                                            isText
                                        />
                                    )}
                                    {worldDiff.rules_text && (
                                        <DiffItem
                                            label="規則"
                                            oldValue={worldDiff.rules_text.old}
                                            newValue={worldDiff.rules_text.new}
                                            isText
                                        />
                                    )}
                                    {worldDiff.image_url && (
                                        <DiffItem
                                            label="封面圖片"
                                            oldValue={worldDiff.image_url.old ? '(已設定)' : null}
                                            newValue={worldDiff.image_url.new ? '(已設定)' : null}
                                        />
                                    )}
                                    {worldDiff.tags && (
                                        <TagsDiffItem
                                            oldTags={worldDiff.tags.old}
                                            newTags={worldDiff.tags.new}
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    {characterDiff.canonical_name && (
                                        <DiffItem
                                            label="名稱"
                                            oldValue={characterDiff.canonical_name.old}
                                            newValue={characterDiff.canonical_name.new}
                                        />
                                    )}
                                    {characterDiff.core_profile_text && (
                                        <DiffItem
                                            label="角色設定"
                                            oldValue={characterDiff.core_profile_text.old}
                                            newValue={characterDiff.core_profile_text.new}
                                            isText
                                        />
                                    )}
                                    {characterDiff.image_url && (
                                        <DiffItem
                                            label="頭像"
                                            oldValue={characterDiff.image_url.old ? '(已設定)' : null}
                                            newValue={characterDiff.image_url.new ? '(已設定)' : null}
                                        />
                                    )}
                                    {characterDiff.tags && (
                                        <TagsDiffItem
                                            oldTags={characterDiff.tags.old}
                                            newTags={characterDiff.tags.new}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSkip}
                        disabled={syncing || skipping}
                    >
                        {skipping ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <X className="mr-2 h-4 w-4" />
                        )}
                        跳過此版本
                    </Button>
                    <Button
                        onClick={handleSync}
                        disabled={syncing || skipping}
                    >
                        {syncing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        同步更新
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
