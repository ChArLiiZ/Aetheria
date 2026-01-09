/**
 * AI Provider API Testing Service
 *
 * Tests API keys and model configurations for different providers
 */

export type Provider = 'openrouter' | 'gemini' | 'openai';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * Test OpenRouter API
 */
async function testOpenRouter(apiKey: string, model: string): Promise<TestResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: '測試失敗',
        details: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return {
        success: true,
        message: '測試成功',
        details: `模型回應正常。使用模型：${model}`,
      };
    }

    return {
      success: false,
      message: '測試失敗',
      details: '未收到有效的回應',
    };
  } catch (error: any) {
    return {
      success: false,
      message: '測試失敗',
      details: error.message || '網路錯誤',
    };
  }
}

/**
 * Test Google Gemini API
 */
async function testGemini(apiKey: string, model: string): Promise<TestResult> {
  try {
    // Gemini API endpoint format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Hi',
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: '測試失敗',
        details: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      return {
        success: true,
        message: '測試成功',
        details: `模型回應正常。使用模型：${model}`,
      };
    }

    return {
      success: false,
      message: '測試失敗',
      details: '未收到有效的回應',
    };
  } catch (error: any) {
    return {
      success: false,
      message: '測試失敗',
      details: error.message || '網路錯誤',
    };
  }
}

/**
 * Test OpenAI API
 */
async function testOpenAI(apiKey: string, model: string): Promise<TestResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: '測試失敗',
        details: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return {
        success: true,
        message: '測試成功',
        details: `模型回應正常。使用模型：${model}`,
      };
    }

    return {
      success: false,
      message: '測試失敗',
      details: '未收到有效的回應',
    };
  } catch (error: any) {
    return {
      success: false,
      message: '測試失敗',
      details: error.message || '網路錯誤',
    };
  }
}

/**
 * Test API connection for a provider
 */
export async function testProviderConnection(
  provider: Provider,
  apiKey: string,
  model: string
): Promise<TestResult> {
  switch (provider) {
    case 'openrouter':
      return await testOpenRouter(apiKey, model);
    case 'gemini':
      return await testGemini(apiKey, model);
    case 'openai':
      return await testOpenAI(apiKey, model);
    default:
      return {
        success: false,
        message: '未知的供應商',
        details: `不支援的供應商: ${provider}`,
      };
  }
}
