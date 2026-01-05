import { World } from '@/types';
import {
  readSheet,
  appendToSheet,
  updateSheet,
  deleteRows,
  rowsToObjects,
  objectToRow,
  filterByUserId,
  findRowIndex,
  now,
  generateId,
  SHEETS,
} from '@/lib/db/sheets-client';

const HEADERS = [
  'world_id',
  'user_id',
  'name',
  'description',
  'rules_text',
  'created_at',
  'updated_at',
];

/**
 * Get all worlds for a user
 */
export async function getWorlds(userId: string): Promise<World[]> {
  const rows = await readSheet(SHEETS.WORLDS);
  const worlds = rowsToObjects<World>(rows);
  return filterByUserId(worlds, userId);
}

/**
 * Get world by ID
 */
export async function getWorldById(
  userId: string,
  worldId: string
): Promise<World | null> {
  const worlds = await getWorlds(userId);
  return worlds.find((w) => w.world_id === worldId) || null;
}

/**
 * Create new world
 */
export async function createWorld(
  userId: string,
  data: {
    name: string;
    description: string;
    rules_text: string;
  }
): Promise<World> {
  const timestamp = now();
  const world: World = {
    world_id: generateId(),
    user_id: userId,
    name: data.name,
    description: data.description,
    rules_text: data.rules_text,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const row = objectToRow(world, HEADERS);
  await appendToSheet(SHEETS.WORLDS, [row]);

  return world;
}

/**
 * Update world
 */
export async function updateWorld(
  userId: string,
  worldId: string,
  updates: Partial<Pick<World, 'name' | 'description' | 'rules_text'>>
): Promise<void> {
  const rows = await readSheet(SHEETS.WORLDS);
  const worlds = rowsToObjects<World>(rows);
  const rowIndex = findRowIndex(
    worlds,
    (w) => w.world_id === worldId && w.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('World not found');
  }

  const world = worlds[rowIndex - 2];
  const updatedWorld = {
    ...world,
    ...updates,
    updated_at: now(),
  };

  const row = objectToRow(updatedWorld, HEADERS);
  await updateSheet(SHEETS.WORLDS, `A${rowIndex}:G${rowIndex}`, [row]);
}

/**
 * Delete world
 */
export async function deleteWorld(userId: string, worldId: string): Promise<void> {
  const rows = await readSheet(SHEETS.WORLDS);
  const worlds = rowsToObjects<World>(rows);
  const rowIndex = findRowIndex(
    worlds,
    (w) => w.world_id === worldId && w.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('World not found');
  }

  await deleteRows(SHEETS.WORLDS, rowIndex - 1, rowIndex);
}

/**
 * Duplicate world (copy with new ID)
 */
export async function duplicateWorld(
  userId: string,
  worldId: string,
  newName?: string
): Promise<World> {
  const original = await getWorldById(userId, worldId);
  if (!original) {
    throw new Error('World not found');
  }

  return createWorld(userId, {
    name: newName || `${original.name} (Copy)`,
    description: original.description,
    rules_text: original.rules_text,
  });
}
