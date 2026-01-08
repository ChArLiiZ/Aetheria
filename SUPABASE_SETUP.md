# Supabase 設置指南

## 1. 創建 Supabase 專案

1. 前往 [https://supabase.com](https://supabase.com)
2. 註冊或登入帳號
3. 點擊 "New Project"
4. 填寫專案資訊：
   - **Name**: Aetheria
   - **Database Password**: 設定一個強密碼（記住這個密碼）
   - **Region**: 選擇離你最近的區域（建議 Tokyo 或 Singapore）
   - **Pricing Plan**: 選擇 Free tier

5. 等待專案創建完成（約 2 分鐘）

## 2. 獲取 API 憑證

專案創建完成後：

1. 點擊左側選單的 **Settings** (齒輪圖示)
2. 點擊 **API**
3. 複製以下資訊：
   - **Project URL**: 類似 `https://xxxxx.supabase.co`
   - **anon public key**: 一串很長的 JWT token

## 3. 設置環境變數

1. 複製 `.env.example` 為 `.env.local`：
```bash
cp .env.example .env.local
```

2. 在 `.env.local` 檔案中添加以下內容：

```env
# Supabase 設定
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon public key
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

**重要說明**：
- `NEXT_PUBLIC_SUPABASE_URL`: 從 Settings > API 複製 Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 從 Settings > API 複製 anon public key
- `SUPABASE_SERVICE_ROLE_KEY`: 從 Settings > API 複製 service_role key（點擊眼睛圖示顯示）
- ⚠️ service_role key 是管理員金鑰，請勿暴露在前端或提交到版本控制

## 4. 安裝相依套件

確保已安裝必要的套件：

```bash
npm install @supabase/supabase-js bcryptjs
npm install --save-dev @types/bcryptjs
```

## 5. 執行資料庫 Migration

### 第一步：建立資料表結構

1. 在 Supabase Dashboard 中，點擊左側的 **SQL Editor**
2. 點擊 **New query**
3. 複製 `supabase/migrations/001_initial_schema.sql` 的內容
4. 貼上並點擊 **Run**

這個遷移會建立所有必要的資料表：
- users（使用者）
- provider_settings（AI 供應商設定）
- worlds（世界觀）
- world_state_schema（狀態種類定義）
- characters（角色）
- stories（故事）
- story_characters、story_character_overrides（故事角色）
- story_state_values、story_relationships（狀態與關係）
- story_turns（回合記錄）
- change_log（變更日誌）

### 第二步：設置 Row Level Security (RLS)

1. 同樣在 SQL Editor 中，點擊 **New query**
2. 複製 `supabase/migrations/002_rls_policies.sql` 的內容
3. 貼上並點擊 **Run**

RLS 確保：
- 使用者只能存取自己的資料
- 新使用者可以註冊帳號
- 所有資料操作都經過權限驗證

## 6. 完成！

設置完成後，重新啟動開發伺服器：

```bash
npm run dev
```

## 疑難排解

### 連接錯誤

如果遇到連接錯誤，檢查：
- `.env.local` 中的 URL 和 Key 是否正確
- 是否已重啟開發伺服器

### RLS 錯誤

如果遇到權限錯誤，確認：
- RLS policies 是否已正確執行
- 用戶是否已登入

## 資料遷移（從 Google Sheets）

如果你有現有資料需要遷移：
1. 從 Google Sheets 匯出資料為 CSV
2. 在 Supabase Dashboard 中使用 Table Editor 匯入
3. 或使用提供的遷移腳本（待開發）
