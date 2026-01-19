'use client';

import { RefreshCw, X, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { StoryUpdateCheck } from '@/services/supabase/check-story-updates';

interface StoryUpdateAlertProps {
    updateInfo: StoryUpdateCheck;
    onReset: () => void;
    onDismiss: () => void;
}

/**
 * 顯示故事相關資源更新提示的元件
 */
export function StoryUpdateAlert({
    updateInfo,
    onReset,
    onDismiss,
}: StoryUpdateAlertProps) {
    if (!updateInfo.hasUpdates) {
        return null;
    }

    // 判斷是否有狀態定義更新（需要重新開始）
    const hasSchemaUpdate = updateInfo.schemaUpdated;

    // 建構自動生效的更新說明
    const autoApplyUpdates: string[] = [];
    if (updateInfo.worldUpdated) {
        autoApplyUpdates.push('世界觀設定');
    }
    if (updateInfo.charactersUpdated.length > 0) {
        const charNames = updateInfo.charactersUpdated.slice(0, 3).join('、');
        const suffix = updateInfo.charactersUpdated.length > 3
            ? ` 等 ${updateInfo.charactersUpdated.length} 個角色`
            : '';
        autoApplyUpdates.push(`角色（${charNames}${suffix}）`);
    }

    return (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">
                發現更新
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
                {/* 自動生效的更新 */}
                {autoApplyUpdates.length > 0 && (
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        <Info className="h-3 w-3 inline mr-1" />
                        {autoApplyUpdates.join('、')}已更新，<strong>下一回合自動生效</strong>。
                    </p>
                )}

                {/* 需要重新開始的更新 */}
                {hasSchemaUpdate && (
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        狀態類型定義已更新，若要套用新設定需<strong>重新開始故事</strong>。
                    </p>
                )}

                <div className="flex gap-2 pt-1">
                    {hasSchemaUpdate && (
                        <Button
                            size="sm"
                            variant="default"
                            onClick={onReset}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            重新開始
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDismiss}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                        <X className="h-3 w-3 mr-1" />
                        {hasSchemaUpdate ? '稍後再說' : '我知道了'}
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}

