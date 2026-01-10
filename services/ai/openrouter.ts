import { OpenRouterMessage, OpenRouterRequest, OpenRouterResponse } from '@/types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call OpenRouter API
 */
export async function callOpenRouter(
  apiKey: string,
  request: OpenRouterRequest
): Promise<OpenRouterResponse> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'Aetheria',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  return response.json();
}

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

      // If it's a JSON parsing error and we have retries left, add a correction message
      if (attempt < maxRetries && error instanceof SyntaxError) {
        messages.push({
          role: 'user',
          content:
            'The previous response had a JSON parsing error. Please provide a valid JSON response following the exact schema specified.',
        });
      } else if (attempt < maxRetries) {
        // For other errors, just retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
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
        throw new SyntaxError('Failed to parse JSON response');
      }

      return { parsed, usage: response.usage, raw: content };
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        workingMessages.push({
          role: 'user',
          content:
            'The previous response had a JSON parsing error. Please provide a valid JSON response following the exact schema specified.',
        });
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Parse JSON response with error handling
 */
export function parseJsonResponse<T>(content: string): T | null {
  // Log the first 500 characters for debugging
  console.log('[parseJsonResponse] 嘗試解析回應，長度:', content.length);
  if (content.length < 500) {
    console.log('[parseJsonResponse] 原始內容:', content);
  } else {
    console.log('[parseJsonResponse] 原始內容（前 500 字）:', content.substring(0, 500));
  }

  try {
    // Strategy 1: Try to extract JSON from markdown code blocks (```json ... ```)
    const jsonCodeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonCodeBlockMatch) {
      console.log('[parseJsonResponse] 使用策略 1: Markdown JSON 區塊');
      return JSON.parse(jsonCodeBlockMatch[1]);
    }

    // Strategy 2: Try to extract JSON from generic code blocks (``` ... ```)
    const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        console.log('[parseJsonResponse] 使用策略 2: 一般程式碼區塊');
        return JSON.parse(codeBlockMatch[1]);
      } catch {
        // Not valid JSON, continue to next strategy
      }
    }

    // Strategy 3: Try to find JSON object boundaries { ... }
    const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        console.log('[parseJsonResponse] 使用策略 3: JSON 物件邊界');
        return JSON.parse(jsonObjectMatch[0]);
      } catch {
        // Not valid JSON, continue to next strategy
      }
    }

    // Strategy 4: Try to parse the whole content directly
    console.log('[parseJsonResponse] 使用策略 4: 直接解析');
    return JSON.parse(content);
  } catch (error) {
    console.error('[parseJsonResponse] 所有策略都失敗。原始回應:', content);
    console.error('[parseJsonResponse] 解析錯誤:', error);
    return null;
  }
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
