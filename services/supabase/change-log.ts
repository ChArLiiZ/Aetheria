/**
 * Change Log Service (Supabase)
 */

import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/supabase/retry';
import type { ChangeLog } from '@/types';

export type ChangeLogInsert = Omit<ChangeLog, 'change_id'>;

/**
 * Create change log entries
 */
export async function createChangeLogs(entries: ChangeLogInsert[]): Promise<void> {
  if (!entries.length) return;

  return withRetry(async () => {
    const { error } = await (supabase
      .from('change_log') as any)
      .insert(entries);

    if (error) {
      throw new Error('Failed to create change logs: ' + error.message);
    }
  });
}

/**
 * Get change logs by turn IDs
 */
export async function getChangeLogsByTurnIds(
  turnIds: string[],
  userId: string
): Promise<ChangeLog[]> {
  if (!turnIds.length) return [];

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('change_log')
      .select('*')
      .in('turn_id', turnIds)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to fetch change logs: ' + error.message);
    }

    return (data || []) as ChangeLog[];
  });
}
