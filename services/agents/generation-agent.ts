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
    FullStoryGenerationInput,
    FullStoryGenerationOutput,
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
    const { currentData } = input;

    const hasExistingProfile = currentData.core_profile_text && currentData.core_profile_text.trim().length > 0;

    let existingDataSection = '';
    if (currentData.canonical_name || hasExistingProfile) {
        existingDataSection = `
# 現有資料（重要：請保留使用者的格式和風格）
${currentData.canonical_name ? `- 角色名稱：${currentData.canonical_name}` : ''}
${hasExistingProfile ? `- 角色資料：\n${currentData.core_profile_text}` : ''}
${currentData.tags && currentData.tags.length > 0 ? `- 標籤：${currentData.tags.join(', ')}` : ''}
`;
    }

    // 無論是否有現有資料，都顯示建議格式讓 AI 自行判斷
    const formatGuidance = `# 角色資料格式
請使用以下結構來組織角色資料（除非使用者已有明確的其他格式）：
- ## 基本資訊：年齡、性別、身份、職業等
- ## 外貌：身高、體型、髮色、眼色、穿著、特徵等
- ## 背景故事：出身、成長經歷、重要事件、能力來源等
- ## 性格特質：主要性格、優點、缺點、習慣、人際關係
- ## 動機與目標：短期目標、長期目標、渴望、恐懼
- ## 說話風格：語氣、常用詞彙、口頭禪
${hasExistingProfile ? '\n注意：使用者已有部分角色資料，請根據使用者的要求決定是否重新組織格式，或只是補充修改現有內容。' : ''}`;

    return `你是一個創意寫作助手，專門幫助使用者建立互動小說的角色設定。

# 任務
根據使用者的描述，生成或補充角色設定。

${existingDataSection}

${formatGuidance}

# 回應格式
請以 JSON 格式回應，不要包含 markdown 標記：

{
  "canonical_name": "角色名稱",
  "core_profile_text": "角色資料...",
  "tags": ["標籤1", "標籤2", "標籤3"]
}

# 注意事項
- 使用繁體中文
- 重要：請使用上述的結構化格式（## 區塊）來組織角色資料，這樣能讓 AI 更準確地理解和扮演角色
- 如果使用者已有角色資料且有自己的格式，則保留他們的格式和風格，只修改或補充他們要求的部分
- 標籤建議 2-4 個，用於分類（如「女性」、「戰士」、「反派」）
- 每個區塊的內容要夠詳細具體，避免過於簡短或籠統的描述`;
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

/**
 * 建立完整故事生成的 System Prompt
 */
