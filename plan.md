# Aetheria - AI 互動小說應用程式
 
## 📋 專案概覽
 
Aetheria 是一款基於 AI 的互動式小說遊戲平台，讓玩家能夠：
- 建立世界觀與狀態系統
- 建立可重用的角色
- 創造獨特的故事並與 AI 互動
- 即時追蹤角色狀態、關係和物品
 
**技術棧**：Next.js 15 + TypeScript + Supabase + OpenRouter AI + Sonner
 
---
 
## 🎯 核心概念
 
### 關鍵名詞定義
- **World（世界觀）**：世界規則 + 狀態 Schema 定義
- **WorldStateSchema（狀態 Schema）**：定義角色可擁有的狀態欄位（HP、MP、物品等）
- **Character（角色）**：跨世界共用的角色卡（背景、性格、說話風格）
- **Story（故事）**：一次遊玩實例，綁定 1 個世界觀 + 多個角色
- **StoryCharacter（故事角色）**：角色在特定故事中的實例
- **Turn（回合）**：玩家輸入 → AI 生成敘述 → 狀態變更的最小單位
- **Relationship（關係）**：角色間的關係狀態（分數 + 標籤）
 
### 遊戲模式
- **PLAYER_CHARACTER 模式**：玩家控制一個特定角色
- **DIRECTOR 模式**：玩家是導演，可指揮所有角色和事件
 
---
 
## ✅ 功能完成狀態
 
### 🟢 Phase 0: 基礎架構 [100%]
 
#### ✅ 資料庫與認證
- [x] Supabase 專案建立與設定
- [x] 使用者認證系統（註冊、登入、登出）
- [x] RLS（Row Level Security）規則
- [x] 資料庫 Schema 完整定義
 
#### ✅ 核心類型系統
- [x] TypeScript 類型定義（`types/database.ts`, `types/index.ts`）
- [x] Supabase 客戶端設定（`lib/supabase/client.ts`）
- [x] 認證上下文（`contexts/AuthContext.tsx`）
- [x] 受保護路由組件（`components/ProtectedRoute.tsx`）
 
---
 
### 🟢 Phase 1: 世界觀與角色管理 [100%]
 
#### ✅ 世界觀管理（Worlds）
- [x] 世界觀 CRUD 操作（`services/supabase/worlds.ts`）
  - 建立、讀取、更新、刪除世界觀
  - 名稱重複檢查
  - 複製世界觀功能
- [x] 世界觀列表頁面（`app/worlds/page.tsx`）
  - 卡片式顯示
  - 搜尋和分頁功能
- [x] 世界觀編輯頁面（`app/worlds/[worldId]/page.tsx`）
  - 基本資訊編輯
  - 世界規則編輯
  - 狀態 Schema 管理
 
#### ✅ 狀態 Schema 系統（WorldStateSchema）
- [x] Schema CRUD 操作（`services/supabase/world-schema.ts`）
- [x] 支援的狀態類型：
  - `number`（數字）：支援最小值、最大值、小數位數、單位
  - `text`（文字）
  - `bool`（布林）
  - `enum`（列舉）：支援選項列表
  - `list_text`（文字列表）：用於物品清單等
- [x] 每個 Schema 包含：
  - schema_key（唯一識別碼）
  - display_name（顯示名稱）
  - type（類型）
  - ai_description（AI 描述，供 Agent 理解）
  - default_value（預設值）
  - 類型特定約束（數字範圍、列舉選項等）
 
#### ✅ 角色管理（Characters）
- [x] 角色 CRUD 操作（`services/supabase/characters.ts`）
- [x] 角色列表頁面（`app/characters/page.tsx`）
  - 卡片式顯示
  - 標籤過濾
  - 搜尋和分頁
- [x] 角色編輯頁面（`app/characters/[characterId]/page.tsx`）
  - 核心角色設定（名稱、背景、性格）
  - 標籤管理
  - 複製角色功能
 
---
 
### 🟢 Phase 2: 故事建立與角色狀態系統 [100%]
 
#### ✅ 故事基礎系統
- [x] 故事 CRUD 操作（`services/supabase/stories.ts`）
- [x] 故事列表頁面（`app/stories/page.tsx`）
  - 顯示所有故事
  - 世界觀關聯顯示
  - 返回主頁按鈕
 
