/**
 * API Route Authentication Helpers
 *
 * 從 Authorization header 驗證使用者身份
 * 使用 supabaseAdmin (service role) 驗證 access token
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * 從 API request 驗證使用者身份
 * @returns { user } 或 NextResponse 401 錯誤
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: '未授權：缺少 Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);

  if (!token) {
    return NextResponse.json(
      { error: '未授權：缺少 access token' },
      { status: 401 }
    );
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json(
        { error: '未授權：無效的 access token' },
        { status: 401 }
      );
    }

    return { user: { id: user.id, email: user.email } };
  } catch {
    return NextResponse.json(
      { error: '驗證失敗' },
      { status: 401 }
    );
  }
}

/**
 * 判斷 getAuthenticatedUser 回傳的是否為錯誤回應
 */
export function isAuthError(
  result: { user: AuthenticatedUser } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

export interface ProviderSettingsRow {
  api_key: string;
  default_model: string;
  provider: string;
}

/**
 * 從資料庫取得使用者的 provider settings
 * @returns provider settings 或 null
 */
export async function getUserProviderSettings(
  userId: string
): Promise<ProviderSettingsRow | null> {
  const { data } = await supabaseAdmin
    .from('provider_settings')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single();

  return data as ProviderSettingsRow | null;
}

/**
 * 從資料庫取得使用者指定供應商的 provider settings
 */
export async function getUserProviderSettingsByProvider(
  userId: string,
  provider: string
): Promise<ProviderSettingsRow | null> {
  const { data } = await supabaseAdmin
    .from('provider_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .limit(1)
    .single();

  return data as ProviderSettingsRow | null;
}
