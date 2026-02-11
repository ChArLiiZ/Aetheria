# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**Aetheria** 是一個基於 Next.js 15 和 Supabase 構建的 AI 互動小說平台。使用者可以創建自訂世界觀及狀態系統、定義角色，並透過 AI 驅動的敘事引擎體驗遊戲。平台支援雙 AI 供應商（OpenRouter 與 OpenAI），並具備進階狀態管理、滾動摘要系統、AI 輔助內容生成、社群內容分享、Fork 與同步機制、圖片上傳等完整功能。

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
  ├─> visibility（private | public）
  ├─> original_author_id、forked_from_id（Fork 追蹤）
  └─> Story（故事提示、模式、AI 設定）
       ├─> Story Characters（連結到 Character 定義）
       ├─> Story State Values（各角色狀態追蹤）
       └─> Story Turns（玩家輸入 → AI 敘事歷史）
            └─> Change Logs（狀態變更稽核記錄）

Character（角色定義）
  ├─> visibility（private | public）
  ├─> original_author_id、forked_from_id（Fork 追蹤）
  └─> image_url（圖片）
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

**可見性與 Fork 系統（Visibility & Fork System）**：
- 世界觀與角色可設為 `private`（私人）或 `public`（公開）
- 只有原創內容（`original_author_id` 為 NULL）才能設為公開
- 複製品（`forked_from_id` 非 NULL）強制為私人，無法改為公開
- 支援版本追蹤與同步更新（`last_synced_at`）
- 保留原作者資訊供使用者瀏覽

**圖片上傳系統（Image Upload System）**：
- 世界觀、角色與使用者頭像支援圖片上傳
- 使用 Supabase Storage，格式為 WebP
- 路徑結構：`{entityType}/{userId}/{entityId}.webp`

### AI Agent 架構

程式碼庫使用專門的 AI Agent 處理不同任務：

1. **Story Agent**（`services/agents/story-agent.ts`）
   - 主要敘事生成
   - 回傳：`{ narrative, state_changes[], list_ops[] }`
   - 單次 API 呼叫同時處理敘事與狀態判定
   - System prompt 包含世界描述（`world_description`）、故事前提（`story_premise`）、世界規則、角色、Schema、最近回合與可選的摘要

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
   - 一鍵生成完整故事（世界觀 + 角色 + 故事設定），支援現有標籤整合
   - 函式：`generateWorld()`、`generateCharacter()`、`generateFullStory()`
   - 生成頁面：`/stories/generate`

### 回合執行流程

`services/gameplay/execute-turn.ts` 中的 `executeTurn()` 函式編排完整的回合流程：

