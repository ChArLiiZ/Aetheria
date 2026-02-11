/**
 * API Route: Story Turn Execution
 *
 * POST /api/story/turn
 * 在伺服器端執行回合，避免在前端暴露 API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, isAuthError, getUserProviderSettings } from '@/lib/supabase/auth-helpers';
import { executeTurn } from '@/services/gameplay/execute-turn';
import { AIServiceError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  // 1. 驗證使用者身份
  const authResult = await getAuthenticatedUser(request);
  if (isAuthError(authResult)) return authResult;
  const { user } = authResult;

  // 2. 解析請求 body
  let body: {
    story: any;
    userInput: string;
    model?: string;
    params?: Record<string, any>;
    contextTurns?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的 JSON 請求' }, { status: 400 });
  }

  const { story, userInput, model, params, contextTurns } = body;

  if (!story || !userInput?.trim()) {
    return NextResponse.json({ error: '缺少必要參數: story, userInput' }, { status: 400 });
  }

  // 3. 從伺服器端取得使用者的 API key
  const providerSettings = await getUserProviderSettings(user.id);

  if (!providerSettings) {
    return NextResponse.json(
      { error: '未設定 AI 供應商，請到設定頁面配置 API Key' },
      { status: 400 }
    );
  }

  // 4. 執行回合
  try {
    const result = await executeTurn({
      story,
      userInput: userInput.trim(),
      userId: user.id,
      apiKey: providerSettings.api_key,
      model,
      params,
      contextTurns,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /story/turn] 執行失敗:', error);

    if (error instanceof AIServiceError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode || 500 });
    }

    const message = error instanceof Error ? error.message : '回合執行失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
