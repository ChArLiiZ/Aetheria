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
  // Get current session (faster than getUser in client-side)
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('user_id', session.user.id);

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
  // Get current session (faster than getUser in client-side)
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('user_id', session.user.id)
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
  console.log('[upsertProviderSettings] Starting...', { provider });
  console.log('[upsertProviderSettings] Supabase client:', supabase);
  console.log('[upsertProviderSettings] About to call getSession()...');

  try {
    const sessionResult = await supabase.auth.getSession();
    console.log('[upsertProviderSettings] getSession() returned:', sessionResult);
    const { data: { session } } = sessionResult;
    console.log('[upsertProviderSettings] Got session:', session?.user?.id);

    if (!session?.user) {
      throw new Error('User not authenticated');
    }

    console.log('[upsertProviderSettings] Upserting to database...');
    const { data: upsertedSettings, error } = await supabase
      .from('provider_settings')
      .upsert(
        {
          user_id: session.user.id,
          provider,
          api_key: data.api_key,
          default_model: data.default_model,
          default_params_json: data.default_params ? JSON.stringify(data.default_params) : '{}',
        },
        { onConflict: 'user_id,provider' }
      )
      .select()
      .single();

    console.log('[upsertProviderSettings] Database response:', { error, upsertedSettings });

    if (error || !upsertedSettings) {
      throw new Error('Failed to upsert provider settings: ' + error?.message);
    }

    console.log('[upsertProviderSettings] Success!');
    return upsertedSettings as ProviderSettings;
  } catch (err) {
    console.error('[upsertProviderSettings] Caught error:', err);
    throw err;
  }
}

/**
 * Delete provider settings (remove API key and all settings for a provider)
 */
export async function deleteProviderSettings(
  provider: Provider
): Promise<void> {
  // Get current session (faster than getUser in client-side)
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('provider_settings')
    .delete()
    .eq('user_id', session.user.id)
    .eq('provider', provider);

  if (error) {
    throw new Error('Failed to delete provider settings: ' + error.message);
  }
}