1. **狀態自動補齊**：檢查所有角色是否具備所有 Schema 狀態，自動初始化缺失狀態（批次寫入資料庫）
2. **建構上下文**：收集世界描述、故事前提、世界規則、角色、Schema、狀態值、最近回合與適用的摘要
3. **呼叫 AI**：單次 Story Agent 呼叫回傳敘事 + 狀態變更
4. **驗證操作**：`validateStateOperation()` 驗證操作類型與欄位類型的匹配（例如 `inc` 僅限數字欄位），跳過無效操作
5. **套用狀態**：套用 state_changes 和 list_ops，支援 Schema key 與 display_name 的自動 fallback 匹配
6. **儲存回合**：將回合與敘事存入資料庫
7. **記錄變更**：記錄所有狀態變更的前後值
8. **更新故事**：遞增 turn_count
9. **檢查摘要**：若 `turn_index % context_turns === 0`，則觸發摘要生成（非阻塞，失敗不影響主流程）

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
│   ├── community.ts         # 公開內容查詢、Fork、版本同步
│   ├── storage.ts           # 圖片上傳與管理
│   ├── check-story-updates.ts  # 故事更新檢查
│   ├── story-reset.ts       # 故事重置功能
│   ├── tags.ts              # 標籤管理
│   └── ...                  # 其他表對應的服務
└── ai/              # AI 供應商整合（OpenRouter、OpenAI）
```

**設計模式**：每個 Supabase 表都有對應的 Service 檔案，包含 CRUD 操作（例如：`services/supabase/worlds.ts` 對應 worlds 表）。

**重要服務檔案**：
- **community.ts**：處理公開內容的查詢、複製（Fork）、版本檢查與同步
  - `getPublicWorlds()`、`getPublicCharacters()` - 取得公開內容
  - `copyWorldToCollection()`、`copyCharacterToCollection()` - 複製到收藏
  - `checkWorldForUpdates()`、`checkCharacterForUpdates()` - 檢查更新
  - `getWorldDiff()`、`getCharacterDiff()` - 取得差異比對
  - `syncWorldFromSource()`、`syncCharacterFromSource()` - 同步更新
  - `skipWorldUpdate()`、`skipCharacterUpdate()` - 跳過更新
- **storage.ts**：圖片上傳與管理（Supabase Storage）
- **check-story-updates.ts**：檢查故事使用的世界觀/角色/Schema 是否有更新

### 元件模式

- **UI 元件**：Shadcn/ui 元件位於 `components/ui/`
- **頁面元件**：Next.js App Router 頁面位於 `app/`
- **舊版元件**：`components/ui-legacy/` 包含舊元件（逐步淘汰中）
- **認證**：`components/auth/ProtectedRoute.tsx` 中的 `ProtectedRoute` 包裝器
- **故事元件**：`components/story/turn-card.tsx` - 效能優化的回合顯示元件（使用 `memo()` 防止不必要的重新渲染）
- **功能元件**：
  - `components/story-update-alert.tsx` - 故事資源更新提示
  - `components/sync-update-dialog.tsx` - Fork 同步差異比對對話框
  - `components/image-upload.tsx` - 圖片上傳（含裁切、縮放控制）
  - `components/ai-generation-dialog.tsx` - AI 輔助生成對話框
  - `components/character-details-dialog.tsx` - 角色快速檢視
  - `components/world-details-dialog.tsx` - 世界觀快速檢視

### 頁面路由結構

主要頁面路徑：
- `/` - 首頁
- `/login`、`/register` - 認證頁面
- `/dashboard` - 使用者儀表板
- `/settings` - 使用者設定
- `/community` - 社群瀏覽頁面（公開世界觀與角色）
- `/worlds` - 世界觀列表
- `/worlds/[worldId]` - 世界觀詳情
- `/worlds/[worldId]/edit` - 編輯世界觀與 Schema
- `/characters` - 角色列表
- `/characters/[characterId]` - 角色詳情
- `/characters/[characterId]/edit` - 編輯角色
- `/stories` - 故事列表
- `/stories/generate` - AI 生成完整故事
- `/stories/[storyId]` - 故事詳情與設定
- `/stories/[storyId]/play` - 遊玩故事（主要遊戲介面）

### 型別系統

核心型別位於 `types/database/index.ts`。主要介面：
- `World`、`WorldStateSchema`
  - 新增欄位：`visibility`、`image_url`、`original_author_id`、`forked_from_id`、`last_synced_at`、`published_at`
- `Character`、`StoryCharacter`
  - 新增欄位：`visibility`、`image_url`、`original_author_id`、`forked_from_id`、`last_synced_at`、`published_at`
- `User`
  - 新增欄位：`avatar_url`
- `Story`、`StoryTurn`、`StoryStateValue`
- `ProviderSettings`、`AIParams`
- `Visibility` = `'private' | 'public'`

Agent 型別位於 `types/api/agents.ts`：
- `StoryAgentInput/Output` - 包含 `world_description`、`story_premise` 等上下文欄位
- `SuggestionAgentInput/Output`
- `WorldGenerationInput/Output`、`CharacterGenerationInput/Output`
- `FullStoryGenerationInput/Output`、`GeneratedCharacterData`

社群功能型別（`services/supabase/community.ts`）：
- `PublicWorld`、`PublicCharacter` - 包含作者資訊
- `UpdateInfo` - 更新檢查結果
- `WorldDiff`、`CharacterDiff` - 差異比對結果

### 路徑別名

專案使用 `@/*` 作為根目錄的別名（在 `tsconfig.json` 中設定）。

範例：`import { supabase } from '@/lib/supabase/client'`

## 重要實作注意事項

### AI 供應商整合

- 支援 OpenRouter（Claude、GPT、Gemini、Llama 等）與 OpenAI
- 供應商設定按使用者儲存於 `provider_settings` 表
- 模型選擇可透過 `story.model_override` 針對每個故事覆寫
- AI 參數（temperature、top_p）可針對每個故事設定（`max_tokens` 已從 UI 移除，但保留在 `AIParams` 型別中供 API 相容性）

### AI JSON 回應解析

OpenRouter 服務（`services/ai/openrouter.ts`）使用 6 層 fallback 策略解析 AI 的 JSON 回應：
1. 從 Markdown JSON 程式碼區塊提取
2. 從一般程式碼區塊提取
3. 尋找最外層 JSON 物件（首尾大括號）
4. Greedy JSON 物件 regex 匹配
5. 直接解析完整內容
6. 自動修復不完整的 JSON（平衡大括號/方括號）

解析前會預處理：移除 BOM、修正中文引號、移除控制字元、移除尾隨逗號。

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

標籤系統支援 Worlds、Stories 與 Characters：
- 使用關聯表儲存：`world_tags`、`story_tags`、`character_tags`
- 標籤按使用者和類型分類儲存於 `tags` 表
- 遷移檔：`010_add_tags_to_worlds_stories.sql`、`011_centralized_tags.sql`
- 支援標籤篩選與批次刪除

### 社群功能與 Fork 系統

**可見性管理**：
- 世界觀和角色可設為 `private`（預設）或 `public`
- 只有原創內容才能設為公開（`original_author_id` 為 NULL）
- 公開後會記錄 `published_at` 時間戳
- 複製品（Fork）強制為私人，無法改為公開
- RLS 政策確保只有公開內容可被其他使用者查看

**Fork 機制**：
- 使用者可從社群頁面（`/community`）瀏覽公開的世界觀與角色
- 複製功能：`copyWorldToCollection()`、`copyCharacterToCollection()`
- 複製時會：
  1. 建立副本並設為私人
  2. 保留原作者資訊（`original_author_id`）
  3. 記錄 Fork 來源（`forked_from_id`）
  4. 設定初始同步時間（`last_synced_at`）
  5. 複製 Schema（僅世界觀）和標籤

**版本同步**：
- 檢查更新：`checkWorldForUpdates()`、`checkCharacterForUpdates()`
- 差異比對：`getWorldDiff()`、`getCharacterDiff()` - 比較複製品與原始版本
- 同步更新：`syncWorldFromSource()`、`syncCharacterFromSource()` - 覆蓋本地修改
- 跳過更新：`skipWorldUpdate()`、`skipCharacterUpdate()` - 保留本地版本但標記為已讀
- 遷移檔：`014_visibility.sql`、`016_public_content_rls.sql`、`017_fork_content_fields.sql`、`018_fork_content_rls.sql`、`019_sync_version_tracking.sql`

### 圖片上傳系統

使用 Supabase Storage 管理圖片：
- 支援的實體類型：`characters`、`worlds`、`avatars`
- 圖片格式：WebP（統一格式以優化效能）
- 路徑結構：
  - 角色/世界觀：`{entityType}/{userId}/{entityId}.webp`
  - 使用者頭像：`avatars/{userId}/avatar.webp`
- 主要函式（`services/supabase/storage.ts`）：
  - `uploadImage()` - 上傳圖片（使用 upsert 模式）
  - `deleteImage()` - 刪除圖片
  - `getPublicUrl()` - 取得公開 URL
  - `imageExists()` - 檢查圖片是否存在
- 遷移檔：`013_image_upload.sql`、`015_user_avatar.sql`

### 故事管理功能

**故事更新檢查**：
- `checkStoryUpdates()` 檢查故事使用的世界觀、Schema、角色是否有更新
- 比較各資源的 `updated_at` 與故事的 `updated_at`
- 在故事頁面顯示更新提示
- 重新開始故事後會更新 `story.updated_at`，清除更新提示

**故事重置**（`services/supabase/story-reset.ts`）：
- `resetStory()` 允許使用者重新開始故事（刪除所有回合、摘要，重設狀態值至預設）
- 保留故事設定和角色配置

**重新生成回合**：
- 允許使用者使用相同輸入重試先前的回合
- 透過 rollback 後再次執行回合實現

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
- `[checkStoryUpdates]` - 故事更新檢查
- `[copyWorldToCollection]`、`[copyCharacterToCollection]` - Fork 操作
- `[syncWorldFromSource]`、`[syncCharacterFromSource]` - 版本同步

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

### 實作 Fork 與同步功能

若需為新的資源類型（如 Stories）添加 Fork 功能：

1. **資料庫 Schema**：
   - 新增欄位：`visibility`、`original_author_id`、`forked_from_id`、`last_synced_at`、`published_at`
   - 更新 RLS 政策以支援公開內容查詢

2. **型別定義**：
   - 在 `types/database/index.ts` 更新介面定義

3. **服務函式**：
   - 在 `services/supabase/community.ts` 或相關服務檔案中新增：
     - `getPublicXXX()` - 查詢公開內容
     - `copyXXXToCollection()` - 複製到收藏
     - `checkXXXForUpdates()` - 檢查更新
     - `getXXXDiff()` - 差異比對
     - `syncXXXFromSource()` - 同步更新
     - `skipXXXUpdate()` - 跳過更新

4. **UI 元件**：
   - 可見性設定切換（僅原創內容可用）
   - 社群瀏覽頁面
   - 更新提示與同步對話框
   - 原作者資訊顯示

### 整合圖片上傳功能

為新的實體類型添加圖片上傳：

1. **更新 Storage 服務**：
   - 在 `services/supabase/storage.ts` 的 `ImageEntityType` 添加新類型
   - 更新 `getImagePath()` 以支援新路徑結構

2. **UI 元件**：
   - 使用圖片上傳元件（通常包含預覽、裁切、刪除功能）
   - 呼叫 `uploadImage()` 上傳檔案
   - 將回傳的 `image_url` 儲存到資料庫

3. **表單處理**：
   - 處理圖片檔案與其他表單資料分開
   - 先上傳圖片取得 URL，再更新資料庫記錄

## 效能考量

- **上下文管理**：透過滾動摘要緩解大型回合歷史
- **平行查詢**：關鍵服務使用 `Promise.all()` 進行並行資料擷取
- **串流**：AI 回應支援串流以提升 UX（參見 OpenRouter 服務實作）
- **狀態快取**：元件層級的狀態快取減少冗餘的資料庫查詢

## 安全性注意事項

- **API 金鑰保護**：API 金鑰儲存於使用者的 `provider_settings` 表（由 RLS 保護）
- **服務金鑰隔離**：絕不將 `SUPABASE_SERVICE_ROLE_KEY` 暴露給客戶端
- **RLS 政策**：
  - 所有資料庫操作透過 RLS 政策強制執行使用者擁有權
  - 公開內容查詢使用專門的 RLS 政策（`016_public_content_rls.sql`、`018_fork_content_rls.sql`）
  - 複製品僅允許原擁有者修改，但保留原作者資訊供顯示
- **可見性控制**：
  - 只有原創內容才能設為公開
  - Fork 的內容強制為私人，無法改為公開
  - 前端 UI 需檢查 `original_author_id` 是否為 NULL 來決定是否顯示可見性切換
- **圖片上傳**：
  - Supabase Storage 的 RLS 政策控制存取權限
  - 使用 `upsert: true` 模式避免重複上傳
  - 刪除實體時應同時清理 Storage 中的圖片
- **AI Prompt 注入防護**：AI prompts 包含使用者生成的內容 - 適用標準注入防護

## 資料庫遷移歷史

關鍵遷移檔案（按順序）：
- `001-009` - 基礎 Schema、RLS、認證、摘要系統
- `010-011` - 標籤系統（從 JSON 到關聯表）
- `012` - 移除 Story Status 系統
- `013` - 圖片上傳支援
- `014` - 可見性欄位
- `015` - 使用者頭像
- `016` - 公開內容 RLS 政策
- `017` - Fork 欄位（original_author_id、forked_from_id）
- `018` - Fork RLS 政策
- `019` - 版本同步追蹤（last_synced_at）

遷移順序很重要，必須按編號順序套用。
