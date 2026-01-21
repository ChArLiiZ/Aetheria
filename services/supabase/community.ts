/**
 * Community Service (Supabase)
 * 
 * 公開內容查詢服務
 */

import { supabase } from '@/lib/supabase/client';
import type { World, Character } from '@/types';
import type { Tag } from './tags';

export interface PublicWorld extends World {
    creator_name: string;
    creator_avatar_url: string | null;
    tags: Tag[];
}

export interface PublicCharacter extends Character {
    creator_name: string;
    creator_avatar_url: string | null;
    tags: Tag[];
}

/**
 * 取得所有公開世界觀（排除當前用戶的內容）
 * @param excludeUserId 要排除的用戶 ID（選填）
 */
export async function getPublicWorlds(excludeUserId?: string): Promise<PublicWorld[]> {
    let query = (supabase
        .from('worlds') as any)
        .select(`
      *,
      users:user_id(display_name, avatar_url),
      world_tags(tags(*))
    `)
        .eq('visibility', 'public');

    // 排除當前用戶的內容
    if (excludeUserId) {
        query = query.neq('user_id', excludeUserId);
    }

    const { data, error } = await query.order('published_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch public worlds:', error);
        throw new Error('無法載入公開世界觀');
    }

    return (data || []).map((item: any) => ({
        ...item,
        creator_name: item.users?.display_name || '未知用戶',
        creator_avatar_url: item.users?.avatar_url || null,
        tags: (item.world_tags || []).map((wt: any) => wt.tags).filter(Boolean),
        users: undefined,
        world_tags: undefined,
    }));
}

/**
 * 取得所有公開角色（排除當前用戶的內容）
 * @param excludeUserId 要排除的用戶 ID（選填）
 */
export async function getPublicCharacters(excludeUserId?: string): Promise<PublicCharacter[]> {
    let query = (supabase
        .from('characters') as any)
        .select(`
      *,
      users:user_id(display_name, avatar_url),
      character_tags(tags(*))
    `)
        .eq('visibility', 'public');

    // 排除當前用戶的內容
    if (excludeUserId) {
        query = query.neq('user_id', excludeUserId);
    }

    const { data, error } = await query.order('published_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch public characters:', error);
        throw new Error('無法載入公開角色');
    }

    return (data || []).map((item: any) => ({
        ...item,
        creator_name: item.users?.display_name || '未知用戶',
        creator_avatar_url: item.users?.avatar_url || null,
        tags: (item.character_tags || []).map((ct: any) => ct.tags).filter(Boolean),
        users: undefined,
        character_tags: undefined,
    }));
}

/**
 * 取得公開世界觀（供未登入或其他用戶查看）
 */
export async function getPublicWorldById(worldId: string): Promise<PublicWorld | null> {
    const { data, error } = await (supabase
        .from('worlds') as any)
        .select(`
      *,
      users:user_id(display_name, avatar_url),
      world_tags(tags(*))
    `)
        .eq('world_id', worldId)
        .eq('visibility', 'public')
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error('無法載入世界觀');
    }

    const result = data as any;
    return {
        ...result,
        creator_name: result.users?.display_name || '未知用戶',
        creator_avatar_url: result.users?.avatar_url || null,
        tags: (result.world_tags || []).map((wt: any) => wt.tags).filter(Boolean),
        users: undefined,
        world_tags: undefined,
    };
}

/**
 * 取得公開角色（供未登入或其他用戶查看）
 */
export async function getPublicCharacterById(characterId: string): Promise<PublicCharacter | null> {
    const { data, error } = await (supabase
        .from('characters') as any)
        .select(`
      *,
      users:user_id(display_name, avatar_url),
      character_tags(tags(*))
    `)
        .eq('character_id', characterId)
        .eq('visibility', 'public')
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error('無法載入角色');
    }

    const result = data as any;
    return {
        ...result,
        creator_name: result.users?.display_name || '未知用戶',
        creator_avatar_url: result.users?.avatar_url || null,
        tags: (result.character_tags || []).map((ct: any) => ct.tags).filter(Boolean),
        users: undefined,
        character_tags: undefined,
    };
}

/**
 * 取得公開世界觀的狀態 Schema（供未登入或其他用戶查看）
 */
