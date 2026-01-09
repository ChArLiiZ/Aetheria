/**
 * Database Operation Retry Utility
 *
 * Provides automatic retry mechanism with exponential backoff for Supabase operations
 */

export interface RetryOptions {
  maxRetries?: number;
  initialTimeout?: number;
  timeoutMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialTimeout: 5000, // 5 seconds
  timeoutMultiplier: 1.5, // Each retry increases timeout by 1.5x (5s, 7.5s, 11.25s)
  onRetry: () => {},
};

/**
 * Execute a database operation with automatic retry and timeout
 *
 * @example
 * const data = await withRetry(
 *   () => supabase.from('users').select('*'),
 *   { maxRetries: 3, initialTimeout: 5000 }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      // Calculate timeout for this attempt (increases with each retry)
      const timeout = opts.initialTimeout * Math.pow(opts.timeoutMultiplier, attempt);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`資料庫操作逾時 (${timeout / 1000} 秒)`));
        }, timeout);
      });

      // Race between operation and timeout
      const result = await Promise.race([operation(), timeoutPromise]);

      // Success - return result
      return result;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt < opts.maxRetries - 1) {
        // Log retry attempt
        console.log(`資料庫操作失敗，重試 ${attempt + 1}/${opts.maxRetries - 1}...`, error);

        // Call retry callback
        opts.onRetry(attempt + 1, lastError);

        // Small delay before retry (100ms * attempt)
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `資料庫操作失敗 (已重試 ${opts.maxRetries} 次): ${lastError?.message || '未知錯誤'}`
  );
}

/**
 * Wrap a Supabase query builder with retry logic
 *
 * This is specifically designed for Supabase's query builder pattern
 *
 * @example
 * const { data, error } = await withSupabaseRetry(
 *   supabase.from('users').select('*').eq('id', userId)
 * );
 */
export async function withSupabaseRetry<T>(
  queryBuilder: any,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await withRetry(
      async () => {
        // Execute the query
        const response = await queryBuilder;

        // Check for Supabase errors
        if (response.error) {
          throw new Error(`Supabase 錯誤: ${response.error.message}`);
        }

        return response;
      },
      options
    );

    return result;
  } catch (error: any) {
    return {
      data: null,
      error: {
        message: error.message || '資料庫操作失敗',
        code: 'RETRY_FAILED',
      },
    };
  }
}

/**
 * Create a retry wrapper for a function
 *
 * Useful for wrapping entire service functions
 *
 * @example
 * const getUserWithRetry = createRetryWrapper(getUser, { maxRetries: 3 });
 * const user = await getUserWithRetry(userId);
 */
export function createRetryWrapper<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    return withRetry(() => fn(...args), options);
  };
}
