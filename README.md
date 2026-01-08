# Aetheria - AI 互動小說應用程式

基於 Next.js (TypeScript) 的跨平台 AI 互動小說應用程式。

## 技術棧

- **前端框架**: Next.js 15 + React 19 + TypeScript
- **樣式**: Tailwind CSS
- **資料庫**: Supabase (PostgreSQL)
- **AI**: OpenRouter / Google Gemini / OpenAI
- **桌面端**: Tauri (Windows)
- **移動端**: PWA (Android)

## 專案結構

```
Aetheria/
├── app/                    # Next.js App Router 頁面
│   ├── api/               # API Routes
│   │   └── auth/         # 認證 API
│   ├── dashboard/         # 儀表板
│   ├── worlds/            # 世界觀管理
│   ├── characters/        # 角色管理
│   ├── stories/           # 故事管理與遊玩
│   ├── settings/          # 設定頁面
│   ├── layout.tsx         # 根佈局
│   └── page.tsx           # 首頁
├── components/            # React 元件
│   ├── ui/               # 通用 UI 元件
│   ├── auth/             # 認證元件
│   └── layout/           # 佈局元件
├── lib/                   # 工具函式
│   ├── supabase/         # Supabase 客戶端
│   ├── auth/             # 認證工具
│   └── ai/               # AI 相關工具
├── services/              # 業務邏輯服務
│   └── supabase/         # Supabase CRUD 服務
├── types/                 # TypeScript 類型定義
│   ├── database/         # 資料庫 Schema 類型
│   ├── supabase.ts       # Supabase 類型
│   └── api/              # API 相關類型
├── supabase/              # 資料庫遷移
│   └── migrations/       # SQL 遷移檔案
└── public/               # 靜態資源
```

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 Supabase

請參考 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 詳細設定指南。

簡要步驟：
1. 在 [Supabase](https://supabase.com) 建立專案
2. 執行資料庫遷移（`supabase/migrations/*.sql`）
3. 設定環境變數（`.env.local`）

### 3. 環境變數設定

複製 `.env.example` 為 `.env.local`：

```bash
cp .env.example .env.local
```

填入你的 Supabase 憑證：

```env
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Anon Key
SUPABASE_SERVICE_ROLE_KEY=你的 Service Role Key
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

前往 http://localhost:3000

## 已完成功能

### ✅ 核心架構
- [x] Next.js 專案初始化
- [x] TypeScript 配置
- [x] Tailwind CSS 配置
- [x] 專案目錄結構建立

### ✅ 資料庫 (Supabase)
- [x] 完整的資料庫 Schema（12 個資料表）
- [x] Row Level Security (RLS) 政策
- [x] Users 表 CRUD
- [x] Worlds 表 CRUD
- [x] WorldStateSchema 表 CRUD
- [x] Characters 表 CRUD
- [x] ProviderSettings 表 CRUD

### ✅ 認證系統
- [x] 使用者註冊
- [x] 使用者登入
- [x] 密碼加密 (bcrypt)
- [x] Session 管理
- [x] 更新個人資料
- [x] 密碼變更

### ✅ UI 頁面
- [x] 登入/註冊頁面
- [x] Dashboard 頁面
- [x] 世界觀管理頁面（CRUD + 狀態種類編輯器）
- [x] 角色管理頁面（CRUD + 標籤）
- [x] 設定頁面（AI 供應商 + 帳號管理）

### ✅ AI 整合
- [x] OpenRouter API 客戶端
- [x] Google Gemini API 支援
- [x] OpenAI API 支援
- [x] API 連線測試功能
- [x] 供應商設定管理

## 待完成功能

### 🔲 資料層
- [ ] Stories 表 CRUD
- [ ] StoryCharacters 表 CRUD
- [ ] StoryStateValues 表 CRUD
- [ ] StoryRelationships 表 CRUD
- [ ] StoryTurns 表 CRUD
- [ ] ChangeLog 表 CRUD

### 🔲 AI Agent 系統
- [ ] Narrative Agent (敘事與對話生成)
- [ ] State Delta Agent (狀態變更生成)
- [ ] Action Suggestion Agent (行動建議)
- [ ] Prompt 組裝系統

### 🔲 故事系統
- [ ] 故事建立 Wizard
- [ ] 故事遊玩頁面
- [ ] 故事回顧頁面
- [ ] 狀態變更可視化

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

## 架構設計重點

### 資料隔離
- 使用 Supabase Row Level Security (RLS)
- 所有資料表都包含 `user_id` 欄位
- 使用者只能存取自己的資料
- 實現多使用者邏輯隔離

### 動態 Schema
- 支援執行時修改世界觀狀態 Schema
- 自動傳播 Schema 變更到既有故事
- 支援 5 種狀態類型：number, text, bool, enum, list_text

### AI Agent 管線
- 支援多個 AI 供應商
- Narrative Agent: 產出敘事與對話
- State Delta Agent: 產出可套用的狀態變更
- 變更自動套用，不需玩家確認

### 回合制遊玩
- 每個回合記錄玩家輸入、AI 敘事、狀態變更
- ChangeLog 記錄所有狀態變化
- 支援回顧與 diff 查看

## 安全性

- ✅ 密碼使用 bcrypt 加密存儲
- ✅ Row Level Security 確保資料隔離
- ✅ API Routes 保護敏感操作
- ✅ Service Role Key 只在伺服器端使用
- ✅ 環境變數不提交到版本控制

## 授權

Private Project
