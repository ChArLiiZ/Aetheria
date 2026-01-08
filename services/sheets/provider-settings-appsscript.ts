/**
 * ProviderSettings Service (Google Apps Script version)
 */

import { ProviderSettings, AIParams } from '@/types';
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
  SHEETS,
} from '@/lib/db/sheets-client-appsscript';

const HEADERS = ['user_id', 'provider', 'api_key', 'default_model', 'default_params_json', 'updated_at'];

export type Provider = 'openrouter' | 'gemini' | 'openai';

/**
 * Get all provider settings for a user
 */
export async function getProviderSettings(userId: string): Promise<ProviderSettings[]> {
  const rows = await readSheet(SHEETS.PROVIDER_SETTINGS);
  const allSettings = rowsToObjects<ProviderSettings>(rows);
  return filterByUserId(allSettings, userId);
}

/**
 * Get a specific provider setting for a user
 */
export async function getProviderSetting(
  userId: string,
  provider: Provider
): Promise<ProviderSettings | null> {
  const settings = await getProviderSettings(userId);
  return settings.find((s) => s.provider === provider) || null;
}

/**
 * Create or update provider settings (upsert)
 */
export async function upsertProviderSettings(
  userId: string,
  provider: Provider,
  data: {
    api_key: string;
    default_model: string;
    default_params?: AIParams;
  }
): Promise<ProviderSettings> {
  const rows = await readSheet(SHEETS.PROVIDER_SETTINGS);
  const allSettings = rowsToObjects<ProviderSettings>(rows);

  // Find existing setting
  const existingIndex = allSettings.findIndex(
    (s) => s.user_id === userId && s.provider === provider
  );

  const setting: ProviderSettings = {
    user_id: userId,
    provider,
    api_key: data.api_key,
    default_model: data.default_model,
    default_params_json: data.default_params ? JSON.stringify(data.default_params) : '{}',
    updated_at: now(),
  };

  const row = objectToRow(setting, HEADERS);

  if (existingIndex !== -1) {
    // Update existing
    const rowIndex = existingIndex + 2; // +1 for header, +1 for 0-based to 1-based
    await updateSheet(SHEETS.PROVIDER_SETTINGS, `A${rowIndex}:F${rowIndex}`, [row]);
  } else {
    // Create new
    await appendToSheet(SHEETS.PROVIDER_SETTINGS, [row]);
  }

  return setting;
}

/**
 * Delete provider settings (remove API key and all settings for a provider)
 */
export async function deleteProviderSettings(
  userId: string,
  provider: Provider
): Promise<void> {
  const rows = await readSheet(SHEETS.PROVIDER_SETTINGS);
  const allSettings = rowsToObjects<ProviderSettings>(rows);

  const existingIndex = allSettings.findIndex(
    (s) => s.user_id === userId && s.provider === provider
  );

  if (existingIndex === -1) {
    throw new Error('Provider settings not found');
  }

  const rowIndex = existingIndex + 2; // +1 for header, +1 for 0-based to 1-based
  await deleteRows(SHEETS.PROVIDER_SETTINGS, rowIndex, rowIndex);
}