#### ✅ 故事建立流程
- [x] 分頁式建立介面（`app/stories/[storyId]/page.tsx`）
  - **Tab 1: 基本設定**
    - 故事標題
    - 世界觀選擇（卡片式 + 搜尋 + 分頁）
    - 故事前提
    - 遊戲模式選擇（玩家角色 / 導演模式）
    - 玩家角色指定（**自動加入故事角色列表**）
  - **Tab 2: 故事角色**
    - 角色選擇（卡片式 + 標籤過濾 + 搜尋 + 分頁）
    - **角色初始狀態設定**（展開/收合式編輯器）
  - **Tab 3: AI 設定**
    - 故事提示詞（Narrative Prompt）
    - 模型覆寫
    - 參數覆寫
 
#### ✅ 故事角色系統
- [x] 故事角色 CRUD（`services/supabase/story-characters.ts`）
  - 將角色加入故事
  - 設定顯示名稱覆寫
  - 標記玩家角色
  - 移除角色
 
#### ✅ 狀態值系統
- [x] 狀態值 CRUD（`services/supabase/story-state-values.ts`）
  - 讀取所有狀態值
  - 設定單一狀態值
  - 批量設定狀態值（upsert）
- [x] 初始狀態設定（建立故事時）
  - 自動從 Schema 載入欄位定義
  - 預填預設值
  - 支援所有狀態類型的編輯
 
#### ✅ 關係系統
- [x] 關係 CRUD（`services/supabase/story-relationships.ts`）
  - 設定角色間關係
  - 更新關係分數
  - 更新關係標籤
  - 刪除關係
 
---
 
### 🟢 Phase 3: 核心遊戲迴圈 [100%]
 
#### ✅ AI Agent 系統
 
**Narrative Agent**（`services/agents/narrative-agent.ts`）
- [x] 生成故事敘述與角色對話
- [x] System Prompt 包含：
  - 世界規則
  - 故事設定
  - 遊戲模式（PLAYER_CHARACTER / DIRECTOR）
  - 所有角色資訊（核心設定 + 當前狀態 + `is_player` 標記）
  - 角色關係
- [x] 玩家角色識別：使用 `story_characters.is_player` 欄位
- [x] 對話歷史上下文（最近 5 回合）
- [x] 繁體中文輸出
- [x] JSON 格式輸出：
  ```json
  {
    "narrative": "敘述文字",
    "dialogue": [{"speaker_story_character_id": "xxx", "text": "對話"}],
    "scene_tags": ["標籤"],
    "system_notes": ["狀態變更提示"]
  }
  ```
- [x] 參數：temperature: 0.8（較高創造力）
 
**State Delta Agent**（`services/agents/state-delta-agent.ts`）
- [x] 分析敘述並決定狀態變更
- [x] System Prompt 包含：
  - 世界狀態 Schema 定義
  - 當前所有狀態值
  - 當前關係
- [x] 讀取 Narrative Agent 的 system_notes
- [x] JSON 格式輸出：
  ```json
  {
    "changes": [{"target_story_character_id": "xxx", "schema_key": "hp", "op": "inc", "value": -10, "reason": "原因"}],
    "list_ops": [{"target_story_character_id": "xxx", "schema_key": "inventory", "op": "push", "value": "物品", "reason": "原因"}],
    "relationship_changes": [...]
  }
  ```
- [x] 參數：temperature: 0.3（較低溫度，更確定性）
 
**回合執行協調**（`services/gameplay/execute-turn.ts`）
- [x] 完整的回合執行流程：
  1. 收集上下文（世界、角色、狀態、關係、歷史）
  2. 呼叫 Narrative Agent
  3. 呼叫 State Delta Agent
  4. 套用狀態變更
  5. 儲存回合記錄
- [x] 狀態變更套用：
  - 數字：set（設定）、inc（增減）
  - 文字/布林/列舉：set
  - 列表：push（新增）、remove（移除）、set（替換）
  - 關係：set_score、inc_score、add/remove tags
- [x] 自動約束檢查：
  - 數字限制在 min/max 範圍
  - 關係分數限制在 -100 到 100
- [x] 並行資料載入優化
 
#### ✅ 回合記錄系統
- [x] 回合 CRUD（`services/supabase/story-turns.ts`）
  - 儲存玩家輸入
  - 儲存 AI 敘述
  - 儲存對話
  - 儲存場景標籤
