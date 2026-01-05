# Aetheria - AI 互動小說應用程式完整架構規格書

## 1. 產品目標

Aetheria 是一款跨平台（**Android / Windows / Web**）的 AI 互動小說 App。玩家可：

- 建立世界觀（世界規則 + 狀態 Schema）
- 建立角色（跨世界共用）
- 建立故事：選世界觀 + 選角色 + 指定玩家角色（可空）+ 設定故事內角色專屬設定（override）+ 初始化狀態與關係
- 遊玩：玩家自由輸入；AI 生成故事敘事與多角色對話；另一個 AI Agent 生成狀態/關係/物品清單變動並**自動套用**寫入資料庫
- 隨時查看側邊欄：所有角色當前狀態值、物品清單、關係（數值+tags）
- 每個故事可自訂敘事 Prompt（微調語氣/視角/節奏等）
- 玩家可設定 AI 供應商與 API Key（初版 OpenRouter），**API key 全局設定**；故事內可覆寫模型/參數

---

## 2. 名詞定義（必須一致）

- **World（世界觀）**：世界規則 + 狀態 Schema。每個 Story 必須選 1 個 World。
- **WorldStateSchema（狀態 Schema）**：定義「此 World 中故事角色擁有的狀態欄位」及型別/預設值/AI 說明。
- **Character（角色）**：跨世界共用的角色卡（背景、性格、說話風格等），不綁 World。
- **Story（故事）**：一次遊玩實例；綁定 1 World、包含多個角色、可指定 0 或 1 個玩家角色。
- **StoryCharacter（故事角色）**：角色加入某故事後的實例。
- **Override（故事內角色專屬設定）**：角色在該故事/世界觀下的身份與調整（含顯示名稱覆寫）。
- **Turn（回合）**：玩家輸入 → AI 敘事 → 狀態變動寫入 的最小單位。
- **Relationship（關係）**：故事內「角色A → 角色B」的關係狀態，包含 `score`（數值）+ `tags`（多選）。
- **Inventory（物品清單）**：狀態欄位的一種型別，採 `List<Text>`。

---

## 3. 核心互動規則（硬規則）

### 3.1 玩家輸入控制範圍

- **故事有玩家角色（PLAYER_CHARACTER 模式）**：玩家輸入只能描述/決定「玩家角色」的行動或台詞；不得直接指揮其他角色。
- **故事無玩家角色（DIRECTOR 模式）**：玩家是導演，可描述/決定任何角色行動。

### 3.2 狀態變更套用

- AI 產生狀態/關係/物品變更後，系統**自動套用**，不需玩家確認。

### 3.3 世界觀 Schema 動態變更

- Schema 的新增/修改/刪除會動態影響既有故事：
    - 新增欄位 → 自動補到所有相關故事與角色
    - 刪除欄位 → **硬刪**（相關狀態值與歷史也刪除）

---

## 4. 平台與 UI 導航（IA）

跨平台一致的資訊架構：

1. **Dashboard**
- 續玩最近故事
- 新建故事
- 世界觀
- 角色
- AI 設定（全局）
1. **世界觀（Worlds）**
- 世界觀列表
- 世界觀編輯：
    - 基本資訊
    - 世界規則
    - 狀態 Schema CRUD
1. **角色（Characters）**
- 角色列表
- 角色編輯（核心角色卡）
1. **故事（Stories）**
- 故事列表（進行中/已完結）
- 建立故事 Wizard（分步）
- 故事遊玩頁（主畫面 + 側邊欄）
- 故事回顧頁（回合列表 + 狀態 diff）
1. **設定（Settings）**
- OpenRouter API key（全局）
- 預設模型/參數
- 同步狀態（可選：顯示最近同步時間、衝突提示）

---

## 5. 功能需求（模組拆解）

### 5.1 全局 AI 設定（OpenRouter）

- 設定項（全局）：
    - provider = `openrouter`
    - api_key（需同步）
    - default_model
    - default_params（temperature、max_tokens、top_p、stream…）
- 功能：
    - 測試連線
    - 儲存並同步到 Sheets

> 注意（不展開方案）：若 Web 客戶端可直接讀到 Sheets，API key 會有外洩風險。此風險需由權限設計或中介層處理。
> 

---

### 5.2 角色管理（跨世界共用）

- 角色列表：新增/編輯/複製/刪除
- 角色欄位：
    - canonical_name
    - core_profile_text（背景/性格/動機/秘密/說話風格）
    - tags（可選）

