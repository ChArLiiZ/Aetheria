// @ts-nocheck
/**
 * WorldStateSchema Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import type { WorldStateSchema, SchemaFieldType } from '@/types';

// Alias to match existing service naming
export type WorldStateSchemaItem = WorldStateSchema;

/**
 * Get all schema items for a world
 */
export async function getSchemaByWorldId(
  worldId: string,
  userId: string
): Promise<WorldStateSchemaItem[]> {
  const { data, error } = await supabase
    .from('world_state_schema')
    .select('*')
    .eq('world_id', worldId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error('Failed to fetch schema: ' + error.message);
  }

  return (data || []) as WorldStateSchemaItem[];
}

/**
 * Get schema item by ID
 */
export async function getSchemaItemById(
  schemaId: string,
  userId: string
): Promise<WorldStateSchemaItem | null> {
  const { data, error } = await supabase
    .from('world_state_schema')
    .select('*')
    .eq('schema_id', schemaId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch schema item: ' + error.message);
  }

  return data as WorldStateSchemaItem;
}

/**
 * Create new schema item
 */
export async function createSchemaItem(
  worldId: string,
  userId: string,
  data: {
    schema_key: string;
    display_name: string;
    type: SchemaFieldType;
    ai_description: string;
    default_value_json?: string;
    enum_options_json?: string;
    number_constraints_json?: string;
  }
): Promise<WorldStateSchemaItem> {
  // Get current max sort_order
  const existingSchemas = await getSchemaByWorldId(worldId, userId);
  const maxSortOrder = existingSchemas.length > 0
    ? Math.max(...existingSchemas.map(s => s.sort_order))
    : 0;

  const { data: newSchema, error } = await supabase
    .from('world_state_schema')
    .insert({
      world_id: worldId,
      user_id: userId,
      schema_key: data.schema_key,
      display_name: data.display_name,
      type: data.type,
      ai_description: data.ai_description,
      default_value_json: data.default_value_json || '',
      enum_options_json: data.enum_options_json || '',
      number_constraints_json: data.number_constraints_json || '',
      sort_order: maxSortOrder + 1,
    })
    .select()
    .single();

  if (error || !newSchema) {
    throw new Error('Failed to create schema item: ' + error?.message);
  }

  return newSchema as WorldStateSchemaItem;
}

/**
 * Update schema item
 */
export async function updateSchemaItem(
  schemaId: string,
  userId: string,
  updates: Partial<
    Pick<
      WorldStateSchemaItem,
      | 'schema_key'
      | 'display_name'
      | 'type'
      | 'ai_description'
      | 'default_value_json'
      | 'enum_options_json'
      | 'number_constraints_json'
      | 'sort_order'
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from('world_state_schema')
    .update(updates)
    .eq('schema_id', schemaId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to update schema item: ' + error.message);
  }
}

/**
 * Delete schema item
 */
export async function deleteSchemaItem(
  schemaId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('world_state_schema')
    .delete()
    .eq('schema_id', schemaId)
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to delete schema item: ' + error.message);
  }
}

/**
 * Reorder schema items
 */
export async function reorderSchemaItems(
  worldId: string,
  userId: string,
  schemaIds: string[]
): Promise<void> {
  // Update sort_order for each schema item
  for (let i = 0; i < schemaIds.length; i++) {
    await updateSchemaItem(schemaIds[i], userId, { sort_order: i + 1 });
  }
}

/**
 * Check if schema_key already exists in world
 */
export async function schemaKeyExists(
  worldId: string,
  userId: string,
  schemaKey: string,
  excludeSchemaId?: string
): Promise<boolean> {
  let query = supabase
    .from('world_state_schema')
    .select('schema_id')
    .eq('world_id', worldId)
    .eq('user_id', userId)
    .eq('schema_key', schemaKey);

  if (excludeSchemaId) {
    query = query.neq('schema_id', excludeSchemaId);
  }

  const { data } = await query;

  return (data?.length || 0) > 0;
}