export async function getPublicSchemaByWorldId(worldId: string): Promise<any[]> {
    // 先驗證該世界觀是否為公開
    const { data: world } = await supabase
        .from('worlds')
        .select('world_id')
        .eq('world_id', worldId)
        .eq('visibility', 'public')
        .single();

    if (!world) {
        return [];
    }

    const { data, error } = await supabase
        .from('world_state_schema')
        .select('*')
        .eq('world_id', worldId)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Failed to fetch public schema:', error);
        return [];
    }

    return data || [];
}

/**
 * 複製公開世界觀到自己的收藏
 * - 複製品設為私人，無法改為公開
 * - 保留原作者資訊
 * - 同時複製 Schema 和標籤
 */
export async function copyWorldToCollection(
    worldId: string,
    userId: string
): Promise<string> {
    // 1. 取得來源世界觀
    const { data: source, error: fetchError } = await (supabase
        .from('worlds') as any)
        .select('*')
        .eq('world_id', worldId)
        .eq('visibility', 'public')
        .single();

    if (fetchError || !source) {
        throw new Error('找不到此公開世界觀');
    }

    // 判斷原作者
    const originalAuthorId = source.original_author_id || source.user_id;

    // 2. 建立副本
    const { data: newWorld, error: insertError } = await (supabase
        .from('worlds') as any)
        .insert({
            user_id: userId,
            name: source.name,
            description: source.description,
            rules_text: source.rules_text,
            tags_json: source.tags_json,
            image_url: source.image_url,
            visibility: 'private', // 強制私人
            original_author_id: originalAuthorId,
            forked_from_id: worldId,
            last_synced_at: source.updated_at, // 設定為原始內容的更新時間
        })
        .select()
        .single();

    if (insertError || !newWorld) {
        throw new Error('複製世界觀失敗: ' + (insertError?.message || '未知錯誤'));
    }

    // 3. 複製 Schema
    const { data: schemas } = await supabase
        .from('world_state_schema')
        .select('*')
        .eq('world_id', worldId);

    if (schemas && schemas.length > 0) {
        const schemaInserts = schemas.map((s: any) => ({
            world_id: newWorld.world_id,
            user_id: userId,
            schema_key: s.schema_key,
            display_name: s.display_name,
            type: s.type,
            ai_description: s.ai_description,
            default_value_json: s.default_value_json,
            enum_options_json: s.enum_options_json,
            number_constraints_json: s.number_constraints_json,
            sort_order: s.sort_order,
        }));

        await (supabase.from('world_state_schema') as any).insert(schemaInserts);
    }

    // 4. 複製標籤關聯（需要為當前用戶建立對應的標籤）
    const { data: sourceTags } = await supabase
        .from('world_tags')
        .select('tags(*)')
        .eq('world_id', worldId);

    if (sourceTags && sourceTags.length > 0) {
        for (const wt of sourceTags as any[]) {
            if (!wt.tags) continue;

            // 查找或建立用戶自己的同名標籤
            let { data: existingTag } = await (supabase
                .from('tags') as any)
                .select('tag_id')
                .eq('user_id', userId)
                .eq('tag_type', 'world')
                .eq('name', wt.tags.name)
                .single();

            let tagId = (existingTag as any)?.tag_id;

            if (!tagId) {
                const { data: newTag } = await (supabase.from('tags') as any)
                    .insert({
                        user_id: userId,
                        tag_type: 'world',
                        name: wt.tags.name,
                    })
                    .select('tag_id')
                    .single();
                tagId = newTag?.tag_id;
            }

            if (tagId) {
                await (supabase.from('world_tags') as any).insert({
                    world_id: newWorld.world_id,
                    tag_id: tagId,
                });
            }
        }
    }

    return newWorld.world_id;
}

/**
 * 複製公開角色到自己的收藏
 * - 複製品設為私人，無法改為公開
 * - 保留原作者資訊
 * - 同時複製標籤
 */
