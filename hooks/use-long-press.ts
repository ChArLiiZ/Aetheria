'use client';

import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
    /**
     * 長按時間（毫秒）
     * @default 500
     */
    threshold?: number;
    /**
     * 長按觸發時的 callback
     */
    onLongPress: () => void;
    /**
     * 短點擊時的 callback（可選）
     */
    onClick?: () => void;
}

interface UseLongPressResult {
    onMouseDown: () => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onTouchStart: () => void;
    onTouchEnd: () => void;
}

/**
 * 長按 Hook
 * 用於偵測長按事件（適用於桌面和行動裝置）
 */
export function useLongPress({
    threshold = 500,
    onLongPress,
    onClick,
}: UseLongPressOptions): UseLongPressResult {
    const isLongPressRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const start = useCallback(() => {
        isLongPressRef.current = false;
        timerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            onLongPress();
        }, threshold);
    }, [onLongPress, threshold]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handleEnd = useCallback(() => {
        cancel();
        // 如果不是長按，且有 onClick callback，則觸發點擊
        if (!isLongPressRef.current && onClick) {
            onClick();
        }
    }, [cancel, onClick]);

    return {
        onMouseDown: start,
        onMouseUp: handleEnd,
        onMouseLeave: cancel,
        onTouchStart: start,
        onTouchEnd: handleEnd,
    };
}
