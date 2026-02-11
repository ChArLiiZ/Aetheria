/**
 * API Route: AI Full Story Generation
 *
 * POST /api/generate
 * 在伺服器端生成完整故事設定（世界觀 + 角色 + 故事），避免在前端暴露 API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, isAuthError, getUserProviderSettings } from '@/lib/supabase/auth-helpers';
import { generateFullStory } from '@/services/agents/generation-agent';
import { AIServiceError } from '@/lib/errors';
import type { FullStoryGenerationInput } from '@/types/api/agents';

export async function POST(request: NextRequest) {
  // 1. 驗證使用者身份
  const authResult = await getAuthenticatedUser(request);
  if (isAuthError(authResult)) return authResult;
  const { user } = authResult;

  // 2. 解析請求 body
  let body: {
    input: FullStoryGenerationInput;
    model?: string;
    params?: Record<string, any>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的 JSON 請求' }, { status: 400 });
  }

  const { input, model: modelOverride, params } = body;

  if (!input?.userPrompt?.trim()) {
    return NextResponse.json({ error: '缺少必要參數: input.userPrompt' }, { status: 400 });
  }

  // 3. 從伺服器端取得使用者的 provider settings
  const providerSettings = await getUserProviderSettings(user.id);

  if (!providerSettings) {
    return NextResponse.json(
      { error: '未設定 AI 供應商，請到設定頁面配置 API Key' },
      { status: 400 }
    );
  }

  const model = modelOverride || providerSettings.default_model;

  // 4. 呼叫 Generation Agent
  try {
    const result = await generateFullStory(
      providerSettings.api_key,
      model,
      input,
      params
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /generate] 生成失敗:', error);

    if (error instanceof AIServiceError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode || 500 });
    }

    const message = error instanceof Error ? error.message : '生成失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
