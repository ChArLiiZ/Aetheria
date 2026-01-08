/**
 * ProviderSettings Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import type { ProviderSettings, AIParams } from '@/types';

export type Provider = 'openrouter' | 'gemini' | 'openai';

/**
 * Get all provider settings for a user
 */
export async function getProviderSettings(): Promise<ProviderSettings[]> {
  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    throw new Error('Failed to fetch provider settings: ' + error.message);
  }

  return (data || []) as ProviderSettings[];
}

/**
 * Get a specific provider setting for a user
 */
export async function getProviderSetting(
  provider: Provider
): Promise<ProviderSettings | null> {
  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('user_id', user.id)
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
  provider: Provider,
  data: {
    api_key: string;
    default_model: string;
    default_params?: AIParams;
  }
): Promise<ProviderSettings> {
  // Get current authenticated user to ensure user_id matches auth.uid()
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: upsertedSettings, error } = await supabase
    .from('provider_settings')
    .upsert(
      {
        user_id: user.id,
        provider,
        api_key: data.api_key,
        default_model: data.default_model,
        default_params_json: data.default_params ? JSON.stringify(data.default_params) : '{}',
      },
      { onConflict: 'user_id,provider' }
    )
    .select()
    .single();

  if (error || !upsertedSettings) {
    throw new Error('Failed to upsert provider settings: ' + error?.message);
  }

  return upsertedSettings as ProviderSettings;
}

/**
 * Delete provider settings (remove API key and all settings for a provider)
 */
export async function deleteProviderSettings(
  provider: Provider
): Promise<void> {
  // Get current authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('provider_settings')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (error) {
    throw new Error('Failed to delete provider settings: ' + error.message);
  }
}
