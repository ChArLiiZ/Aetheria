/**
 * Worlds Service (Google Apps Script version)
 */

import { World } from '@/types';
import {
  readSheet,
  appendToSheet,
  updateSheet,
  deleteRows,
  rowsToObjects,
  objectToRow,
  findRowIndex,
  filterByUserId,
  now,
  generateId,
  SHEETS,
} from '@/lib/db/sheets-client-appsscript';

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
export async function getWorldsByUserId(userId: string): Promise<World[]> {
  const rows = await readSheet(SHEETS.WORLDS);
  const allWorlds = rowsToObjects<World>(rows);
  return filterByUserId(allWorlds, userId);
}

/**
 * Get world by ID
 */
export async function getWorldById(
  worldId: string,
  userId: string
): Promise<World | null> {
  const worlds = await getWorldsByUserId(userId);
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
  worldId: string,
  userId: string,
  updates: Partial<Pick<World, 'name' | 'description' | 'rules_text'>>
): Promise<void> {
  const rows = await readSheet(SHEETS.WORLDS);
  const allWorlds = rowsToObjects<World>(rows);
  const rowIndex = findRowIndex(
    allWorlds,
    (w) => w.world_id === worldId && w.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('World not found');
  }

  const world = allWorlds[rowIndex - 2]; // Adjust for header
  const updatedWorld: World = {
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
export async function deleteWorld(
  worldId: string,
  userId: string
): Promise<void> {
  const rows = await readSheet(SHEETS.WORLDS);
  const allWorlds = rowsToObjects<World>(rows);
  const rowIndex = findRowIndex(
    allWorlds,
    (w) => w.world_id === worldId && w.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('World not found');
  }

  await deleteRows(SHEETS.WORLDS, rowIndex, rowIndex + 1);
}

/**
 * Check if world name already exists for user
 */
export async function worldNameExists(
  userId: string,
  name: string,
  excludeWorldId?: string
): Promise<boolean> {
  const worlds = await getWorldsByUserId(userId);
  return worlds.some(
    (w) => w.name.toLowerCase() === name.toLowerCase() && w.world_id !== excludeWorldId
  );
}