- [x] 回合計數追蹤
 
#### ✅ 遊戲頁面 UI（`app/stories/[storyId]/play/page.tsx`）
- [x] 聊天式介面
  - 故事前提顯示（回合 0）
  - 回合歷史（玩家輸入 + AI 回應）
  - 對話氣泡顯示
  - 自動滾動到最新回合
- [x] 玩家輸入區
  - 多行文字輸入
  - Enter 送出，Shift+Enter 換行
  - 提交中狀態顯示
- [x] **即時反饋系統**
  - 用戶輸入後立即顯示訊息（樂觀 UI）
  - AI 思考中動畫（跳動點點）
  - 錯誤訊息區塊（含重試按鈕）
- [x] **狀態面板**（右側側邊欄）
  - 「顯示狀態」/「隱藏狀態」切換按鈕
  - 所有角色的當前狀態值
  - 玩家角色標記
  - 狀態類型智能顯示：
    - 數字：顯示單位
    - 布林：顯示「是」/「否」
    - 列表：逗號分隔顯示
  - 角色關係顯示：
    - 關係方向（A → B）
    - 分數顏色標示（正數綠色、負數紅色）
    - 關係標籤
- [x] 狀態即時更新（每回合後自動重新載入）
- [x] 錯誤處理與友善提示（中文錯誤訊息）
 
#### ✅ AI 整合
- [x] OpenRouter API 整合（`services/ai/openrouter.ts`）
  - API 呼叫封裝
  - 重試機制（JSON 解析錯誤自動重試）
  - JSON 解析工具（支援 markdown code block）
  - 連線測試功能
- [x] 提供商設定（`services/supabase/provider-settings.ts`）
  - API Key 管理
  - 預設模型設定
  - 預設參數設定
- [x] 設定頁面（`app/settings/page.tsx`）
 
---
 
### 🟢 Phase 4: 效能優化與穩定性 [100%]
 
#### ✅ 資料庫重試機制（`lib/supabase/retry.ts`）
- [x] 智能重試系統：
  - 首次嘗試：5 秒逾時
  - 第 2 次：7.5 秒逾時
  - 第 3 次：11.25 秒逾時
  - 最多重試 3 次
- [x] 指數退避策略（100ms → 200ms → 300ms）
- [x] 詳細錯誤訊息
- [x] 可自定義重試參數
- [x] onRetry 回調支援
- [x] 已套用至所有 Supabase 服務（9 個檔案、50+ 函數）
- [x] 完整遷移指南（`docs/RETRY_MIGRATION_GUIDE.md`）
- [x] 自動化轉換工具
 
#### ✅ 效能優化
- [x] 並行資料載入（Promise.all）
- [x] 批量操作（批量設定狀態值）
- [x] 查詢優化（減少 N+1 查詢）
- [x] 使用 Map 結構加速查找
 
#### ✅ React useEffect 最佳實踐（防止競爭條件）

**重要**：所有頁面的 `useEffect` 資料載入必須遵循以下模式：

```tsx
useEffect(() => {
  let cancelled = false;  // 1. 宣告取消標記

  const fetchData = async () => {
    // 2. 使用 user?.user_id 而非 user，且必須設定 loading = false
    if (!user?.user_id) {
      setLoading(false);  // ⚠️ 重要：避免頁面永遠卡在載入狀態
      return;
    }
    
    try {
      setLoading(true);
      const data = await getData(user.user_id);
      
      if (cancelled) return;  // 3. 每次 setState 前檢查
      
      setData(data);
    } catch (err) {
      if (cancelled) return;  // 4. 錯誤處理時也要檢查
      // handle error
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => {
    cancelled = true;  // 5. cleanup 時標記取消
  };
}, [user?.user_id, ...otherDeps]);  // 6. 依賴用 user?.user_id
```

**已套用的頁面**：
- `app/worlds/page.tsx`
- `app/worlds/[worldId]/page.tsx`
- `app/stories/page.tsx`
- `app/stories/[storyId]/page.tsx`
- `app/characters/page.tsx`
- `app/characters/[characterId]/page.tsx`