export async function copyCharacterToCollection(
    characterId: string,
    userId: string
): Promise<string> {
    // 1. 取得來源角色
    const { data: source, error: fetchError } = await (supabase
        .from('characters') as any)
        .select('*')
        .eq('character_id', characterId)
        .eq('visibility', 'public')
        .single();

    if (fetchError || !source) {
        throw new Error('找不到此公開角色');
    }

    // 判斷原作者
    const originalAuthorId = source.original_author_id || source.user_id;

    // 2. 建立副本
    const { data: newCharacter, error: insertError } = await (supabase
        .from('characters') as any)
        .insert({
            user_id: userId,
            canonical_name: source.canonical_name,
            core_profile_text: source.core_profile_text,
            tags_json: source.tags_json,
            image_url: source.image_url,
            visibility: 'private', // 強制私人
            original_author_id: originalAuthorId,
            forked_from_id: characterId,
            last_synced_at: source.updated_at, // 設定為原始內容的更新時間
        })
        .select()
        .single();

    if (insertError || !newCharacter) {
        throw new Error('複製角色失敗: ' + (insertError?.message || '未知錯誤'));
    }

    // 3. 複製標籤關聯
    const { data: sourceTags } = await supabase
        .from('character_tags')
        .select('tags(*)')
        .eq('character_id', characterId);

    if (sourceTags && sourceTags.length > 0) {
        for (const ct of sourceTags as any[]) {
            if (!ct.tags) continue;

            // 查找或建立用戶自己的同名標籤
            let { data: existingTag } = await (supabase
                .from('tags') as any)
                .select('tag_id')
                .eq('user_id', userId)
                .eq('tag_type', 'character')
                .eq('name', ct.tags.name)
                .single();

            let tagId = (existingTag as any)?.tag_id;

            if (!tagId) {
                const { data: newTag } = await (supabase.from('tags') as any)
                    .insert({
                        user_id: userId,
                        tag_type: 'character',
                        name: ct.tags.name,
                    })
                    .select('tag_id')
                    .single();
                tagId = newTag?.tag_id;
            }

            if (tagId) {
                await (supabase.from('character_tags') as any).insert({
                    character_id: newCharacter.character_id,
                    tag_id: tagId,
                });
            }
        }
    }

    return newCharacter.character_id;
}

/**
 * 批次複製多個公開世界觀到自己的收藏
 */
export async function copyWorldsToCollection(
    worldIds: string[],
    userId: string
): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const worldId of worldIds) {
        try {
            await copyWorldToCollection(worldId, userId);
            success.push(worldId);
        } catch (err) {
            console.error(`Failed to copy world ${worldId}:`, err);
            failed.push(worldId);
        }
    }

    return { success, failed };
}

/**
 * 批次複製多個公開角色到自己的收藏
 */
export async function copyCharactersToCollection(
    characterIds: string[],
    userId: string
): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const characterId of characterIds) {
        try {
            await copyCharacterToCollection(characterId, userId);
            success.push(characterId);
        } catch (err) {
            console.error(`Failed to copy character ${characterId}:`, err);
            failed.push(characterId);
        }
    }

    return { success, failed };
}

// ============================================
// 版本同步功能
// ============================================

export interface UpdateInfo {
    hasUpdate: boolean;
    sourceUpdatedAt: string | null;
    lastSyncedAt: string | null;
}

export interface WorldDiff {
    name: { old: string; new: string } | null;
    description: { old: string; new: string } | null;
    rules_text: { old: string; new: string } | null;
    image_url: { old: string | null; new: string | null } | null;
    tags: { old: string[]; new: string[] } | null;
}

export interface CharacterDiff {
    canonical_name: { old: string; new: string } | null;
    core_profile_text: { old: string; new: string } | null;
    image_url: { old: string | null; new: string | null } | null;
    tags: { old: string[]; new: string[] } | null;
}

/**
 * 檢查世界觀是否有可用更新
 */
export async function checkWorldForUpdates(
    worldId: string,
    userId: string
): Promise<UpdateInfo> {
    // 取得複製品資訊
    const { data: copy, error: copyError } = await (supabase
        .from('worlds') as any)
        .select('forked_from_id, last_synced_at')
        .eq('world_id', worldId)
        .eq('user_id', userId)
        .single();

    if (copyError || !copy?.forked_from_id) {
        return { hasUpdate: false, sourceUpdatedAt: null, lastSyncedAt: null };
    }

    // 取得原始版本的更新時間
    const { data: source, error: sourceError } = await (supabase
        .from('worlds') as any)
        .select('updated_at')
        .eq('world_id', copy.forked_from_id)
        .eq('visibility', 'public')
        .single();

    if (sourceError || !source) {
        // 原始版本已刪除或設為私人
        return { hasUpdate: false, sourceUpdatedAt: null, lastSyncedAt: copy.last_synced_at };
    }

    const sourceUpdatedAt = new Date(source.updated_at).getTime();
    const lastSyncedAt = copy.last_synced_at ? new Date(copy.last_synced_at).getTime() : 0;

    return {
        hasUpdate: sourceUpdatedAt > lastSyncedAt,
        sourceUpdatedAt: source.updated_at,
        lastSyncedAt: copy.last_synced_at,
    };
}

