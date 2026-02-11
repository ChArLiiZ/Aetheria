/**
 * Authenticated API Client
 *
 * 封裝前端到 API routes 的 authenticated fetch 呼叫
 * 自動從 Supabase session 取得 access token 放入 Authorization header
 */

import { supabase } from '@/lib/supabase/client';
import type { AIErrorType } from '@/lib/errors';

/**
 * 前端 API 錯誤，攜帶從後端回傳的分類錯誤資訊
 */
export class APIError extends Error {
  public errorType?: AIErrorType;
  public statusCode: number;
  public retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    errorType?: AIErrorType,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.retryAfter = retryAfter;
  }
}

/**
 * 發送 authenticated POST 請求到 API route
 * @param url - API route 路徑（例如 '/api/story/turn'）
 * @param body - 請求 body
 * @returns 解析後的 JSON 回應
 */
export async function apiPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new APIError('未登入，請重新登入後再試', 401);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: '未知錯誤' }));
    throw new APIError(
      errorData.error || `API 錯誤: ${res.status}`,
      res.status,
      errorData.errorType,
      errorData.retryAfter
    );
  }

  return res.json();
}