---

### 5.3 世界觀管理（World + Schema）

- 世界觀列表：新增/編輯/複製/刪除
- 世界規則：rules_text（硬規則/禁忌/限制）
- 狀態 Schema（CRUD）
    - 欄位屬性：
        - schema_key（唯一且不可重用）
        - display_name
        - type：`number | text | bool | enum | list_text`
        - ai_description
        - default_value（json）
        - enum_options（json array）
        - number_constraints（json：min/max/decimals/unit）
        - sort_order

---

### 5.4 建立故事 Wizard（必須分步）

**Step 1：選世界觀**（world_id）

**Step 2：選角色**（多個 character_id）

**Step 3：玩家角色（可空）**

- 選 0 或 1 個作為玩家角色
- 決定 story_mode：
    - 有玩家角色 → PLAYER_CHARACTER
    - 無玩家角色 → DIRECTOR

**Step 4：故事基本資訊**

- title、premise_text

**Step 5：故事內角色專屬設定（Override）**

每個 story_character：

- `override_profile_text`（身份/陣營/職業/背景調整）
- `display_name_override`（可覆寫顯示名稱；保留角色 id）
- （可選）override_voice_style

**Step 6：初始化狀態**

- 系統依 Schema 為每個 story_character 生成狀態值
- UI 讓玩家填入初始值（預設帶入 default_value）

**Step 7：初始化關係（score + tags，多選）**

- 針對故事內角色建立關係資料：
    - score（例如 -100~100）
    - tags（多選，array）
- UI 可先提供預設：score=0、tags=[]

**Step 8：故事內 AI 設定（可覆寫）**

- model_override（預設帶入全局 default_model）
- params_override（可選）
- story_prompt（敘事微調 prompt）

---

### 5.5 遊玩主循環（回合制）

主畫面包含：

- 敘事與對話流
- 玩家輸入框
- 「推薦行動」按鈕（顯示 3 個建議）
- 側邊欄：狀態/物品/關係

回合流程（每次送出輸入）：

1. 讀取上下文（world rules、story prompt、角色卡+override、當前狀態、關係、最近 N 回合）
2. Narrative Agent 生成敘事+對話（JSON）
3. State Delta Agent 生成變更（JSON）
4. 自動套用變更：更新 StoryStateValues / StoryRelationships
5. append Turn 記錄與 ChangeLog（供回顧與 diff）

---

### 5.6 側邊欄/抽屜（即時查看）

- 角色列表（顯示 display_name_override 優先）
- 點角色：
    - 顯示所有狀態（依 schema sort_order）
    - 顯示物品清單（list_text）
    - 顯示與其他角色的關係（score + tags）
    - 顯示最近一次變更摘要（上一回合 diff）

---

### 5.7 回顧（必做）

- 回合列表（turn_index）
- 點回合：
    - 玩家輸入
    - 敘事與對話
    - 變更摘要（ChangeLog 或由 before/after 計算）

---

## 6. 多 Agent 管線（強制 JSON 契約）

### 6.1 Narrative Agent（只產出敘事/對話）

**Input（概念）**

- story_mode（PLAYER_CHARACTER / DIRECTOR）
- world rules
- story_prompt
- player_character_id（若有）
- characters：core_profile + override_profile + 當前狀態摘要
- relationships 摘要
- recent_turns（最近 N）
- user_input

**Output（JSON）**

```json
{
  "narrative": "string",
  "dialogue": [{ "speaker_story_character_id": "sc_xxx", "text": "string" }],
  "scene_tags": ["string"],
  "system_notes": ["string"]
}
```

硬規則：

- PLAYER_CHARACTER：不得把玩家輸入視為指揮其他角色
- DIRECTOR：允許玩家指定任何角色行動

---

### 6.2 State Delta Agent（產出可套用變更）

**Output（JSON）**

```json
{
  "changes": [
    {
      "target_story_character_id": "sc_xxx",
      "schema_key": "hp",
      "op": "inc",
      "value": -10,
      "reason": "string"
    }
  ],
  "list_ops": [
    {
      "target_story_character_id": "sc_xxx",
      "schema_key": "inventory",
      "op": "push",
      "value": "繃帶",
      "reason": "string"
    }
  ],
  "relationship_changes": [
    {
      "from_story_character_id": "sc_a",
      "to_story_character_id": "sc_b",
      "op": "inc_score",
      "value": 5,
      "tag_ops": [{ "op": "add", "value": "信任" }],
      "reason": "string"
    }
  ]
}
```