/**
 * 檢查角色是否有可用更新
 */
export async function checkCharacterForUpdates(
    characterId: string,
    userId: string
): Promise<UpdateInfo> {
    // 取得複製品資訊
    const { data: copy, error: copyError } = await (supabase
        .from('characters') as any)
        .select('forked_from_id, last_synced_at')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .single();

    if (copyError || !copy?.forked_from_id) {
        return { hasUpdate: false, sourceUpdatedAt: null, lastSyncedAt: null };
    }

    // 取得原始版本的更新時間
    const { data: source, error: sourceError } = await (supabase
        .from('characters') as any)
        .select('updated_at')
        .eq('character_id', copy.forked_from_id)
        .eq('visibility', 'public')
        .single();

    if (sourceError || !source) {
        return { hasUpdate: false, sourceUpdatedAt: null, lastSyncedAt: copy.last_synced_at };
    }

    const sourceUpdatedAt = new Date(source.updated_at).getTime();
    const lastSyncedAt = copy.last_synced_at ? new Date(copy.last_synced_at).getTime() : 0;

    return {
        hasUpdate: sourceUpdatedAt > lastSyncedAt,
        sourceUpdatedAt: source.updated_at,
        lastSyncedAt: copy.last_synced_at,
    };
}

/**
 * 取得世界觀的差異
 */
export async function getWorldDiff(
    worldId: string,
    userId: string
): Promise<{ diff: WorldDiff; source: any } | null> {
    // 取得複製品
    const { data: copy, error: copyError } = await (supabase
        .from('worlds') as any)
        .select('*, forked_from_id')
        .eq('world_id', worldId)
        .eq('user_id', userId)
        .single();

    if (copyError || !copy?.forked_from_id) return null;

    // 取得原始版本
    const { data: source, error: sourceError } = await (supabase
        .from('worlds') as any)
        .select('*')
        .eq('world_id', copy.forked_from_id)
        .eq('visibility', 'public')
        .single();

    if (sourceError || !source) return null;

    // 取得標籤
    const { data: copyTags } = await supabase
        .from('world_tags')
        .select('tags(name)')
        .eq('world_id', worldId);

    const { data: sourceTags } = await supabase
        .from('world_tags')
        .select('tags(name)')
        .eq('world_id', copy.forked_from_id);

    const copyTagNames = (copyTags || []).map((t: any) => t.tags?.name).filter(Boolean) as string[];
    const sourceTagNames = (sourceTags || []).map((t: any) => t.tags?.name).filter(Boolean) as string[];

    const diff: WorldDiff = {
        name: copy.name !== source.name ? { old: copy.name, new: source.name } : null,
        description: copy.description !== source.description ? { old: copy.description, new: source.description } : null,
        rules_text: copy.rules_text !== source.rules_text ? { old: copy.rules_text, new: source.rules_text } : null,
        image_url: copy.image_url !== source.image_url ? { old: copy.image_url, new: source.image_url } : null,
        tags: JSON.stringify(copyTagNames.sort()) !== JSON.stringify(sourceTagNames.sort())
            ? { old: copyTagNames, new: sourceTagNames } : null,
    };

    return { diff, source };
}

/**
 * 取得角色的差異
 */
