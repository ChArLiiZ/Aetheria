# Aetheria - AI 互動小說應用程式

基於 Next.js (TypeScript) 的跨平台 AI 互動小說應用程式。

## 技術棧

- **前端框架**: Next.js 15 + React 19 + TypeScript
- **樣式**: Tailwind CSS
- **資料庫**: Google Sheets (透過 Google Sheets API)
- **AI**: OpenRouter API
- **桌面端**: Tauri (Windows)
- **移動端**: PWA (Android)

## 專案結構

```
Aetheria/
├── app/                    # Next.js App Router 頁面
│   ├── dashboard/         # 儀表板
│   ├── worlds/            # 世界觀管理
│   ├── characters/        # 角色管理
│   ├── stories/           # 故事管理與遊玩
│   ├── settings/          # 設定頁面
│   ├── layout.tsx         # 根佈局
│   └── page.tsx           # 首頁
├── components/            # React 元件
│   ├── ui/               # 通用 UI 元件
│   ├── layout/           # 佈局元件
│   ├── worlds/           # 世界觀相關元件
│   ├── characters/       # 角色相關元件
│   └── stories/          # 故事相關元件
├── lib/                   # 工具函式
│   ├── db/               # 資料庫客戶端
│   └── ai/               # AI 相關工具
├── services/              # 業務邏輯服務
│   ├── sheets/           # Google Sheets CRUD 服務
│   └── ai/               # AI Agent 服務
├── types/                 # TypeScript 類型定義
│   ├── database/         # 資料庫 Schema 類型
│   └── api/              # API 相關類型
└── public/               # 靜態資源

```

## 已完成功能

### ✅ 核心架構
- [x] Next.js 專案初始化
- [x] TypeScript 配置
- [x] Tailwind CSS 配置
- [x] 專案目錄結構建立

### ✅ 類型系統
- [x] 完整的資料庫 Schema 類型定義
- [x] AI Agent 輸入輸出類型定義
- [x] OpenRouter API 類型定義

### ✅ Google Sheets 整合
- [x] Sheets 客戶端基礎設施
- [x] Users 表 CRUD
- [x] Worlds 表 CRUD
- [x] WorldStateSchema 表 CRUD (支援動態 Schema 變更)
- [x] Characters 表 CRUD

### ✅ AI 整合基礎
- [x] OpenRouter API 客戶端
- [x] JSON 解析錯誤重試機制
- [x] API 連線測試功能

## 待完成功能

### 🔲 資料層
- [ ] Stories 表 CRUD
- [ ] StoryCharacters 表 CRUD
- [ ] StoryStateValues 表 CRUD
- [ ] StoryRelationships 表 CRUD
- [ ] StoryTurns 表 CRUD
- [ ] ChangeLog 表 CRUD
- [ ] ProviderSettings 表 CRUD

### 🔲 AI Agent 系統
- [ ] Narrative Agent (敘事與對話生成)
- [ ] State Delta Agent (狀態變更生成)
- [ ] Action Suggestion Agent (行動建議)
- [ ] Prompt 組裝系統

### 🔲 UI 頁面
- [ ] 認證系統 (登入/註冊)
- [ ] Dashboard 頁面
- [ ] 世界觀管理頁面 (CRUD + Schema 編輯器)
- [ ] 角色管理頁面 (CRUD)
- [ ] 故事建立 Wizard (8步驟)
- [ ] 故事遊玩頁面 (主畫面 + 側邊欄)
- [ ] 故事回顧頁面
- [ ] 設定頁面 (AI 配置)

### 🔲 跨平台支援
- [ ] PWA 配置 (Android)
- [ ] Tauri 配置 (Windows)
- [ ] 離線支援
- [ ] 多裝置同步

## 開發指令

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 建置
npm run build

# 生產模式
npm start

# 程式碼檢查
npm run lint
```

## 環境變數

創建 `.env.local` 檔案:

```env
NEXT_PUBLIC_SPREADSHEET_ID=your_spreadsheet_id
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
```

## Google Sheets 設定

1. 建立一個新的 Google Spreadsheet，命名為 `Aetheria_DB`
2. 創建以下 worksheets (tabs):
   - Users
   - ProviderSettings
   - Worlds
   - WorldStateSchema
   - Characters
   - Stories
   - StoryCharacters
   - StoryCharacterOverrides
   - StoryStateValues
   - StoryRelationships
   - StoryTurns
   - ChangeLog

3. 每個 worksheet 的第一列需要設定對應的欄位名稱 (請參考 plan.md)

## 架構設計重點

### 資料隔離
- 所有資料表都包含 `user_id` 欄位
- 所有查詢都必須以 `user_id` 篩選
- 實現多使用者邏輯隔離

### 動態 Schema
- 支援執行時修改世界觀狀態 Schema
- 自動傳播 Schema 變更到既有故事
- 硬刪除支援 (刪除 Schema 同時刪除相關資料)

### AI Agent 管線
- Narrative Agent: 只產出敘事與對話
- State Delta Agent: 產出可套用的狀態變更
- 變更自動套用，不需玩家確認
- JSON 解析失敗自動重試

### 回合制遊玩
- 每個回合記錄玩家輸入、AI 敘事、狀態變更
- ChangeLog 記錄所有狀態變化
- 支援回顧與 diff 查看

## 授權

Private Project
