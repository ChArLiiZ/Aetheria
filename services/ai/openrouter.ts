import { OpenRouterMessage, OpenRouterRequest, OpenRouterResponse } from '@/types';
import { AIServiceError } from '@/lib/errors';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// API 請求超時時間（毫秒）
const API_TIMEOUT_MS = 60000; // 60 秒

/**
 * 根據 HTTP 狀態碼分類錯誤
 */
function classifyApiError(status: number, body: string): AIServiceError {
  // 嘗試解析 Retry-After header 值（從 body 中）
  let retryAfter: number | undefined;

  switch (status) {
    case 401:
    case 403:
      return new AIServiceError(
        'API 金鑰無效或已過期',
        status,
        'auth'
      );
    case 402:
      return new AIServiceError(
        'API 額度不足，請檢查您的供應商帳戶',
        status,
        'quota'
      );
    case 429: {
      // 嘗試從 body 解析 retry-after 資訊
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.metadata?.retry_after != null) {
          const val = Number(parsed.error.metadata.retry_after);
          if (!Number.isNaN(val)) {
            retryAfter = val;
          }
        }
      } catch {}
      return new AIServiceError(
        '請求過於頻繁，請稍候再試',
        429,
        'rate_limit',
        retryAfter
      );
    }
    case 500:
    case 502:
    case 503:
    case 504:
      return new AIServiceError(
        'AI 服務暫時不可用，請稍後再試',
        status,
        'server'
      );
    default:
      return new AIServiceError(
        `OpenRouter API 錯誤 (${status}): ${body.substring(0, 200)}`,
        status,
        'unknown'
      );
  }
}

/**
 * Call OpenRouter API with timeout
 */
export async function callOpenRouter(
  apiKey: string,
  request: OpenRouterRequest
): Promise<OpenRouterResponse> {
  console.log('[callOpenRouter] 開始發送請求到 OpenRouter...');
  console.log('[callOpenRouter] 模型:', request.model);
  console.log('[callOpenRouter] 訊息數量:', request.messages?.length || 0);

  // 建立 AbortController 用於超時控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('[callOpenRouter] 請求超時，正在中止...');
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'Aetheria',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('[callOpenRouter] 收到回應，狀態碼:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[callOpenRouter] API 錯誤:', response.status, errorBody);

      const retryAfterHeader = response.headers.get('Retry-After');
      const classifiedError = classifyApiError(response.status, errorBody);

      // 如果 header 有 Retry-After 且錯誤是 rate_limit，覆寫 retryAfter
      if (retryAfterHeader && classifiedError.errorType === 'rate_limit') {
        const parsed = Number(retryAfterHeader);
        classifiedError.retryAfter = Number.isNaN(parsed) ? undefined : parsed;
      }

      throw classifiedError;
    }

    const data = await response.json();
    console.log('[callOpenRouter] 成功解析回應');
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // 已經是 AIServiceError 就直接拋出
    if (error instanceof AIServiceError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new AIServiceError(
        `請求逾時 (${API_TIMEOUT_MS / 1000} 秒)，請檢查網路連線或稍後再試`,
        0,
        'timeout'
      );
    }

    console.error('[callOpenRouter] 請求失敗:', error);
    throw new AIServiceError(
      error.message || '未知的網路錯誤',
      0,
      'unknown'
    );
  }
}

/** 不應重試的錯誤類型 */
const NON_RETRYABLE_ERRORS: Set<string> = new Set(['auth', 'quota']);

/**
 * Call OpenRouter with retry logic for JSON parsing errors
 */