export async function getCharacterDiff(
    characterId: string,
    userId: string
): Promise<{ diff: CharacterDiff; source: any } | null> {
    // 取得複製品
    const { data: copy, error: copyError } = await (supabase
        .from('characters') as any)
        .select('*, forked_from_id')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .single();

    if (copyError || !copy?.forked_from_id) return null;

    // 取得原始版本
    const { data: source, error: sourceError } = await (supabase
        .from('characters') as any)
        .select('*')
        .eq('character_id', copy.forked_from_id)
        .eq('visibility', 'public')
        .single();

    if (sourceError || !source) return null;

    // 取得標籤
    const { data: copyTags } = await supabase
        .from('character_tags')
        .select('tags(name)')
        .eq('character_id', characterId);

    const { data: sourceTags } = await supabase
        .from('character_tags')
        .select('tags(name)')
        .eq('character_id', copy.forked_from_id);

    const copyTagNames = (copyTags || []).map((t: any) => t.tags?.name).filter(Boolean) as string[];
    const sourceTagNames = (sourceTags || []).map((t: any) => t.tags?.name).filter(Boolean) as string[];

    const diff: CharacterDiff = {
        canonical_name: copy.canonical_name !== source.canonical_name
            ? { old: copy.canonical_name, new: source.canonical_name } : null,
        core_profile_text: copy.core_profile_text !== source.core_profile_text
            ? { old: copy.core_profile_text, new: source.core_profile_text } : null,
        image_url: copy.image_url !== source.image_url
            ? { old: copy.image_url, new: source.image_url } : null,
        tags: JSON.stringify(copyTagNames.sort()) !== JSON.stringify(sourceTagNames.sort())
            ? { old: copyTagNames, new: sourceTagNames } : null,
    };

    return { diff, source };
}

/**
 * 同步世界觀（從原始版本更新）
 */
export async function syncWorldFromSource(
    worldId: string,
    userId: string
): Promise<void> {
    const diffResult = await getWorldDiff(worldId, userId);
    if (!diffResult) throw new Error('無法取得更新資訊');

    const { source } = diffResult;

    // 更新世界觀內容
    const { error: updateError } = await (supabase
        .from('worlds') as any)
        .update({
            name: source.name,
            description: source.description,
            rules_text: source.rules_text,
            image_url: source.image_url,
            tags_json: source.tags_json,
            last_synced_at: new Date().toISOString(),
        })
        .eq('world_id', worldId)
        .eq('user_id', userId);

    if (updateError) throw new Error('同步失敗：' + updateError.message);

    // 同步標籤
    const { data: copy } = await (supabase
        .from('worlds') as any)
        .select('forked_from_id')
        .eq('world_id', worldId)
        .single();

    if (copy?.forked_from_id) {
        // 刪除現有標籤
        const { error: deleteTagsError } = await supabase
            .from('world_tags')
            .delete()
            .eq('world_id', worldId);

        if (deleteTagsError) {
            throw new Error('刪除標籤失敗：' + deleteTagsError.message);
        }

        // 複製原始標籤
        const { data: sourceTags, error: sourceTagsError } = await supabase
            .from('world_tags')
            .select('tag_id')
            .eq('world_id', copy.forked_from_id);

        if (sourceTagsError) {
            throw new Error('取得原始標籤失敗：' + sourceTagsError.message);
        }

        if (sourceTags && sourceTags.length > 0) {
            const { error: insertTagsError } = await (supabase.from('world_tags') as any).insert(
                sourceTags.map((t: any) => ({ world_id: worldId, tag_id: t.tag_id }))
            );

            if (insertTagsError) {
                throw new Error('複製標籤失敗：' + insertTagsError.message);
            }
        }

        // 同步 Schema
        const { error: deleteSchemaError } = await supabase
            .from('world_state_schema')
            .delete()
            .eq('world_id', worldId);

        if (deleteSchemaError) {
            throw new Error('刪除狀態 Schema 失敗：' + deleteSchemaError.message);
        }

        const { data: sourceSchema, error: sourceSchemaError } = await (supabase
            .from('world_state_schema') as any)
            .select('*')
            .eq('world_id', copy.forked_from_id);

        if (sourceSchemaError) {
            throw new Error('取得原始狀態 Schema 失敗：' + sourceSchemaError.message);
        }

        if (sourceSchema && sourceSchema.length > 0) {
            const { error: insertSchemaError } = await (supabase.from('world_state_schema') as any).insert(
                sourceSchema.map((s: any) => ({
                    world_id: worldId,
                    user_id: userId,
                    schema_key: s.schema_key,
                    display_name: s.display_name,
                    type: s.type,
                    ai_description: s.ai_description,
                    default_value_json: s.default_value_json,
                    enum_options_json: s.enum_options_json,
                    number_constraints_json: s.number_constraints_json,
                    sort_order: s.sort_order,
                }))
            );

            if (insertSchemaError) {
                throw new Error('複製狀態 Schema 失敗：' + insertSchemaError.message);
            }
        }
    }
}

