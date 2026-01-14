// @ts-nocheck
/**
 * Tags Service (Supabase)
 * 集中式標籤管理
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';

export type TagType = 'world' | 'character' | 'story';

export interface Tag {
    tag_id: string;
    user_id: string;
    tag_type: TagType;
    name: string;
    created_at: string;
}

/**
 * 取得使用者特定類型的所有標籤
 */
export async function getTagsByType(
    userId: string,
    tagType: TagType
): Promise<Tag[]> {
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', userId)
            .eq('tag_type', tagType)
            .order('name');

        if (error) {
            throw new Error('Failed to fetch tags: ' + error.message);
        }

        return (data || []) as Tag[];
    });
}

/**
 * 搜尋標籤
 */
export async function searchTags(
    userId: string,
    tagType: TagType,
    query: string
): Promise<Tag[]> {
    return withRetry(async () => {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', userId)
            .eq('tag_type', tagType)
            .ilike('name', `%${query}%`)
            .order('name')
            .limit(20);

        if (error) {
            throw new Error('Failed to search tags: ' + error.message);
        }

        return (data || []) as Tag[];
    });
}

/**
 * 取得或建立標籤
 */
export async function getOrCreateTag(
    userId: string,
    tagType: TagType,
    name: string
): Promise<Tag> {
    const trimmedName = name.trim();

    return withRetry(async () => {
        // 先嘗試查找現有標籤
        const { data: existing } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', userId)
            .eq('tag_type', tagType)
            .eq('name', trimmedName)
            .single();

        if (existing) {
            return existing as Tag;
        }

        // 建立新標籤
        const { data: newTag, error } = await supabase
            .from('tags')
            .insert({
                user_id: userId,
                tag_type: tagType,
                name: trimmedName,
            })
            .select()
            .single();

        if (error) {
            // 可能是並發插入導致的衝突，再試一次取得
            const { data: retryExisting } = await supabase
                .from('tags')
                .select('*')
                .eq('user_id', userId)
                .eq('tag_type', tagType)
                .eq('name', trimmedName)
                .single();

            if (retryExisting) {
                return retryExisting as Tag;
            }

            throw new Error('Failed to create tag: ' + error.message);
        }

        return newTag as Tag;
    });
}

/**
 * 刪除標籤
 */
export async function deleteTag(
    tagId: string,
    userId: string
): Promise<void> {
    return withRetry(async () => {
        const { error } = await supabase
            .from('tags')
            .delete()
            .eq('tag_id', tagId)
            .eq('user_id', userId);

        if (error) {
            throw new Error('Failed to delete tag: ' + error.message);
        }
    });
}

// ============ 實體標籤關聯操作 ============

type EntityType = 'world' | 'character' | 'story';

const entityConfig = {
    world: {
        table: 'world_tags',
        idColumn: 'world_id',
    },
    character: {
        table: 'character_tags',
        idColumn: 'character_id',
    },
    story: {
        table: 'story_tags',
        idColumn: 'story_id',
    },
} as const;

/**
 * 取得實體的標籤
 */
export async function getEntityTags(
    entityType: EntityType,
    entityId: string,
    userId: string
): Promise<Tag[]> {
    const config = entityConfig[entityType];

    return withRetry(async () => {
        const { data, error } = await supabase
            .from(config.table)
            .select(`
        tag_id,
        tags (*)
      `)
            .eq(config.idColumn, entityId);

        if (error) {
            throw new Error('Failed to fetch entity tags: ' + error.message);
        }

        // 提取嵌套的 tags 資料
        return (data || []).map((item: any) => item.tags).filter(Boolean) as Tag[];
    });
}

/**
 * 設定實體的標籤（完全替換）
 */
export async function setEntityTags(
    entityType: EntityType,
    entityId: string,
    userId: string,
    tagIds: string[]
): Promise<void> {
    const config = entityConfig[entityType];

    return withRetry(async () => {
        // 先刪除所有現有關聯
        const { error: deleteError } = await supabase
            .from(config.table)
            .delete()
            .eq(config.idColumn, entityId);

        if (deleteError) {
            throw new Error('Failed to clear entity tags: ' + deleteError.message);
        }

        // 插入新的關聯
        if (tagIds.length > 0) {
            const insertData = tagIds.map((tagId) => ({
                [config.idColumn]: entityId,
                tag_id: tagId,
            }));

            const { error: insertError } = await supabase
                .from(config.table)
                .insert(insertData);

            if (insertError) {
                throw new Error('Failed to set entity tags: ' + insertError.message);
            }
        }
    });
}

/**
 * 新增實體標籤
 */
export async function addEntityTag(
    entityType: EntityType,
    entityId: string,
    tagId: string
): Promise<void> {
    const config = entityConfig[entityType];

    return withRetry(async () => {
        const { error } = await supabase
            .from(config.table)
            .insert({
                [config.idColumn]: entityId,
                tag_id: tagId,
            });

        if (error && !error.message.includes('duplicate')) {
            throw new Error('Failed to add entity tag: ' + error.message);
        }
    });
}

/**
 * 移除實體標籤
 */
export async function removeEntityTag(
    entityType: EntityType,
    entityId: string,
    tagId: string
): Promise<void> {
    const config = entityConfig[entityType];

    return withRetry(async () => {
        const { error } = await supabase
            .from(config.table)
            .delete()
            .eq(config.idColumn, entityId)
            .eq('tag_id', tagId);

        if (error) {
            throw new Error('Failed to remove entity tag: ' + error.message);
        }
    });
}

/**
 * 批次取得多個實體的標籤（用於列表頁面）
 */
export async function getTagsForEntities(
    entityType: EntityType,
    entityIds: string[],
    userId: string
): Promise<Map<string, Tag[]>> {
    if (entityIds.length === 0) {
        return new Map();
    }

    const config = entityConfig[entityType];

    return withRetry(async () => {
        const { data, error } = await supabase
            .from(config.table)
            .select(`
        ${config.idColumn},
        tag_id,
        tags (*)
      `)
            .in(config.idColumn, entityIds);

        if (error) {
            throw new Error('Failed to fetch entity tags: ' + error.message);
        }

        const result = new Map<string, Tag[]>();

        // 初始化所有 entity 的標籤陣列
        entityIds.forEach((id) => result.set(id, []));

        // 填入標籤資料
        (data || []).forEach((item: any) => {
            const entityId = item[config.idColumn];
            const tag = item.tags as Tag;
            if (tag && entityId) {
                const tags = result.get(entityId) || [];
                tags.push(tag);
                result.set(entityId, tags);
            }
        });

        return result;
    });
}

/**
 * 取得使用者所有指定類型的標籤（用於列表頁面篩選）
 */
export async function getAllTagsForType(
    userId: string,
    tagType: TagType
): Promise<Tag[]> {
    return getTagsByType(userId, tagType);
}
