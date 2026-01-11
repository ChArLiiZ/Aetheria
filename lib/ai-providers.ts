/**
 * AI Provider and Model Constants
 * 共用的 AI 供應商和模型設定
 */

export type Provider = 'openrouter' | 'openai';

export interface ProviderInfo {
    name: string;
    icon: string;
    description: string;
}

/**
 * 支援的 AI 供應商資訊
 */
export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
    openrouter: {
        name: 'OpenRouter',
        icon: '🚀',
        description: '統一多個 AI 模型的接入平台',
    },
    openai: {
        name: 'OpenAI',
        icon: '🤖',
        description: 'GPT 系列模型提供商',
    },
};

/**
 * 各供應商預設可選的模型
 */
export const MODEL_PRESETS: Record<Provider, string[]> = {
    openrouter: [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o',
        'openai/gpt-4-turbo',
        'openai/gpt-3.5-turbo',
        'google/gemini-pro-1.5',
        'google/gemini-flash-1.5',
    ],
    openai: [
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
    ],
};

/**
 * 所有供應商的 ID 列表
 */
export const PROVIDERS: Provider[] = ['openrouter', 'openai'];

/**
 * 預設供應商
 */
export const DEFAULT_PROVIDER: Provider = 'openrouter';

/**
 * 預設模型（依供應商）
 */
export const DEFAULT_MODELS: Record<Provider, string> = {
    openrouter: 'anthropic/claude-3.5-sonnet',
    openai: 'gpt-4o',
};
