/**
 * Database Operation Retry Utility
 *
 * Provides automatic retry mechanism with exponential backoff for Supabase operations
 */

// 動態導入 sonner 的輔助函數，避免在伺服器端導入瀏覽器專用函式庫
async function showToast(type: 'warning' | 'error', message: string, options?: { id?: string; description?: string; duration?: number }) {
  if (typeof window === 'undefined') return;
  const { toast } = await import('sonner');
  if (type === 'warning') {
    toast.warning(message, options);
  } else {
    toast.error(message, options);
  }
}

export interface RetryOptions {
  maxRetries?: number;
  initialTimeout?: number;
  timeoutMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
  /** 操作名稱，用於除錯日誌 */
  operationName?: string;
  /** 是否禁用 Toast 通知 (預設: false) */
  disableToast?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'operationName'>> = {
  maxRetries: 3,
  initialTimeout: 30000, // 30 seconds (increased to handle very slow connections)
  timeoutMultiplier: 1.5, // Each retry increases timeout by 1.5x (30s, 45s, 67.5s)
  onRetry: () => { },
  disableToast: false,
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
  const opName = opts.operationName || 'unknown';
  // 為每個操作實例生成唯一的 toast ID，避免並發操作互相干擾
  const toastId = `retry-${opName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      // Calculate timeout for this attempt (increases with each retry)
      const timeout = opts.initialTimeout * Math.pow(opts.timeoutMultiplier, attempt);

      console.log(`[withRetry] 開始操作: ${opName}, 嘗試 ${attempt + 1}/${opts.maxRetries}, 超時: ${timeout / 1000}秒`);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`資料庫操作逾時 (${timeout / 1000} 秒) - 操作: ${opName}`));
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

        // Show toast warning if in browser
        // 使用 maxRetries - 1 因為初始嘗試不算重試，與 console.log 保持一致
        // 使用 void 明確表示有意不等待 Promise，避免阻塞重試邏輯
        if (!opts.disableToast) {
          void showToast('warning', `連線不穩定，正在嘗試重新連線... (${attempt + 1}/${opts.maxRetries - 1})`, {
            id: toastId, // 使用唯一 ID 避免並發操作互相干擾
            description: lastError?.message || '未知錯誤',
          });
        }

        // Small delay before retry (100ms * attempt)
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  const finalError = new Error(
    `資料庫操作失敗 (已重試 ${opts.maxRetries} 次): ${lastError?.message || '未知錯誤'}`
  );

  // Show final error toast if in browser
  // 使用 void 明確表示有意不等待 Promise，避免阻塞錯誤拋出
  if (!opts.disableToast) {
    void showToast('error', '連線失敗，請檢查網路連線', {
      id: toastId, // 使用相同的唯一 ID 將警告 toast 更新為錯誤
      description: finalError.message,
      duration: 5000,
    });
  }

  // All retries exhausted
  throw finalError;
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