允許 op（MVP）：

- number：`set`, `inc`
- text/bool/enum：`set`
- list_text：`push`, `remove`, `set`
- relationship：
    - score：`set_score`, `inc_score`
    - tags：`add/remove`（以 tag_ops 表示）

驗證：

- schema_key 必須存在於 WorldStateSchema（否則忽略該條或觸發格式修正重試）
- enum 值必須在 allowed_values 內（否則重試或降級為 text）

---

### 6.3 Action Suggestion Agent（推薦 3 行動）

```json
{
  "suggestions": [
    { "text": "string" },
    { "text": "string" },
    { "text": "string" }
  ]
}
```

硬規則：

- PLAYER_CHARACTER：建議必須是玩家角色可做的事

---

## 7. Prompt 分層與組裝（給實作 AI 的要求）

- System Prompt：固定規則 + 嚴格 JSON 輸出格式 + 禁止事項
- World Prompt：world.rules_text
- Story Prompt：story.story_prompt
- Character Cards：core_profile_text + override_profile_text + display_name_override
- State Schema：提供給 State Delta Agent（欄位定義、型別、預設值、約束、ai_description）
- Memory：最近 N 回合摘要（避免上下文爆炸）

錯誤處理（必要）：

- JSON 解析失敗 → 以「修正格式」提示重試 1 次；再失敗 → 顯示敘事但不套用變更，並在 Turn 記錄 error_flag。

---

## 8. Google Sheets 作為資料庫（單一 Spreadsheet、多使用者共用、靠 user_id 隔離）

### 8.1 全域原則

- 單一 Spreadsheet，包含多個 worksheet（tabs）。
- 每筆資料都必須包含 `user_id` 欄位，用於隔離。
- 所有查詢與更新都必須以 `user_id` 篩選（邏輯隔離）。

> 重要風險提示（不展開方案）：在「無 backend」前提下，客戶端若能直接寫入整張表，實際上很難做到真正安全的隔離。本文只定義資料結構與隔離規則。
> 

---

## 9. Google Sheets Worksheets（表格）定義（Aetheria_DB）

建議 Spreadsheet 名稱：`Aetheria_DB`

所有表第一列為 header，時間一律 ISO8601。

### 9.1 Users

用途：簡易登入資料（email/名稱/密碼雜湊）

欄位：

- `user_id`（UUID，PK）
- `email`（unique，存小寫）
- `display_name`
- `password_hash`（argon2/bcrypt 輸出字串；不得明文）
- `created_at`
- `updated_at`
- `status`（active/disabled）
- `last_login_at`（可選）

---

### 9.2 ProviderSettings

- `user_id`
- `provider`（openrouter）
- `api_key`（字串；*風險：若表可被客戶端讀到會外洩*）
- `default_model`
- `default_params_json`
- `updated_at`

---

### 9.3 Worlds

- `world_id`（UUID，PK）
- `user_id`
- `name`
- `description`
- `rules_text`
- `created_at`
- `updated_at`

---

### 9.4 WorldStateSchema

- `schema_id`（UUID，PK）
- `world_id`
- `user_id`
- `schema_key`（unique within world_id）
- `display_name`
- `type`（number/text/bool/enum/list_text）
- `ai_description`
- `default_value_json`
- `enum_options_json`
- `number_constraints_json`
- `sort_order`
- `updated_at`

---

### 9.5 Characters

- `character_id`（UUID，PK）
- `user_id`
- `canonical_name`
- `core_profile_text`
- `tags_json`
- `created_at`
- `updated_at`

---

### 9.6 Stories

- `story_id`（UUID，PK）
- `user_id`
- `world_id`
- `title`
- `premise_text`
- `story_mode`（PLAYER_CHARACTER/DIRECTOR）
- `player_character_id`（nullable）
- `story_prompt`
- `model_override`（nullable）
- `params_override_json`（nullable）
- `status`（active/ended）
- `turn_count`（可選）
- `created_at`
- `updated_at`

---

### 9.7 StoryCharacters

- `story_character_id`（UUID，PK）
- `story_id`
- `user_id`
- `character_id`
- `display_name_override`（nullable）
- `is_player`（bool）
- `created_at`

---

