/**
 * Google Sheets Database Client
 *
 * This module provides a client-side interface to interact with Google Sheets as a database.
 * All operations are filtered by user_id for data isolation.
 */

export const SPREADSHEET_ID = process.env.NEXT_PUBLIC_SPREADSHEET_ID || '';

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
 * Initialize Google Sheets API client
 * This should be called once when the app starts
 */
export async function initSheetsClient(apiKey: string): Promise<void> {
  // In browser environment, we'll use gapi
  if (typeof window !== 'undefined') {
    await loadGapiScript();
    await initGapi(apiKey);
  }
}

let gapiLoaded = false;
let gapiInitialized = false;

function loadGapiScript(): Promise<void> {
  if (gapiLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapiLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function initGapi(apiKey: string): Promise<void> {
  if (gapiInitialized) return Promise.resolve();

  return new Promise((resolve, reject) => {
    (window as any).gapi.load('client', async () => {
      try {
        await (window as any).gapi.client.init({
          apiKey,
          discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        gapiInitialized = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Read data from a sheet
 */
export async function readSheet(
  sheetName: SheetName,
  range?: string
): Promise<any[][]> {
  const fullRange = range ? `${sheetName}!${range}` : sheetName;

  const response = await (window as any).gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: fullRange,
  });

  return response.result.values || [];
}

/**
 * Append rows to a sheet
 */
export async function appendToSheet(
  sheetName: SheetName,
  values: any[][]
): Promise<void> {
  await (window as any).gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values,
    },
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
  const fullRange = `${sheetName}!${range}`;

  await (window as any).gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: fullRange,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values,
    },
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
  // Get sheet ID first
  const sheetId = await getSheetId(sheetName);

  await (window as any).gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex,
            },
          },
        },
      ],
    },
  });
}

/**
 * Get sheet ID by name
 */
async function getSheetId(sheetName: SheetName): Promise<number> {
  const response = await (window as any).gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = response.result.sheets.find(
    (s: any) => s.properties.title === sheetName
  );

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  return sheet.properties.sheetId;
}

/**
 * Convert sheet rows to objects using header row
 */
export function rowsToObjects<T>(rows: any[][]): T[] {
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
