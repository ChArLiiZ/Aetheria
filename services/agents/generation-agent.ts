/**
 * Generation Agent Service
 * AI 輔助生成世界觀和角色
 */

import { callOpenRouterJsonWithRetry } from '@/services/ai/openrouter';
import type {
    WorldGenerationInput,
    WorldGenerationOutput,
    CharacterGenerationInput,
    CharacterGenerationOutput,
    OpenRouterMessage,
} from '@/types/api/agents';

/**
 * 建立世界觀生成的 System Prompt
 */
function buildWorldGenerationPrompt(input: WorldGenerationInput): string {
    const { currentData, userPrompt } = input;

    let existingDataSection = '';
    if (currentData.name || currentData.description || currentData.rules_text) {
        existingDataSection = `
# 現有資料（請保留，除非使用者要求修改）
${currentData.name ? `- 世界名稱：${currentData.name}` : ''}
${currentData.description ? `- 世界描述：${currentData.description}` : ''}
${currentData.rules_text ? `- 世界規則：${currentData.rules_text}` : ''}
`;
    }

    let existingSchemas = '';
    if (currentData.schemas && currentData.schemas.length > 0) {
        existingSchemas = `
# 現有狀態種類（請保留，除非使用者要求修改）
${currentData.schemas.map(s => `- ${s.display_name} (${s.schema_key}): ${s.ai_description}`).join('\n')}
`;
    }

    return `你是一個創意寫作助手，專門幫助使用者建立互動小說的世界觀設定。

# 任務
根據使用者的描述，生成完整的世界觀設定，包括：
1. 世界名稱
2. 世界描述（簡短的世界觀概述）
3. 世界規則（詳細的世界運作規則，供 AI 敘事時參考）
4. 狀態種類（角色可以擁有的屬性，如 HP、MP、金幣、物品等）

${existingDataSection}
${existingSchemas}

# 狀態種類說明
狀態種類定義了角色可以擁有的屬性。每個狀態需要：
- schema_key: 小寫英文加底線的唯一識別碼（如 health_points, gold, inventory）
- display_name: 顯示給使用者的名稱（如「生命值」、「金幣」、「物品欄」）
- type: 資料類型，可選值：
  - "number": 數值（如 HP、金幣）
  - "text": 文字（如 稱號）
  - "bool": 布林值（如 是否中毒）
  - "enum": 列舉（如 職業：戰士/法師/盜賊）
  - "list_text": 文字列表（如 物品欄）
- ai_description: 給 AI 的描述，說明這個狀態的含義和用途
- default_value: 預設值（數字請填數字字串如 "100"）
- enum_options: 僅 enum 類型需要，列舉選項陣列
- number_min/number_max: 僅 number 類型可選，數值範圍

# 回應格式
請以 JSON 格式回應，不要包含 markdown 標記：

{
  "name": "世界名稱",
  "description": "世界觀簡短描述",
  "rules_text": "詳細的世界規則...",
  "schemas": [
    {
      "schema_key": "health_points",
      "display_name": "生命值",
      "type": "number",
      "ai_description": "角色的生命值，歸零時角色死亡",
      "default_value": "100",
      "number_min": 0,
      "number_max": 100
    },
    {
      "schema_key": "inventory",
      "display_name": "物品欄",
      "type": "list_text",
      "ai_description": "角色攜帶的物品列表"
    }
  ]
}

# 注意事項
- 使用繁體中文
- 如果使用者已填入部分資料，請保留這些資料，只補充或修改使用者要求的部分
- 根據世界觀類型生成合適的狀態種類（如奇幻世界可能有 HP/MP/魔力，科幻世界可能有能源/護盾等）
- 通常生成 4-6 個狀態種類即可
- schema_key 只能使用小寫字母和底線`;
}

/**
 * 建立角色生成的 System Prompt
 */
