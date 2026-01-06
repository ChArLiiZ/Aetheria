/**
 * WorldStateSchema Service (Google Apps Script version)
 */

import { WorldStateSchemaItem, SchemaFieldType } from '@/types';
import {
  readSheet,
  appendToSheet,
  updateSheet,
  deleteRows,
  rowsToObjects,
  objectToRow,
  findRowIndex,
  now,
  generateId,
  SHEETS,
} from '@/lib/db/sheets-client-appsscript';

const HEADERS = [
  'schema_id',
  'world_id',
  'user_id',
  'schema_key',
  'display_name',
  'type',
  'ai_description',
  'default_value_json',
  'enum_options_json',
  'number_constraints_json',
  'sort_order',
  'updated_at',
];

/**
 * Get all schema items for a world
 */
export async function getSchemaByWorldId(
  worldId: string,
  userId: string
): Promise<WorldStateSchemaItem[]> {
  const rows = await readSheet(SHEETS.WORLD_STATE_SCHEMA);
  const allSchemas = rowsToObjects<WorldStateSchemaItem>(rows);

  return allSchemas
    .filter((s) => s.world_id === worldId && s.user_id === userId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Get schema item by ID
 */
export async function getSchemaItemById(
  schemaId: string,
  userId: string
): Promise<WorldStateSchemaItem | null> {
  const rows = await readSheet(SHEETS.WORLD_STATE_SCHEMA);
  const allSchemas = rowsToObjects<WorldStateSchemaItem>(rows);

  return allSchemas.find(
    (s) => s.schema_id === schemaId && s.user_id === userId
  ) || null;
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

  const timestamp = now();
  const schemaItem: WorldStateSchemaItem = {
    schema_id: generateId(),
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
    updated_at: timestamp,
  };

  const row = objectToRow(schemaItem, HEADERS);
  await appendToSheet(SHEETS.WORLD_STATE_SCHEMA, [row]);

  return schemaItem;
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
  const rows = await readSheet(SHEETS.WORLD_STATE_SCHEMA);
  const allSchemas = rowsToObjects<WorldStateSchemaItem>(rows);
  const rowIndex = findRowIndex(
    allSchemas,
    (s) => s.schema_id === schemaId && s.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('Schema item not found');
  }

  const schemaItem = allSchemas[rowIndex - 2]; // Adjust for header
  const updatedSchemaItem: WorldStateSchemaItem = {
    ...schemaItem,
    ...updates,
    updated_at: now(),
  };

  const row = objectToRow(updatedSchemaItem, HEADERS);
  await updateSheet(SHEETS.WORLD_STATE_SCHEMA, `A${rowIndex}:L${rowIndex}`, [row]);
}

/**
 * Delete schema item
 */
export async function deleteSchemaItem(
  schemaId: string,
  userId: string
): Promise<void> {
  const rows = await readSheet(SHEETS.WORLD_STATE_SCHEMA);
  const allSchemas = rowsToObjects<WorldStateSchemaItem>(rows);
  const rowIndex = findRowIndex(
    allSchemas,
    (s) => s.schema_id === schemaId && s.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('Schema item not found');
  }

  await deleteRows(SHEETS.WORLD_STATE_SCHEMA, rowIndex, rowIndex + 1);
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
  const schemas = await getSchemaByWorldId(worldId, userId);
  return schemas.some(
    (s) => s.schema_key === schemaKey && s.schema_id !== excludeSchemaId
  );
}
