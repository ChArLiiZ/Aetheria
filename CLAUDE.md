# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**Aetheria** 是一個基於 Next.js 15 和 Supabase 構建的 AI 互動小說平台。使用者可以創建自訂世界觀及狀態系統、定義角色，並透過 AI 驅動的敘事引擎體驗遊戲。平台支援雙 AI 供應商（OpenRouter 與 OpenAI），並具備進階狀態管理、滾動摘要系統與 AI 輔助內容生成功能。

## 開發指令

```bash
# 開發
npm run dev              # 啟動 Next.js 開發伺服器 (http://localhost:3000)
npm run build            # 建置正式版本
npm run start            # 啟動正式版伺服器
npm run lint             # 執行 ESLint

# Tauri (桌面版)
npm run tauri            # Tauri CLI 指令
```

## 環境設定

必要的環境變數（參見 `.env.example`）：
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 專案 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 公開金鑰
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase 管理員金鑰（僅供伺服器端使用）

資料庫遷移檔位於 `supabase/migrations/`，需按順序套用。

## 架構總覽

### 核心資料流

應用程式遵循階層式資料結構：

```
World（世界規則、狀態 Schema）
  └─> Story（故事提示、模式、AI 設定）
       ├─> Story Characters（連結到 Character 定義）
       ├─> Story State Values（各角色狀態追蹤）
       └─> Story Turns（玩家輸入 → AI 敘事歷史）
            └─> Change Logs（狀態變更稽核記錄）
```

### 核心概念

**World State Schema（世界狀態 Schema）**：定義自訂狀態欄位（HP、MP、物品欄等），支援類型：
- `number` - 數值，可設定最小/最大值限制
- `text` - 字串值
- `bool` - 布林值
- `enum` - 預定義選項集
- `list_text` - 字串陣列

**故事模式（Story Modes）**：
- `PLAYER_CHARACTER` - 玩家控制一個特定角色
- `DIRECTOR` - 玩家導演所有角色和事件（全知視角）

**滾動摘要系統（Rolling Summary System）**：每 N 個回合自動生成故事摘要（可透過 `context_turns_override` 設定），以維持 AI 長期記憶同時減少上下文大小。

### AI Agent 架構

程式碼庫使用專門的 AI Agent 處理不同任務：

1. **Story Agent**（`services/agents/story-agent.ts`）
   - 主要敘事生成
   - 回傳：`{ narrative, state_changes[], list_ops[] }`
   - 單次 API 呼叫同時處理敘事與狀態判定
   - System prompt 包含世界規則、角色、Schema、最近回合與可選的摘要

2. **Summary Agent**（`services/agents/summary-agent.ts`）
   - 生成滾動故事摘要
   - 每 N 個回合觸發（N = context_turns_override）
   - 輸入：先前摘要 + 最近回合 → 輸出：更新的摘要

3. **Suggestion Agent**（`services/agents/suggestion-agent.ts`）
   - 生成 3 個符合情境的行動建議
   - 透過遊玩介面的燈泡按鈕使用

4. **Generation Agent**（`services/agents/generation-agent.ts`）
   - 一鍵生成世界觀（包含狀態 Schema）
   - 一鍵生成角色
   - 函式：`generateWorld()`、`generateCharacter()`

### 回合執行流程

`services/gameplay/execute-turn.ts` 中的 `executeTurn()` 函式編排完整的回合流程：

1. **建構上下文**：收集世界、角色、Schema、狀態值、最近回合與適用的摘要
2. **呼叫 AI**：單次 Story Agent 呼叫回傳敘事 + 狀態變更
3. **套用狀態**：套用 state_changes 和 list_ops，並驗證限制條件
4. **儲存回合**：將回合與敘事存入資料庫
5. **記錄變更**：記錄所有狀態變更的前後值
6. **更新故事**：遞增 turn_count
7. **檢查摘要**：若 `turn_index % context_turns === 0`，則觸發摘要生成

**上下文視窗管理**：AI 上下文中包含的最近回合數量由以下控制：
- `story.context_turns_override`（故事層級）
- `providerSettings.default_context_turns`（使用者層級）
- `DEFAULT_CONTEXT_TURNS = 5`（預設值）

### 狀態管理

狀態操作透過以下方式套用：
- **set**：直接賦值
- **inc**：遞增（僅數字，遵守最小/最大值限制）
- **push**：新增項目到列表
- **remove**：從列表移除項目

限制條件（數字的 min/max、enum 選項）在狀態套用時會被驗證。

### Service 層組織架構

```
services/
├── agents/          # AI Agent 實作
├── gameplay/        # 遊戲邏輯（execute-turn、rollback）
├── supabase/        # 資料庫 CRUD 操作（每個表一個檔案）
└── ai/              # AI 供應商整合（OpenRouter、OpenAI）
```

**設計模式**：每個 Supabase 表都有對應的 Service 檔案，包含 CRUD 操作（例如：`services/supabase/worlds.ts` 對應 worlds 表）。

### 元件模式

