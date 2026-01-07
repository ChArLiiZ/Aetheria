/**
 * Characters Service (Google Apps Script version)
 */

import { Character } from '@/types';
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
  'character_id',
  'user_id',
  'canonical_name',
  'core_profile_text',
  'tags_json',
  'created_at',
  'updated_at',
];

/**
 * Get all characters for a user
 */
export async function getCharacters(userId: string): Promise<Character[]> {
  const rows = await readSheet(SHEETS.CHARACTERS);
  const allCharacters = rowsToObjects<Character>(rows);
  return filterByUserId(allCharacters, userId);
}

/**
 * Get a single character by ID
 */
export async function getCharacterById(
  characterId: string,
  userId: string
): Promise<Character | null> {
  const characters = await getCharacters(userId);
  return characters.find((c) => c.character_id === characterId) || null;
}

/**
 * Create a new character
 */
export async function createCharacter(
  userId: string,
  data: {
    canonical_name: string;
    core_profile_text: string;
    tags?: string[];
  }
): Promise<Character> {
  const character: Character = {
    character_id: generateId(),
    user_id: userId,
    canonical_name: data.canonical_name,
    core_profile_text: data.core_profile_text,
    tags_json: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : '',
    created_at: now(),
    updated_at: now(),
  };

  const row = objectToRow(character, HEADERS);
  await appendToSheet(SHEETS.CHARACTERS, [row]);

  return character;
}

/**
 * Update an existing character
 */
export async function updateCharacter(
  characterId: string,
  userId: string,
  data: {
    canonical_name: string;
    core_profile_text: string;
    tags?: string[];
  }
): Promise<Character> {
  const rows = await readSheet(SHEETS.CHARACTERS);
  const rowIndex = findRowIndex(rows, 'character_id', characterId);

  if (rowIndex === -1) {
    throw new Error('Character not found');
  }

  // Verify ownership
  const existingCharacter = rowsToObjects<Character>(rows)[rowIndex - 1];
  if (existingCharacter.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  const updatedCharacter: Character = {
    ...existingCharacter,
    canonical_name: data.canonical_name,
    core_profile_text: data.core_profile_text,
    tags_json: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : '',
    updated_at: now(),
  };

  const row = objectToRow(updatedCharacter, HEADERS);
  await updateSheet(SHEETS.CHARACTERS, `A${rowIndex}:G${rowIndex}`, [row]);

  return updatedCharacter;
}

/**
 * Delete a character
 */
export async function deleteCharacter(characterId: string, userId: string): Promise<void> {
  const rows = await readSheet(SHEETS.CHARACTERS);
  const rowIndex = findRowIndex(rows, 'character_id', characterId);

  if (rowIndex === -1) {
    throw new Error('Character not found');
  }

  // Verify ownership
  const character = rowsToObjects<Character>(rows)[rowIndex - 1];
  if (character.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  await deleteRows(SHEETS.CHARACTERS, rowIndex, rowIndex);
}

/**
 * Check if a character name already exists for this user
 */
export async function characterNameExists(
  userId: string,
  name: string,
  excludeCharacterId?: string
): Promise<boolean> {
  const characters = await getCharacters(userId);
  return characters.some(
    (c) =>
      c.canonical_name.toLowerCase() === name.toLowerCase() &&
      c.character_id !== excludeCharacterId
  );
}
