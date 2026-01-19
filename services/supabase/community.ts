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
 * 取得所有公開世界觀
 */
export async function getPublicWorlds(): Promise<PublicWorld[]> {
    const { data, error } = await (supabase
        .from('worlds') as any)
        .select(`
      *,
      users:user_id(display_name, avatar_url),
      world_tags(tags(*))
    `)
        .eq('visibility', 'public')
        .order('published_at', { ascending: false });

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
 * 取得所有公開角色
 */
export async function getPublicCharacters(): Promise<PublicCharacter[]> {
    const { data, error } = await (supabase
        .from('characters') as any)
        .select(`
      *,
      users:user_id(display_name, avatar_url),
      character_tags(tags(*))
    `)
        .eq('visibility', 'public')
        .order('published_at', { ascending: false });

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
