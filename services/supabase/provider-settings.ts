// @ts-nocheck
/**
 * ProviderSettings Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { ProviderSettings, AIParams } from '@/types';

export type Provider = 'openrouter' | 'openai';

/**
 * Get all provider settings for a user
 */
export async function getProviderSettings(userId: string): Promise<ProviderSettings[]> {
  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to fetch provider settings: ' + error.message);
  }

  return (data || []) as ProviderSettings[];
}

/**
 * Get a specific provider setting for a user
 */
export async function getProviderSetting(
  userId: string,
  provider: Provider
): Promise<ProviderSettings | null> {
  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error('Failed to fetch provider setting: ' + error.message);
  }

  return data as ProviderSettings;
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
  const payload = {
    user_id: userId,
    provider,
    api_key: data.api_key,
    default_model: data.default_model,
    default_params_json: data.default_params ? JSON.stringify(data.default_params) : '{}',
  };

  // Use Promise.race to prevent hanging issues with Supabase client
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const upsertPromise = supabase
    .from('provider_settings')
    .upsert(payload, { onConflict: 'user_id,provider' })
    .select()
    .single();

  const result = await Promise.race([upsertPromise, timeoutPromise]);
  const { data: upsertedSettings, error } = result as any;

  if (error || !upsertedSettings) {
    throw new Error('Failed to upsert provider settings: ' + error?.message);
  }

  return upsertedSettings as ProviderSettings;
}

/**
 * Delete provider settings (remove API key and all settings for a provider)
 */
export async function deleteProviderSettings(
  userId: string,
  provider: Provider
): Promise<void> {
  const { error } = await supabase
    .from('provider_settings')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    throw new Error('Failed to delete provider settings: ' + error.message);
  }
}
