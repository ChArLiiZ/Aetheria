/**
 * API Route: Provider Connection Test
 *
 * POST /api/provider/test
 * 在伺服器端測試 AI 供應商連線，避免在前端暴露 API key
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  isAuthError,
  getUserProviderSettingsByProvider,
} from '@/lib/supabase/auth-helpers';

type Provider = 'openrouter' | 'openai';

const PROVIDER_URLS: Record<Provider, string> = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

export async function POST(request: NextRequest) {
  // 1. 驗證使用者身份
  const authResult = await getAuthenticatedUser(request);
  if (isAuthError(authResult)) return authResult;
  const { user } = authResult;

  // 2. 解析請求 body
  let body: {
    provider: Provider;
    model: string;
    /** 可選：直接傳入 API key（用於尚未儲存的新 key 測試） */
    apiKey?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的 JSON 請求' }, { status: 400 });
  }

  const { provider, model, apiKey: directApiKey } = body;

  if (!provider || !model) {
    return NextResponse.json({ error: '缺少必要參數: provider, model' }, { status: 400 });
  }

  if (!PROVIDER_URLS[provider]) {
    return NextResponse.json({ error: `不支援的供應商: ${provider}` }, { status: 400 });
  }

  // 3. 取得 API key（優先使用直接傳入的，否則從資料庫查詢）
  let apiKey = directApiKey;

  if (!apiKey) {
    const providerSettings = await getUserProviderSettingsByProvider(user.id, provider);
    apiKey = providerSettings?.api_key;
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: '未找到 API Key，請先配置或提供 API Key' },
      { status: 400 }
    );
  }

  // 4. 測試連線
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (provider === 'openrouter') {
      headers['X-Title'] = 'Aetheria';
    }

    const response = await fetch(PROVIDER_URLS[provider], {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        message: '測試失敗',
        details: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return NextResponse.json({
        success: true,
        message: '測試成功',
        details: `模型回應正常。使用模型：${model}`,
      });
    }

    return NextResponse.json({
      success: false,
      message: '測試失敗',
      details: '未收到有效的回應',
    });
  } catch (error: any) {
    console.error('[API /provider/test] 測試失敗:', error);

    return NextResponse.json({
      success: false,
      message: '測試失敗',
      details: error.name === 'TimeoutError' ? '連線逾時' : (error.message || '網路錯誤'),
    });
  }
}
