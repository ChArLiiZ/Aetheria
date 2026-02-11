/**
 * API Route: Story Suggestion Generation
 *
 * POST /api/story/suggest
 * 在伺服器端生成行動建議，避免在前端暴露 API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, isAuthError, getUserProviderSettings } from '@/lib/supabase/auth-helpers';
import { callSuggestionAgent } from '@/services/agents/suggestion-agent';
import { AIServiceError } from '@/lib/errors';
import type { SuggestionAgentInput } from '@/types/api/agents';

export async function POST(request: NextRequest) {
  // 1. 驗證使用者身份
  const authResult = await getAuthenticatedUser(request);
  if (isAuthError(authResult)) return authResult;
  const { user } = authResult;

  // 2. 解析請求 body
  let body: {
    input: SuggestionAgentInput;
    model: string;
    params?: Record<string, any>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的 JSON 請求' }, { status: 400 });
  }

  const { input, model, params } = body;

  if (!input || !model) {
    return NextResponse.json({ error: '缺少必要參數: input, model' }, { status: 400 });
  }

  // 3. 從伺服器端取得使用者的 API key
  const providerSettings = await getUserProviderSettings(user.id);

  if (!providerSettings) {
    return NextResponse.json(
      { error: '未設定 AI 供應商，請到設定頁面配置 API Key' },
      { status: 400 }
    );
  }

  // 4. 呼叫 Suggestion Agent
  try {
    const result = await callSuggestionAgent(
      providerSettings.api_key,
      model,
      input,
      params
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /story/suggest] 生成建議失敗:', error);

    if (error instanceof AIServiceError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode || 500 });
    }

    const message = error instanceof Error ? error.message : '生成建議失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
