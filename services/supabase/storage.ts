/**
 * Storage Service (Supabase)
 * 
 * 圖片上傳與管理服務
 */

import { supabase } from '@/lib/supabase/client';

const BUCKET_NAME = 'images';

export type ImageEntityType = 'characters' | 'worlds';

/**
 * 產生圖片的儲存路徑
 */
export function getImagePath(
    entityType: ImageEntityType,
    userId: string,
    entityId: string
): string {
    return `${entityType}/${userId}/${entityId}.webp`;
}

/**
 * 上傳圖片到 Supabase Storage
 */
export async function uploadImage(
    entityType: ImageEntityType,
    userId: string,
    entityId: string,
    file: File | Blob
): Promise<string> {
    const path = getImagePath(entityType, userId, entityId);

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/webp',
        });

    if (error) {
        throw new Error(`上傳圖片失敗: ${error.message}`);
    }

    return getPublicUrl(path);
}

/**
 * 刪除 Storage 中的圖片
 */
export async function deleteImage(
    entityType: ImageEntityType,
    userId: string,
    entityId: string
): Promise<void> {
    const path = getImagePath(entityType, userId, entityId);

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

    if (error) {
        // 忽略檔案不存在的錯誤
        if (!error.message.includes('not found')) {
            console.error('刪除圖片失敗:', error);
        }
    }
}

/**
 * 取得圖片的公開 URL
 */
export function getPublicUrl(path: string): string {
    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);

    return data.publicUrl;
}

/**
 * 檢查圖片是否存在
 */
export async function imageExists(
    entityType: ImageEntityType,
    userId: string,
    entityId: string
): Promise<boolean> {
    const path = getImagePath(entityType, userId, entityId);

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(`${entityType}/${userId}`, {
            search: `${entityId}.webp`,
        });

    if (error) {
        return false;
    }

    return (data?.length ?? 0) > 0;
}