function buildFullStoryGenerationPrompt(
    hasCurrentData: boolean,
    existingTags?: {
        characterTags?: string[];
        worldTags?: string[];
        storyTags?: string[];
    }
): string {
    // 建構現有標籤說明
    let existingTagsSection = '';
    if (existingTags) {
        const sections: string[] = [];
        if (existingTags.characterTags && existingTags.characterTags.length > 0) {
            sections.push(`角色標籤：${existingTags.characterTags.join('、')}`);
        }
        if (existingTags.worldTags && existingTags.worldTags.length > 0) {
            sections.push(`世界標籤：${existingTags.worldTags.join('、')}`);
        }
        if (existingTags.storyTags && existingTags.storyTags.length > 0) {
            sections.push(`故事標籤：${existingTags.storyTags.join('、')}`);
        }
        if (sections.length > 0) {
            existingTagsSection = `
# 現有標籤（僅在真正適合時使用，不要勉強套用）
${sections.join('\n')}
`;
        }
    }

    const basePrompt = `你是一個創意寫作助手，專門幫助使用者建立完整的互動小說設定。

# 任務
${hasCurrentData
            ? '根據使用者的指示，修改現有的互動小說設定。請保留使用者沒有要求修改的部分，只修改使用者指定要變更的內容。'
            : '根據使用者的描述，一次性生成完整的互動小說設定，包括：\n1. 世界觀（名稱、描述、規則、標籤、狀態系統）\n2. 角色（根據使用者描述生成所有提到的角色，包含背景、標籤和初始狀態）\n3. 故事設定（標題、前提、模式、標籤、提示詞）'
        }
${existingTagsSection}
# 重要：世界觀與角色/故事的分離原則
世界觀應該是「通用的背景設定」，可以支持多種不同的故事和角色，而不是被特定角色的能力或故事情節過度影響。

例如，如果使用者描述「主角有預知未來的能力，在中世紀奇幻世界冒險」：
- 世界觀應該描述整個「中世紀奇幻世界」的通用設定（魔法體系、王國政治、種族、歷史等）
- 「預知未來」是屬於「角色」層級的特殊能力，不應該讓整個世界觀都圍繞預知能力
- 狀態系統應該是通用的（如 HP、MP、金幣、物品欄），適用於所有角色，而非專為預知能力設計

請確保：
- 世界觀具有足夠的廣度和深度，可以容納多種故事
- 角色的特殊能力/特質放在角色設定中，而非世界規則中
- 故事聚焦於特定的劇情，但世界觀本身是中立且可重用的

# 世界觀狀態種類說明
狀態種類定義了角色可以擁有的屬性。每個狀態需要：
- schema_key: 小寫英文加底線的唯一識別碼（如 health_points, gold, inventory）
- display_name: 顯示給使用者的名稱（如「生命值」、「金幣」、「物品欄」）
- type: 資料類型，可選值：
  - "number": 數值（如 HP、金幣）
  - "text": 文字（如 稱號、外觀、位置）
  - "bool": 布林值（如 是否中毒）
  - "enum": 列舉（如 職業：戰士/法師/盜賊）
  - "list_text": 文字列表（如 物品欄）
- ai_description: 給 AI 的描述，說明這個狀態的含義和用途
- default_value: 預設值（數字請填數字字串如 "100"）
- enum_options: 僅 enum 類型需要，列舉選項陣列
- number_min/number_max: 僅 number 類型可選，數值範圍

## 建議的默認狀態（除非使用者明確不需要，否則應該包含）
1. **外觀 (appearance)**: text 類型，記錄角色當前的穿著打扮，格式建議「上半身：xxx\\n下半身：xxx」
2. **位置 (location)**: text 類型，記錄角色當前所在的地點
3. **物品欄 (inventory)**: list_text 類型，記錄角色攜帶的物品

這些狀態對於大多數互動小說都很實用，可以讓 AI 追蹤角色的外觀變化和位置移動。

# 標籤說明
- 標籤用於分類和描述，不需要包含故事標題（系統會自動關聯世界觀、角色和故事）
- 世界觀標籤：描述世界觀的類型和特色（如「奇幻」、「科幻」、「末日」、「中世紀」）
- 角色標籤：描述角色的特性（如「女性」、「戰士」、「主角」、「反派」）
- 故事標籤：描述故事的類型和主題（如「冒險」、「推理」、「愛情」、「黑暗」）
- 關於現有標籤：只有在標籤真正適合時才使用，不要勉強套用不適合的現有標籤，建立新標籤是完全可以的

# 角色設定說明
每個角色需要：
- canonical_name: 角色名稱
- core_profile_text: 詳細的角色資料，請使用結構化格式（## 基本資訊、## 外貌、## 背景故事、## 性格特質、## 動機與目標、## 說話風格）
- tags: 分類標籤（如「女性」、「戰士」、「主角」）
- is_player: 是否為玩家控制的角色（至少要有一個玩家角色）
- initial_states: 角色的初始狀態值，需要對應世界觀的狀態 Schema

# 故事模式說明
- PLAYER_CHARACTER: 玩家扮演一個特定角色
- DIRECTOR: 玩家作為導演，可以指揮所有角色和事件

# 回應格式
請以 JSON 格式回應，不要包含 markdown 標記。${hasCurrentData ? '請輸出完整的修改後結果，包含所有欄位（包括未修改的部分）：' : ''}

{
  "world": {
    "name": "世界名稱",
    "description": "世界觀簡短描述",
    "rules_text": "詳細的世界規則...",
    "tags": ["奇幻", "中世紀", "魔法"],
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
        "schema_key": "appearance",
        "display_name": "外觀",
        "type": "text",
        "ai_description": "角色當前的穿著打扮，格式：上半身：xxx\\n下半身：xxx"
      },
      {
        "schema_key": "location",
        "display_name": "位置",
        "type": "text",
        "ai_description": "角色當前所在的地點"
      },
      {
        "schema_key": "inventory",
        "display_name": "物品欄",
        "type": "list_text",
        "ai_description": "角色攜帶的物品列表"
      }
    ]
  },
  "characters": [
    {
      "canonical_name": "艾莉絲",
      "core_profile_text": "## 基本資訊\\n25歲女性，聖騎士，勇者隊伍的領袖。\\n\\n## 外貌\\n金髮碧眼，身材高挑健美，常穿著銀白色鎧甲，散發著神聖的光輝。\\n\\n## 背景故事\\n出身於王國騎士家族，從小接受嚴格的戰鬥訓練。18歲時被神殿選為勇者，開始討伐魔王的旅程。\\n\\n## 性格特質\\n正義感極強，開朗大方，對夥伴非常照顧。情感神經大條，完全沒察覺隊友的愛慕之情。\\n\\n## 動機與目標\\n短期目標是完成討伐魔王的使命，長期希望世界恢復和平。內心渴望被認可。\\n\\n## 說話風格\\n語氣爽朗直接，常說「沒問題！」、「交給我吧！」，對朋友使用親切的稱呼。",
      "tags": ["女性", "戰士", "主角"],
      "is_player": true,
      "initial_states": {
        "health_points": 100,
        "appearance": "上半身：銀白色鎧甲\\n下半身：戰鬥用長褲",
        "location": "王都街道",
        "inventory": ["聖劍", "治療藥水"]
      }
    }
  ],
  "story": {
    "title": "故事標題",
    "premise_text": "故事前提和背景...",
    "story_mode": "PLAYER_CHARACTER",
    "story_prompt": "給 AI 的故事引導提示...",
    "tags": ["冒險", "奇幻", "成長"]
  }
}

# 注意事項
- 使用繁體中文
- 世界觀要通用且具廣度，不要被角色能力或故事情節過度影響
- 角色的特殊能力放在角色設定中，而非世界規則中
- 狀態系統設計要通用，通常 4-6 個，建議包含：外觀、位置、物品欄等默認狀態
- 重要：生成使用者描述中提到的所有角色，不要遺漏任何角色（至少一個玩家角色）
- 重要：角色的 core_profile_text 必須使用結構化格式（## 基本資訊、## 外貌、## 背景故事、## 性格特質、## 動機與目標、## 說話風格），這樣能讓 AI 更準確地理解和扮演角色
- 每個區塊都要有具體內容，避免籠統的描述
- 角色的 initial_states 必須對應 world.schemas 中定義的 schema_key
- schema_key 只能使用小寫字母和底線
- 故事標題要吸引人，前提要能引起玩家興趣
- story_prompt 是給 AI 的指導，說明敘事風格和注意事項
- 標籤用於分類描述，不需要包含故事標題（系統會自動關聯）
- 標籤選擇：只使用真正適合的現有標籤，如果沒有適合的就建立新標籤${hasCurrentData ? '\n- 如果使用者已有自己的格式，請保留他們的格式風格，只修改要求的部分' : ''}`;

    return basePrompt;
}