#### ✅ Toast 通知系統（Sonner）
- [x] 安裝 Sonner 套件
- [x] 在 `layout.tsx` 加入 `<Toaster />` 元件
- [x] 深色主題設定（右上角、自動消失、關閉按鈕）
- [x] 替換所有 `alert()` 為 Toast 通知（約 50 處）
  - `toast.success()` - 成功通知（綠色）
  - `toast.error()` - 錯誤通知（紅色）
  - `toast.warning()` - 警告通知（黃色）

#### ✅ Supabase onAuthStateChange 最佳實踐

**重要**：Supabase SDK 的已知問題 - 在 `onAuthStateChange` 回調中使用 `async/await` 會導致死鎖！

**問題**：當 token 刷新時，`onAuthStateChange` 被觸發，如果回調中 `await` 另一個 Supabase API 呼叫，會導致兩個請求互相等待，造成永久卡住。

**正確寫法**（`contexts/AuthContext.tsx`）：
```tsx
supabase.auth.onAuthStateChange((event, session) => {
  // ❌ 不要使用 async/await！
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.user) {
      // ✅ 使用 setTimeout 延遲執行，避免死鎖
      setTimeout(() => {
        refreshUser();  // 不要 await
      }, 0);
    }
  }
});
```

**參考**：[supabase/supabase-js#762](https://github.com/supabase/supabase-js/issues/762)
 
---
 
### 🟢 Phase 5: 前端設計系統重構 [100%]
 
#### ✅ 設計系統基礎
- [x] 建立設計 Token 系統（`lib/theme/tokens.ts`）
  - 統一的顏色系統（主色、輔助色、語義色）
  - 間距系統（基於 4px 倍數）
  - 字體系統（字體大小、行高、字重）
  - 圓角系統
  - 陰影系統（Elevation levels）
  - 動畫系統（過渡時間、緩動函數）
  - 斷點系統
  - Z-index 層級
- [x] 建立主題配置系統（`lib/theme/config.ts`）
  - 支援淺色/深色主題
  - 可擴展的主題配置
  - 基於系統偏好的自動切換
- [x] 更新 Tailwind 配置
  - 整合設計 token
  - 支援 CSS 變數
  - 擴展主題配置
 
#### ✅ UI 組件庫（`components/ui/`）
- [x] **Button**：多種變體（primary, secondary, danger, ghost, outline）
  - 支援不同尺寸（sm, md, lg）
  - 載入狀態顯示
  - 全寬選項
- [x] **Card**：卡片容器組件
  - CardHeader, CardTitle, CardContent, CardFooter 子組件
  - 多種變體（default, elevated, outlined）
  - 可配置內距
- [x] **Input**：文字輸入框
  - 支援 label、error、helperText
  - 深色模式支援
  - 無障礙標準
- [x] **Textarea**：多行輸入框
  - 與 Input 相同的功能
  - 自動調整大小
- [x] **Select**：下拉選單
  - 自定義樣式
  - 支援選項禁用
- [x] **Badge**：標籤/徽章組件
  - 多種變體（default, primary, success, error, warning, info）
  - 不同尺寸
- [x] **Alert**：提示訊息框
  - 多種變體（success, error, warning, info）
  - 支援標題和圖示
- [x] **Loading**：載入動畫
  - 不同尺寸
  - 全屏模式
  - 自定義文字
- [x] **Modal**：對話框
  - 多種尺寸（sm, md, lg, xl, full）
  - 支援 ESC 關閉
  - 點擊背景關閉
  - 自動管理 body overflow
- [x] **Tabs**：標籤頁組件
  - TabsList, TabsTrigger, TabsContent 子組件
  - Context API 管理狀態
  - 無障礙支援
 
#### ✅ 布局組件（`components/layout/`）
- [x] **Container**：響應式容器
  - 多種尺寸（sm, md, lg, xl, full）
  - 可配置內距
- [x] **Grid**：響應式網格系統
  - 可配置欄數（1-12）
  - 響應式配置（sm, md, lg, xl）
  - 可配置間距
- [x] **Stack**：垂直/水平堆疊
  - 可配置方向（row, column）
  - 可配置間距
  - 對齊和分佈選項
- [x] **Header**：頁面標題區塊
  - 支援標題和副標題
  - 返回按鈕和操作按鈕
  - Sticky 選項
- [x] **Sidebar**：側邊欄
  - 支援左右位置
  - 移動端抽屜模式
  - 可配置寬度
  - 自動管理 body overflow
 
#### ✅ 表單組件（`components/forms/`）
- [x] **FormField**：表單欄位容器
  - 統一的 label、error、helperText 顯示
  - 必填標記
- [x] **FormGroup**：表單群組
  - 統一的間距管理
  - 可配置方向
 
#### ✅ 圖示系統（`components/icons/`）
- [x] 引入 lucide-react 圖示庫
- [x] 建立 Icon 組件封裝
- [x] 導出常用圖示
- [x] 統一替換 emoji 圖示
 
#### ✅ 頁面重構
- [x] 登入頁面（`app/login/page.tsx`）
  - 使用新組件系統
  - 響應式設計優化
- [x] 註冊頁面（`app/register/page.tsx`）
  - 使用新組件系統
  - 表單驗證優化
- [x] Dashboard 頁面（`app/dashboard/page.tsx`）
  - 使用新組件系統
  - 卡片式佈局優化
- [x] 首頁（`app/page.tsx`）
  - 使用新組件系統
  - 響應式設計優化
 
#### ✅ 響應式設計優化
- [x] 觸控友好的按鈕尺寸（最小 44x44px）
- [x] 移動端優先的響應式設計
- [x] 統一的斷點系統
- [x] 移動端導航優化（抽屜式選單）
- [x] 表單輸入體驗優化
 
#### ✅ 工具函數
- [x] `lib/utils.ts`：cn 函數
  - 合併 Tailwind CSS 類名
  - 使用 clsx 和 tailwind-merge
 
---
 
## 🟡 待完成功能
 
### Phase 6: 進階功能 [0%]
 
#### ⏳ Action Suggestion Agent
- [ ] 建立建議系統（`services/agents/action-suggestion-agent.ts`）
- [ ] 生成 3 個行動建議
- [ ] 根據遊戲模式調整建議
- [ ] UI 按鈕與顯示
 
#### ⏳ 回顧系統
- [ ] ChangeLog 資料表與服務
  - 記錄每次狀態變更
  - 記錄變更前後值
  - 記錄變更原因
- [ ] 回顧頁面 UI
  - 回合列表
  - 點擊回合查看詳情
  - 狀態變更 diff 顯示
  - 關係變更歷史
 
#### ⏳ 進階互動
- [ ] 分支/回溯重玩功能
- [ ] 故事分享功能
 
---
 
## 📊 整體完成度
 
### 核心功能
- ✅ 使用者系統：100%
- ✅ 世界觀管理：100%
- ✅ 角色管理：100%
- ✅ 故事建立：100%
- ✅ 遊戲核心迴圈：100%
- ✅ 狀態追蹤：100%
- ✅ 前端設計系統：100%
- ⏳ 回顧功能：0%
- ⏳ 進階功能：0%
 
**總體完成度：約 88%**
 
---
 
## 🏗️ 技術架構
 
### 前端
- **框架**：Next.js 15（App Router）
- **語言**：TypeScript
- **樣式**：Tailwind CSS
- **設計系統**：統一的設計 Token 和主題系統
- **UI 組件庫**：自定義組件庫（Button, Card, Input, Modal 等）
- **圖示庫**：Lucide React
- **狀態管理**：React Hooks + Context API
- **通知系統**：Sonner（Toast）
- **工具函數**：clsx + tailwind-merge（類名合併）
 
### 後端與資料庫
- **資料庫**：Supabase（PostgreSQL）
- **認證**：Supabase Auth
- **安全性**：Row Level Security (RLS)
 
### AI 服務
- **提供商**：OpenRouter
- **模型**：可配置（預設 Claude 3.5 Sonnet）
- **Agent 架構**：
  - Narrative Agent（敘述生成）
  - State Delta Agent（狀態追蹤）
  - Action Suggestion Agent（建議系統，待實作）
 
### 資料結構
- **使用者與設定**：users, provider_settings
- **內容資源**：worlds, world_state_schema, characters
- **故事資料**：stories, story_characters
- **遊戲狀態**：story_state_values, story_relationships, story_turns
- **變更歷史**：change_log（待實作）
 
---
 
## 🎮 遊戲流程
 
### 建立故事流程
1. 選擇世界觀（或建立新的）
2. 選擇角色（或建立新的）
3. 設定玩家角色（可選）
4. 輸入故事標題和前提
5. **設定每個角色的初始狀態**
6. 配置 AI 設定
7. 開始遊玩
 
### 遊戲迴圈
1. **玩家輸入**：描述行動或對話
2. **AI 處理**：
   - Narrative Agent 生成敘述與對話
   - State Delta Agent 分析並決定狀態變更
3. **狀態更新**：自動套用所有變更
4. **顯示結果**：
   - 敘述與對話顯示在聊天區
   - 狀態面板即時更新
5. **繼續下一回合**
 
### 狀態追蹤
- 即時查看所有角色狀態
- 關係變化追蹤
- 物品清單管理
- 歷史變更記錄（待實作）
 
---
 
## 📝 核心設計原則
 
### 1. 兩階段 Agent 設計
- **Narrative Agent**：專注創意敘述（高 temperature）
- **State Delta Agent**：專注邏輯分析（低 temperature）
- 分離創意與邏輯，確保品質
 
### 2. System Notes 作為橋樑
- Narrative Agent 在 system_notes 記錄「發生了什麼」
- State Delta Agent 讀取 system_notes 決定狀態變更
- 例如：`"玩家受到10點傷害"` → `hp: inc -10`
 
### 3. 自動約束檢查
- 數字自動限制在 min/max 範圍
- 關係分數限制在 -100 到 100
- 列舉值需符合選項列表
 
### 4. 完整上下文記憶
- Narrative Agent 包含最近 5 回合對話歷史
- 收集上下文時載入最近 10 回合資料
- 確保故事連貫性
 
### 5. 狀態摘要自動生成
- 每個角色的當前狀態自動組合成摘要字串
- 例如：`"HP: 100, MP: 50, 位置: 森林, 物品: ['劍', '盾']"`
- AI 可以直接看到角色完整狀態
 
---
 
## 🔧 開發工具與腳本
 
### 遷移工具
- `scripts/convert-to-retry.py`：自動添加 withRetry import
- `scripts/auto-convert-retry.js`：自動轉換 Promise.race 模式
- `scripts/update-retry-mechanism.sh`：批量更新輔助腳本
 
### 文檔
- `docs/RETRY_MIGRATION_GUIDE.md`：重試機制遷移完整指南
 
---
 
## 🚀 下一步計畫
 
### 短期（1-2 週）
1. ✅ ~~完成資料庫重試機制遷移~~
2. 實作 ChangeLog 系統
3. 建立回顧頁面 UI
4. 實作 Action Suggestion Agent
 
### 中期（1 個月）
1. 完善錯誤處理
2. 新增更多測試
3. 效能優化與監控
4. UI/UX 改進
 
### 長期（2-3 個月）
1. 分支/回溯功能
2. 故事匯出功能
3. 多人協作支援
4. 行動裝置 App（Android）
 
---
 
## 📚 相關資源
 
### API 文檔
- [Supabase Documentation](https://supabase.com/docs)
- [OpenRouter API](https://openrouter.ai/docs)
- [Next.js 15 Documentation](https://nextjs.org/docs)
 
### 專案文檔
- 重試機制遷移指南：`docs/RETRY_MIGRATION_GUIDE.md`
- 資料庫 Schema：參考 Supabase 專案設定
- AI Agent 輸入輸出格式：`types/api/agents.ts`
 
---
 
## 🎯 專案目標達成狀況
 
### ✅ MVP 已完成
- [x] 使用者認證與管理
- [x] 世界觀與 Schema 完整管理
- [x] 角色管理系統
- [x] 故事建立完整流程（含初始狀態設定）
- [x] AI 雙 Agent 系統（Narrative + State Delta）
- [x] 遊戲核心迴圈
- [x] 即時狀態追蹤
- [x] 關係系統
- [x] 自動重試機制
 
### ⏳ 進行中
- [x] 完整重試機制遷移（已完成 9 個服務檔案）
- [x] 前端設計系統重構（已完成）
- [ ] ChangeLog 系統
- [ ] 回顧功能
 
### 📋 待規劃
- [ ] 進階互動功能
- [ ] 內容安全機制
- [ ] 行動裝置支援
- [ ] 其他頁面遷移至新設計系統（世界觀、角色、故事等頁面）
 
---
 
**最後更新**：2026-01-11
**當前版本**：v0.9.1-alpha
**專案狀態**：✅ 核心功能完成，修復 Supabase 載入死鎖問題，進入優化階段