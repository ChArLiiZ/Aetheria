import { Character } from '@/types';
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
  const characters = rowsToObjects<Character>(rows);
  return filterByUserId(characters, userId);
}

/**
 * Get character by ID
 */
export async function getCharacterById(
  userId: string,
  characterId: string
): Promise<Character | null> {
  const characters = await getCharacters(userId);
  return characters.find((c) => c.character_id === characterId) || null;
}

/**
 * Create new character
 */
export async function createCharacter(
  userId: string,
  data: {
    canonical_name: string;
    core_profile_text: string;
    tags?: string[];
  }
): Promise<Character> {
  const timestamp = now();
  const character: Character = {
    character_id: generateId(),
    user_id: userId,
    canonical_name: data.canonical_name,
    core_profile_text: data.core_profile_text,
    tags_json: data.tags ? JSON.stringify(data.tags) : '',
    created_at: timestamp,
    updated_at: timestamp,
  };

  const row = objectToRow(character, HEADERS);
  await appendToSheet(SHEETS.CHARACTERS, [row]);

  return character;
}

/**
 * Update character
 */
export async function updateCharacter(
  userId: string,
  characterId: string,
  updates: Partial<
    Pick<Character, 'canonical_name' | 'core_profile_text' | 'tags_json'>
  >
): Promise<void> {
  const rows = await readSheet(SHEETS.CHARACTERS);
  const characters = rowsToObjects<Character>(rows);
  const rowIndex = findRowIndex(
    characters,
    (c) => c.character_id === characterId && c.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('Character not found');
  }

  const character = characters[rowIndex - 2];
  const updatedCharacter = {
    ...character,
    ...updates,
    updated_at: now(),
  };

  const row = objectToRow(updatedCharacter, HEADERS);
  await updateSheet(SHEETS.CHARACTERS, `A${rowIndex}:G${rowIndex}`, [row]);
}

/**
 * Delete character
 * Note: This does NOT check if character is used in stories
 * Consider adding validation before deletion
 */
export async function deleteCharacter(
  userId: string,
  characterId: string
): Promise<void> {
  const rows = await readSheet(SHEETS.CHARACTERS);
  const characters = rowsToObjects<Character>(rows);
  const rowIndex = findRowIndex(
    characters,
    (c) => c.character_id === characterId && c.user_id === userId
  );

  if (rowIndex === -1) {
    throw new Error('Character not found');
  }

  await deleteRows(SHEETS.CHARACTERS, rowIndex - 1, rowIndex);
}

/**
 * Duplicate character (copy with new ID)
 */
export async function duplicateCharacter(
  userId: string,
  characterId: string,
  newName?: string
): Promise<Character> {
  const original = await getCharacterById(userId, characterId);
  if (!original) {
    throw new Error('Character not found');
  }

  const tags = original.tags_json ? JSON.parse(original.tags_json) : undefined;

  return createCharacter(userId, {
    canonical_name: newName || `${original.canonical_name} (Copy)`,
    core_profile_text: original.core_profile_text,
    tags,
  });
}

/**
 * Search characters by name or tags
 */
export async function searchCharacters(
  userId: string,
  query: string
): Promise<Character[]> {
  const characters = await getCharacters(userId);
  const lowerQuery = query.toLowerCase();

  return characters.filter((c) => {
    const nameMatch = c.canonical_name.toLowerCase().includes(lowerQuery);
    const tagsMatch = c.tags_json
      ? JSON.parse(c.tags_json).some((tag: string) =>
          tag.toLowerCase().includes(lowerQuery)
        )
      : false;

    return nameMatch || tagsMatch;
  });
}
