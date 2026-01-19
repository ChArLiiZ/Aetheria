'use client';

import { useCallback, useRef, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LongPressCardProps {
    children: ReactNode;
    className?: string;
    /**
     * 是否處於多選模式
     */
    isSelectMode: boolean;
    /**
     * 長按觸發多選模式的 callback
     */
    onEnterSelectMode: () => void;
    /**
     * 一般點擊時的 callback（非多選模式）
     */
    onClick: () => void;
    /**
     * 多選模式下的點擊 callback
     */
    onSelectModeClick?: () => void;
    /**
     * 長按時間（毫秒）
     * @default 500
     */
    longPressThreshold?: number;
}

/**
 * 支援長按進入多選模式的卡片組件
 */
export function LongPressCard({
    children,
    className,
    isSelectMode,
    onEnterSelectMode,
    onClick,
    onSelectModeClick,
    longPressThreshold = 500,
}: LongPressCardProps) {
    const isLongPressRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);

    const start = useCallback((clientX: number, clientY: number) => {
        isLongPressRef.current = false;
        startPosRef.current = { x: clientX, y: clientY };
        timerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            if (!isSelectMode) {
                onEnterSelectMode();
            }
        }, longPressThreshold);
    }, [isSelectMode, onEnterSelectMode, longPressThreshold]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startPosRef.current = null;
    }, []);

    const handleEnd = useCallback(() => {
        cancel();
        // 如果不是長按，則觸發對應的點擊行為
        if (!isLongPressRef.current) {
            if (isSelectMode && onSelectModeClick) {
                onSelectModeClick();
            } else if (!isSelectMode) {
                onClick();
            }
        }
    }, [cancel, isSelectMode, onClick, onSelectModeClick]);

    // 處理移動（避免滾動時觸發長按）
    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (startPosRef.current) {
            const dx = Math.abs(clientX - startPosRef.current.x);
            const dy = Math.abs(clientY - startPosRef.current.y);
            // 如果移動超過 10px，取消長按
            if (dx > 10 || dy > 10) {
                cancel();
            }
        }
    }, [cancel]);

    return (
        <Card
            className={cn("cursor-pointer", className)}
            onMouseDown={(e) => start(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={cancel}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onTouchStart={(e) => {
                const touch = e.touches[0];
                start(touch.clientX, touch.clientY);
            }}
            onTouchEnd={handleEnd}
            onTouchCancel={cancel}
            onTouchMove={(e) => {
                const touch = e.touches[0];
                handleMove(touch.clientX, touch.clientY);
            }}
            // 防止右鍵選單（主要針對手機長按）
            onContextMenu={(e) => e.preventDefault()}
        >
            {children}
        </Card>
    );
}
