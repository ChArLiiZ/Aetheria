/**
 * Google Apps Script Sheets Client
 *
 * 使用 Google Apps Script Web App 作為中介 API
 * 支援完整的讀寫操作
 */

export const SHEETS_API_URL = process.env.NEXT_PUBLIC_SHEETS_API_URL || '';

// Sheet names (tabs)
export const SHEETS = {
  USERS: 'Users',
  PROVIDER_SETTINGS: 'ProviderSettings',
  WORLDS: 'Worlds',
  WORLD_STATE_SCHEMA: 'WorldStateSchema',
  CHARACTERS: 'Characters',
  STORIES: 'Stories',
  STORY_CHARACTERS: 'StoryCharacters',
  STORY_CHARACTER_OVERRIDES: 'StoryCharacterOverrides',
  STORY_STATE_VALUES: 'StoryStateValues',
  STORY_RELATIONSHIPS: 'StoryRelationships',
  STORY_TURNS: 'StoryTurns',
  CHANGE_LOG: 'ChangeLog',
} as const;

export type SheetName = typeof SHEETS[keyof typeof SHEETS];

/**
 * Call Apps Script API
 */
async function callAppsScript(params: Record<string, any>): Promise<any> {
  if (!SHEETS_API_URL) {
    throw new Error('SHEETS_API_URL 未設定。請在 .env.local 中設定 NEXT_PUBLIC_SHEETS_API_URL');
  }

  const url = new URL(SHEETS_API_URL);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]);
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '未知錯誤');
  }

  return result.data;
}

/**
 * Read data from a sheet
 */
export async function readSheet(
  sheetName: SheetName,
  range?: string
): Promise<any[][]> {
  const result = await callAppsScript({
    action: 'read',
    sheet: sheetName,
    range: range || '',
  });

  // Ensure we always return an array
  if (!Array.isArray(result)) {
    console.error('readSheet returned non-array:', result);
    return [];
  }

  return result;
}

/**
 * Append rows to a sheet
 */
export async function appendToSheet(
  sheetName: SheetName,
  values: any[][]
): Promise<void> {
  await callAppsScript({
    action: 'append',
    sheet: sheetName,
    values: values,
  });
}

/**
 * Update specific range in a sheet
 */
export async function updateSheet(
  sheetName: SheetName,
  range: string,
  values: any[][]
): Promise<void> {
  await callAppsScript({
    action: 'update',
    sheet: sheetName,
    range: range,
    values: values,
  });
}

/**
 * Delete rows from a sheet
 */
export async function deleteRows(
  sheetName: SheetName,
  startIndex: number,
  endIndex: number
): Promise<void> {
  await callAppsScript({
    action: 'delete',
    sheet: sheetName,
    startIndex: startIndex,
    endIndex: endIndex,
  });
}

/**
 * Check all required sheets exist
 */
export async function checkAllSheets(): Promise<Record<string, boolean>> {
  return callAppsScript({
    action: 'checkSheets',
  });
}

/**
 * Convert sheet rows to objects using header row
 */
export function rowsToObjects<T>(rows: any[][]): T[] {
  // Safety check: ensure rows is an array
  if (!Array.isArray(rows)) {
    console.error('rowsToObjects received non-array:', rows);
    return [];
  }

  if (rows.length === 0) return [];

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj as T;
  });
}

/**
 * Convert object to row array using header order
 */
export function objectToRow(obj: any, headers: string[]): any[] {
  return headers.map((header) => obj[header] ?? '');
}

/**
 * Filter rows by user_id (used for data isolation)
 */
export function filterByUserId<T extends { user_id: string }>(
  objects: T[],
  userId: string
): T[] {
  return objects.filter((obj) => obj.user_id === userId);
}

/**
 * Find row index by condition
 */
export function findRowIndex<T>(
  objects: T[],
  predicate: (obj: T) => boolean
): number {
  const index = objects.findIndex(predicate);
  // Add 2 to account for: 1) 0-based to 1-based, 2) header row
  return index >= 0 ? index + 2 : -1;
}

/**
 * Generate ISO8601 timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Generate UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