export async function callOpenRouterWithRetry(
  apiKey: string,
  messages: OpenRouterMessage[],
  model: string,
  params?: Record<string, any>,
  maxRetries = 1
): Promise<{ content: string; usage?: any }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const request: OpenRouterRequest = {
        model,
        messages,
        ...params,
      };

      const response = await callOpenRouter(apiKey, request);
      const content = response.choices[0]?.message?.content || '';

      return {
        content,
        usage: response.usage,
      };
    } catch (error) {
      lastError = error as Error;

      // 不可重試的錯誤直接拋出
      if (error instanceof AIServiceError && NON_RETRYABLE_ERRORS.has(error.errorType)) {
        throw error;
      }

      if (attempt < maxRetries) {
        // rate_limit 使用 retryAfter，否則 exponential backoff
        if (error instanceof AIServiceError && error.errorType === 'rate_limit' && error.retryAfter) {
          await new Promise((resolve) => setTimeout(resolve, error.retryAfter! * 1000));
        } else if (error instanceof SyntaxError) {
          messages.push({
            role: 'user',
            content:
              'The previous response had a JSON parsing error. Please provide a valid JSON response following the exact schema specified.',
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Call OpenRouter and parse JSON with retry on invalid output
 */
export async function callOpenRouterJsonWithRetry<T>(
  apiKey: string,
  messages: OpenRouterMessage[],
  model: string,
  params?: Record<string, any>,
  maxRetries = 1
): Promise<{ parsed: T; usage?: any; raw: string }> {
  let lastError: Error | null = null;
  const workingMessages = [...messages];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const request: OpenRouterRequest = {
        model,
        messages: workingMessages,
        ...params,
      };

      const response = await callOpenRouter(apiKey, request);
      const content = response.choices[0]?.message?.content || '';
      const parsed = parseJsonResponse<T>(content);

      if (!parsed) {
        throw new AIServiceError('AI 回應格式異常，無法解析 JSON', 0, 'parse');
      }

      return { parsed, usage: response.usage, raw: content };
    } catch (error) {
      lastError = error as Error;

      // 不可重試的錯誤直接拋出
      if (error instanceof AIServiceError && NON_RETRYABLE_ERRORS.has(error.errorType)) {
        throw error;
      }

      if (attempt < maxRetries) {
        if (error instanceof AIServiceError && error.errorType === 'rate_limit' && error.retryAfter) {
          await new Promise((resolve) => setTimeout(resolve, error.retryAfter! * 1000));
        } else if (error instanceof AIServiceError && error.errorType === 'parse') {
          workingMessages.push({
            role: 'user',
            content:
              'The previous response had a JSON parsing error. Please provide a valid JSON response following the exact schema specified.',
          });
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Parse JSON response with error handling and multiple fallback strategies
 */
export function parseJsonResponse<T>(content: string): T | null {
  // Log the first 500 characters for debugging
  console.log('[parseJsonResponse] 嘗試解析回應，長度:', content.length);
  if (content.length < 500) {
    console.log('[parseJsonResponse] 原始內容:', content);
  } else {
    console.log('[parseJsonResponse] 原始內容（前 500 字）:', content.substring(0, 500));
  }

  // 預處理：移除可能的 BOM 和修復常見問題
  const preprocessJson = (str: string): string => {
    return str
      // 移除 BOM
      .replace(/^\uFEFF/, '')
      // 修復中文引號
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // 移除控制字符（除了 \n \r \t）
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      // 移除尾隨逗號（在 ] 或 } 之前）
      .replace(/,(\s*[}\]])/g, '$1');
  };

  const tryParse = (str: string, strategyName: string): T | null => {
    try {
      const processed = preprocessJson(str);
      const result = JSON.parse(processed);
      console.log(`[parseJsonResponse] 成功使用策略: ${strategyName}`);
      return result;
    } catch (e) {
      return null;
    }
  };

  // Strategy 1: Try to extract JSON from markdown code blocks (```json ... ```)
  const jsonCodeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonCodeBlockMatch) {
    const result = tryParse(jsonCodeBlockMatch[1], 'Markdown JSON 區塊');
    if (result) return result;
  }

  // Strategy 2: Try to extract JSON from generic code blocks (``` ... ```)
  const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const result = tryParse(codeBlockMatch[1], '一般程式碼區塊');
    if (result) return result;
  }

  // Strategy 3: Try to find the outermost JSON object { ... }
  // 使用更精確的 JSON 物件匹配（處理嵌套）
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = content.substring(firstBrace, lastBrace + 1);
    const result = tryParse(jsonCandidate, 'JSON 物件邊界（首尾括號）');
    if (result) return result;
  }

  // Strategy 4: Try greedy JSON object match
  const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    const result = tryParse(jsonObjectMatch[0], 'JSON 物件邊界（貪婪匹配）');
    if (result) return result;
  }

  // Strategy 5: Try to parse the whole content directly
  const directResult = tryParse(content, '直接解析');
  if (directResult) return directResult;

  // Strategy 6: 嘗試修復不完整的 JSON（可能被截斷）
  // 這是最後的嘗試，嘗試補全可能缺失的括號
  if (firstBrace !== -1) {
    let fixedJson = content.substring(firstBrace);
    // 計算括號平衡
    let braceCount = 0;
    let bracketCount = 0;
    for (const char of fixedJson) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    // 補全缺失的括號
    while (bracketCount > 0) {
      fixedJson += ']';
      bracketCount--;
    }
    while (braceCount > 0) {
      fixedJson += '}';
      braceCount--;
    }
    const fixedResult = tryParse(fixedJson, '修復不完整 JSON');
    if (fixedResult) return fixedResult;
  }

  console.error('[parseJsonResponse] 所有策略都失敗。原始回應:', content);
  return null;
}

/**
 * Test OpenRouter API connection
 */
export async function testOpenRouterConnection(
  apiKey: string,
  model: string
): Promise<boolean> {
  try {
    const request: OpenRouterRequest = {
      model,
      messages: [
        {
          role: 'user',
          content: 'Hello, please respond with "OK"',
        },
      ],
      max_tokens: 10,
    };

    await callOpenRouter(apiKey, request);
    return true;
  } catch (error) {
    console.error('OpenRouter connection test failed:', error);
    return false;
  }
}