/**
 * 同步角色（從原始版本更新）
 */
export async function syncCharacterFromSource(
    characterId: string,
    userId: string
): Promise<void> {
    const diffResult = await getCharacterDiff(characterId, userId);
    if (!diffResult) throw new Error('無法取得更新資訊');

    const { source } = diffResult;

    // 更新角色內容
    const { error: updateError } = await (supabase
        .from('characters') as any)
        .update({
            canonical_name: source.canonical_name,
            core_profile_text: source.core_profile_text,
            image_url: source.image_url,
            tags_json: source.tags_json,
            last_synced_at: new Date().toISOString(),
        })
        .eq('character_id', characterId)
        .eq('user_id', userId);

    if (updateError) throw new Error('同步失敗：' + updateError.message);

    // 同步標籤
    const { data: copy } = await (supabase
        .from('characters') as any)
        .select('forked_from_id')
        .eq('character_id', characterId)
        .single();

    if (copy?.forked_from_id) {
        // 刪除現有標籤
        const { error: deleteTagsError } = await supabase
            .from('character_tags')
            .delete()
            .eq('character_id', characterId);

        if (deleteTagsError) {
            throw new Error('刪除標籤失敗：' + deleteTagsError.message);
        }

        // 複製原始標籤
        const { data: sourceTags, error: sourceTagsError } = await supabase
            .from('character_tags')
            .select('tag_id')
            .eq('character_id', copy.forked_from_id);

        if (sourceTagsError) {
            throw new Error('取得原始標籤失敗：' + sourceTagsError.message);
        }

        if (sourceTags && sourceTags.length > 0) {
            const { error: insertTagsError } = await (supabase.from('character_tags') as any).insert(
                sourceTags.map((t: any) => ({ character_id: characterId, tag_id: t.tag_id }))
            );

            if (insertTagsError) {
                throw new Error('複製標籤失敗：' + insertTagsError.message);
            }
        }
    }
}

/**
 * 跳過更新（更新 last_synced_at 但不同步內容）
 */
export async function skipWorldUpdate(
    worldId: string,
    userId: string
): Promise<void> {
    const { data: copy } = await (supabase
        .from('worlds') as any)
        .select('forked_from_id')
        .eq('world_id', worldId)
        .eq('user_id', userId)
        .single();

    if (!copy?.forked_from_id) throw new Error('此世界觀不是複製品');

    // 取得原始版本的更新時間（只查詢公開的版本，與 checkWorldForUpdates 保持一致）
    const { data: source } = await (supabase
        .from('worlds') as any)
        .select('updated_at')
        .eq('world_id', copy.forked_from_id)
        .eq('visibility', 'public')
        .single();

    // 如果原始版本不存在（已刪除或設為私人），使用當前時間
    const syncTime = source?.updated_at || new Date().toISOString();

    const { error: updateError } = await (supabase.from('worlds') as any)
        .update({ last_synced_at: syncTime })
        .eq('world_id', worldId)
        .eq('user_id', userId);

    if (updateError) {
        throw new Error('更新同步時間失敗：' + updateError.message);
    }
}

/**
 * 跳過角色更新
 */
export async function skipCharacterUpdate(
    characterId: string,
    userId: string
): Promise<void> {
    const { data: copy } = await (supabase
        .from('characters') as any)
        .select('forked_from_id')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .single();

    if (!copy?.forked_from_id) throw new Error('此角色不是複製品');

    // 取得原始版本的更新時間（只查詢公開的版本，與 checkCharacterForUpdates 保持一致）
    const { data: source } = await (supabase
        .from('characters') as any)
        .select('updated_at')
        .eq('character_id', copy.forked_from_id)
        .eq('visibility', 'public')
        .single();

    // 如果原始版本不存在（已刪除或設為私人），使用當前時間
    const syncTime = source?.updated_at || new Date().toISOString();

    const { error: updateError } = await (supabase.from('characters') as any)
        .update({ last_synced_at: syncTime })
        .eq('character_id', characterId)
        .eq('user_id', userId);

    if (updateError) {
        throw new Error('更新同步時間失敗：' + updateError.message);
    }
}