### 9.8 StoryCharacterOverrides

- `story_character_id`（PK / FK）
- `story_id`
- `user_id`
- `override_profile_text`
- `override_voice_style`（nullable）
- `updated_at`

---

### 9.9 StoryStateValues（當前狀態值）

- `story_id`
- `user_id`
- `story_character_id`
- `schema_key`
- `value_json`
- `updated_at`

約束：

-（建議邏輯唯一鍵）(story_id, story_character_id, schema_key) 不應重複

---

### 9.10 StoryRelationships（關係：分向）

- `story_id`
- `user_id`
- `from_story_character_id`
- `to_story_character_id`
- `score`（number）
- `tags_json`（多選 array）
- `updated_at`

約束：

-（建議邏輯唯一鍵）(story_id, from_story_character_id, to_story_character_id) 不應重複

---

### 9.11 StoryTurns（回合紀錄，append-only）

- `turn_id`（UUID，PK）
- `story_id`
- `user_id`
- `turn_index`（int）
- `user_input_text`
- `narrative_text`
- `dialogue_json`
- `scene_tags_json`
- `created_at`
- `error_flag`（optional）
- `token_usage_json`（optional）

---

### 9.12 ChangeLog（變更歷史）

- `change_id`（UUID，PK）
- `turn_id`
- `story_id`
- `user_id`
- `entity_type`（state/relationship）
- `target_story_character_id`（state）
- `schema_key`（state）
- `from_story_character_id`（relationship）
- `to_story_character_id`（relationship）
- `op`
- `before_value_json`
- `after_value_json`
- `reason_text`

---

## 10. 世界觀 Schema 動態變更（含硬刪）在 Sheets 的規則

### 10.1 新增 schema_key

- 在 `WorldStateSchema` 新增一列
- 對所有使用該 `world_id` 的故事：
    - 找出 `StoryCharacters`（同 story_id）
    - 對每個 story_character 在 `StoryStateValues` 新增一列（schema_key=新增欄位，value=default）

### 10.2 刪除 schema_key（硬刪）

- 在 `WorldStateSchema` 刪除該列
- 同時刪除：
    - `StoryStateValues` 中所有符合（user_id、story_id 屬於該 world 的故事、schema_key 相同）的列
    - `ChangeLog` 中 schema_key 相同的列（同 user_id 範圍內）

> 回顧頁遇到舊回合引用已刪欄位：不補救，直接不顯示（因硬刪）。
> 

---

## 11. 同步與一致性（多裝置）

在「無 backend、且使用 Sheets」情境下，仍需最小一致性策略：

### 11.1 故事寫入順序（每回合）

建議固定順序：

1. 先 append `StoryTurns`（turn_index = last + 1）
2. 更新 `StoryStateValues`（多筆）
3. 更新 `StoryRelationships`（多筆）
4. append `ChangeLog`（多筆）
5. 更新 `Stories.turn_count` 與 `Stories.updated_at`

### 11.2 併發（樂觀鎖建議）

在 `Stories` 增加一欄（可選）：

- `version` 或 `last_turn_index`

寫入前讀取該值，寫入後更新。若發現版本不符，提示使用者重新同步後再操作。

---

## 12. MVP 範圍（建議）

**MVP 必含**

- Worlds：規則 + Schema CRUD + 動態套用（含硬刪）
- Characters：CRUD
- Stories：Wizard 全流程（含 override、初始狀態、關係、故事 prompt、模型覆寫）
- 遊玩主循環（Narrative + StateDelta + auto-apply）
- 側邊欄（狀態/關係/物品）
- 回顧（Turn 列表 + diff/ChangeLog）

**可延後**

- 匯出 Markdown/PDF
- 分支/回溯重玩
- List<Object> 物品結構
- 更完整的內容過濾

---

## 13. 給「產碼 AI」的硬性實作要求（最關鍵）

1. 所有 Agent 輸出必須是 JSON，且符合契約；解析失敗要有一次重試策略。
2. 狀態更新採 op-based（inc/push/remove），避免整包覆寫造成漂移。
3. PLAYER_CHARACTER 模式下，UI 與 prompt 必須共同限制玩家只能影響玩家角色。
4. 組裝角色資料時：`display_name_override` 優先顯示，但所有關聯用 id（story_character_id / character_id）。
5. Schema migration 是第一等公民：任何 schema CRUD 都必須觸發對既有故事的補值/刪除。