function buildCharacterGenerationPrompt(input: CharacterGenerationInput): string {
    const { currentData, userPrompt } = input;

    let existingDataSection = '';
    if (currentData.canonical_name || currentData.core_profile_text) {
        existingDataSection = `
# 現有資料（請保留，除非使用者要求修改）
${currentData.canonical_name ? `- 角色名稱：${currentData.canonical_name}` : ''}
${currentData.core_profile_text ? `- 角色資料：${currentData.core_profile_text}` : ''}
${currentData.tags && currentData.tags.length > 0 ? `- 標籤：${currentData.tags.join(', ')}` : ''}
`;
    }

    return `你是一個創意寫作助手，專門幫助使用者建立互動小說的角色設定。

# 任務
根據使用者的描述，生成完整的角色設定，包括：
1. 角色名稱
2. 核心角色資料（背景故事、性格特質、動機、說話風格等）
3. 標籤（用於分類的關鍵字）

${existingDataSection}

# 核心角色資料撰寫指南
請包含以下內容，使 AI 能準確扮演這個角色：
- 基本資訊（年齡、外貌特徵等）
- 背景故事
- 性格特質
- 動機與目標
- 說話風格（語氣、常用詞彙、口頭禪等）
- 秘密或隱藏特質（可選）

# 回應格式
請以 JSON 格式回應，不要包含 markdown 標記：

{
  "canonical_name": "角色名稱",
  "core_profile_text": "詳細的角色資料...",
  "tags": ["標籤1", "標籤2", "標籤3"]
}

# 注意事項
- 使用繁體中文
- 如果使用者已填入部分資料，請保留這些資料，只補充或修改使用者要求的部分
- 標籤建議 2-4 個，用於分類（如「女性」、「戰士」、「反派」）
- 角色資料要夠詳細，至少 200-300 字`;
}

/**
 * 生成世界觀設定
 */
export async function generateWorld(
    apiKey: string,
    model: string,
    input: WorldGenerationInput,
    params?: Record<string, any>
): Promise<WorldGenerationOutput> {
    const messages: OpenRouterMessage[] = [
        {
            role: 'system',
            content: buildWorldGenerationPrompt(input),
        },
        {
            role: 'user',
            content: input.userPrompt,
        },
    ];

    const defaultParams = {
        temperature: 0.8,
        max_tokens: 4000,
        top_p: 0.9,
        ...params,
    };

    try {
        const response = await callOpenRouterJsonWithRetry<WorldGenerationOutput>(
            apiKey,
            messages,
            model,
            defaultParams,
            2
        );

        const parsed = response.parsed;

        // 驗證必要欄位
        if (!parsed.name || !parsed.description || !parsed.rules_text) {
            throw new Error('AI 回應缺少必要欄位');
        }

        // 確保 schemas 是陣列
        if (!Array.isArray(parsed.schemas)) {
            parsed.schemas = [];
        }

        return parsed;
    } catch (error) {
        console.error('[generateWorld] 生成失敗:', error);
        throw error;
    }
}

/**
 * 生成角色設定
 */
export async function generateCharacter(
    apiKey: string,
    model: string,
    input: CharacterGenerationInput,
    params?: Record<string, any>
): Promise<CharacterGenerationOutput> {
    const messages: OpenRouterMessage[] = [
        {
            role: 'system',
            content: buildCharacterGenerationPrompt(input),
        },
        {
            role: 'user',
            content: input.userPrompt,
        },
    ];

    const defaultParams = {
        temperature: 0.8,
        max_tokens: 2000,
        top_p: 0.9,
        ...params,
    };

    try {
        const response = await callOpenRouterJsonWithRetry<CharacterGenerationOutput>(
            apiKey,
            messages,
            model,
            defaultParams,
            2
        );

        const parsed = response.parsed;

        // 驗證必要欄位
        if (!parsed.canonical_name || !parsed.core_profile_text) {
            throw new Error('AI 回應缺少必要欄位');
        }

        // 確保 tags 是陣列
        if (!Array.isArray(parsed.tags)) {
            parsed.tags = [];
        }

        return parsed;
    } catch (error) {
        console.error('[generateCharacter] 生成失敗:', error);
        throw error;
    }
}