/**
 * 生成完整故事設定（世界觀 + 角色 + 故事）
 */
export async function generateFullStory(
    apiKey: string,
    model: string,
    input: FullStoryGenerationInput,
    params?: Record<string, any>
): Promise<FullStoryGenerationOutput> {
    const hasCurrentData = !!input.currentData;

    // 收集現有標籤
    const existingTags = {
        characterTags: input.existingCharacterTags,
        worldTags: input.existingWorldTags,
        storyTags: input.existingStoryTags,
    };

    const messages: OpenRouterMessage[] = [
        {
            role: 'system',
            content: buildFullStoryGenerationPrompt(hasCurrentData, existingTags),
        },
    ];

    // 如果有現有資料，先加入 assistant 訊息表示這是目前的內容
    if (hasCurrentData && input.currentData) {
        messages.push({
            role: 'assistant',
            content: JSON.stringify(input.currentData, null, 2),
        });
        messages.push({
            role: 'user',
            content: `請根據以下指示修改上面的設定：\n\n${input.userPrompt}`,
        });
    } else {
        messages.push({
            role: 'user',
            content: input.userPrompt,
        });
    }

    const defaultParams = {
        temperature: 0.8,
        top_p: 0.9,
        ...params,
    };

    try {
        console.log('[generateFullStory] 開始生成完整故事設定...');

        const response = await callOpenRouterJsonWithRetry<FullStoryGenerationOutput>(
            apiKey,
            messages,
            model,
            defaultParams,
            2
        );

        const parsed = response.parsed;

        // 驗證世界觀
        if (!parsed.world?.name || !parsed.world?.description || !parsed.world?.rules_text) {
            throw new Error('AI 回應缺少世界觀必要欄位');
        }

        // 確保 schemas 是陣列
        if (!Array.isArray(parsed.world.schemas)) {
            parsed.world.schemas = [];
        }

        // 按類型排序 schemas: number -> bool -> enum -> text -> list_text
        const schemaTypeOrder: Record<string, number> = {
            'number': 1,
            'bool': 2,
            'enum': 3,
            'text': 4,
            'list_text': 5,
        };
        parsed.world.schemas.sort((a, b) => {
            const orderA = schemaTypeOrder[a.type] ?? 99;
            const orderB = schemaTypeOrder[b.type] ?? 99;
            return orderA - orderB;
        });

        // 確保 world.tags 是陣列
        if (!Array.isArray(parsed.world.tags)) {
            parsed.world.tags = [];
        }

        // 驗證角色
        if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
            throw new Error('AI 回應缺少角色資料');
        }

        // 確保至少有一個玩家角色，並確保所有角色都有 tags 和 initial_states
        const hasPlayer = parsed.characters.some(c => c.is_player);
        if (!hasPlayer) {
            parsed.characters[0].is_player = true;
        }

        // 確保每個角色的 tags 是陣列，且 initial_states 存在
        for (const char of parsed.characters) {
            if (!Array.isArray(char.tags)) {
                char.tags = [];
            }
            // 確保 initial_states 存在且為物件
            if (!char.initial_states || typeof char.initial_states !== 'object') {
                char.initial_states = {};
            }
        }

        // 驗證故事
        if (!parsed.story?.title || !parsed.story?.premise_text || !parsed.story?.story_prompt) {
            throw new Error('AI 回應缺少故事必要欄位');
        }

        // 確保 story.tags 是陣列
        if (!Array.isArray(parsed.story.tags)) {
            parsed.story.tags = [];
        }

        // 確保 story_mode 是有效值
        if (!['PLAYER_CHARACTER', 'DIRECTOR'].includes(parsed.story.story_mode)) {
            parsed.story.story_mode = 'PLAYER_CHARACTER';
        }

        console.log('[generateFullStory] 生成成功:', {
            worldName: parsed.world.name,
            characterCount: parsed.characters.length,
            storyTitle: parsed.story.title,
        });

        return parsed;
    } catch (error) {
        console.error('[generateFullStory] 生成失敗:', error);
        throw error;
    }
}