- **UI 元件**：Shadcn/ui 元件位於 `components/ui/`
- **頁面元件**：Next.js App Router 頁面位於 `app/`
- **舊版元件**：`components/ui-legacy/` 包含舊元件（逐步淘汰中）
- **認證**：`components/auth/ProtectedRoute.tsx` 中的 `ProtectedRoute` 包裝器

### 型別系統

核心型別位於 `types/database/index.ts`。主要介面：
- `World`、`WorldStateSchema`
- `Character`、`StoryCharacter`
- `Story`、`StoryTurn`、`StoryStateValue`
- `ProviderSettings`、`AIParams`

Agent 型別位於 `types/api/agents.ts`：
- `StoryAgentInput/Output`
- `SuggestionAgentInput/Output`
- `WorldGenerationInput/Output`、`CharacterGenerationInput/Output`

### 路徑別名

專案使用 `@/*` 作為根目錄的別名（在 `tsconfig.json` 中設定）。

範例：`import { supabase } from '@/lib/supabase/client'`

## 重要實作注意事項

### AI 供應商整合

- 支援 OpenRouter（Claude、GPT、Gemini、Llama 等）與 OpenAI
- 供應商設定按使用者儲存於 `provider_settings` 表
- 模型選擇可透過 `story.model_override` 針對每個故事覆寫
- AI 參數（temperature、max_tokens、top_p）可針對每個故事設定

### Markdown 渲染

- 使用者敘事支援 Markdown
- 對話格式：`> **角色名稱**：「對話內容」`
- Story Agent 被明確提示要將對話自然融入敘事流程

### 狀態值儲存

所有狀態值都以 JSON 字串形式儲存在 `story_state_values.value_json`。使用前需先用 `JSON.parse()` 解析。

### 資料庫存取模式

- **客戶端**：使用 `lib/supabase/client.ts`（瀏覽器）
- **伺服器端**：使用 `lib/supabase/server.ts`（伺服器元件）
- **RLS**：列層級安全性政策強制執行 user_id 檢查
- **重試邏輯**：`lib/supabase/retry.ts` 提供重試包裝器

### 標籤系統

最近新增的標籤系統支援 Worlds、Stories 與 Characters：
- 以 JSON 陣列形式儲存於 `tags_json` 欄位（例如：`["fantasy", "magic"]`）
- 遷移檔：`010_add_tags_to_worlds_stories.sql`
- 讀寫時需解析/序列化

## 測試與除錯

程式碼庫廣泛使用帶有函式名稱前綴的 console 日誌：
```typescript
console.log('[functionName] 描述:', data)
```

主要除錯點：
- `[buildStoryAgentInput]` - 上下文建構
- `[callStoryAgent]` - AI 請求/回應
- `[executeTurn]` - 回合執行步驟
- `[applyStateChanges]` - 狀態修改

## 常見工作流程

### 新增世界狀態欄位類型

1. 更新 `types/database/index.ts` 中的 `SchemaFieldType`
2. 如需要新的限制條件，修改 `WorldStateSchema` 介面
3. 更新 `services/agents/story-agent.ts` 中的 Story Agent prompt 以記錄新類型
4. 在 `services/gameplay/execute-turn.ts` 的 `applyStateChanges()` 中新增限制驗證

### 新增 AI Agent

1. 在 `services/agents/your-agent.ts` 建立 Agent 檔案
2. 在 `types/api/agents.ts` 定義輸入/輸出型別
3. 建構 system prompt 與訊息歷史
4. 使用 `services/ai/openrouter.ts` 的 `callOpenRouterJsonWithRetry()` 或 `callOpenRouterWithRetry()`
5. 在相關頁面/服務中新增呼叫點

### 修改回合執行邏輯

所有回合執行邏輯集中在 `services/gameplay/execute-turn.ts`。`executeTurn()` 函式有詳細的步驟編號註解。請謹慎修改，因為它需要協調多個表的資料庫寫入。

### 處理資料庫 Schema

1. 在 `supabase/migrations/` 建立新的遷移檔，格式為 `XXX_description.sql`
2. 更新 `types/database/index.ts` 中的 TypeScript 型別
3. 重新生成 Supabase 型別：檢查是否有型別生成腳本或手動更新
4. 在 `services/supabase/` 新增對應的服務函式

## 效能考量

- **上下文管理**：透過滾動摘要緩解大型回合歷史
- **平行查詢**：關鍵服務使用 `Promise.all()` 進行並行資料擷取
- **串流**：AI 回應支援串流以提升 UX（參見 OpenRouter 服務實作）
- **狀態快取**：元件層級的狀態快取減少冗餘的資料庫查詢

## 安全性注意事項

- API 金鑰儲存於使用者的 `provider_settings` 表（由 RLS 保護）
- 絕不將 `SUPABASE_SERVICE_ROLE_KEY` 暴露給客戶端
- 所有資料庫操作透過 RLS 政策強制執行使用者擁有權
- AI prompts 包含使用者生成的內容 - 適用標準注入防護
