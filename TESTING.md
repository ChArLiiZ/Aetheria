# 🧪 Aetheria 測試指南

## 快速開始測試

### 1️⃣ 設定 Supabase

在測試之前，請先完成 Supabase 設定：

1. 參考 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 設定資料庫
2. 執行資料庫遷移（`supabase/migrations/*.sql`）
3. 設定環境變數（`.env.local`）

### 2️⃣ 啟動開發伺服器

```bash
npm run dev
```

伺服器將在以下位置啟動：
- **本地**: http://localhost:3000
- **網路**: http://21.0.0.x:3000

---

## 功能測試

### ✅ 認證系統測試

#### 1. 註冊新帳號
```
http://localhost:3000/register
```
- 輸入 Email、顯示名稱、密碼
- 密碼至少 6 個字符
- 測試重複 Email 的錯誤處理

#### 2. 登入測試
```
http://localhost:3000/login
```
- 使用註冊的帳號登入
- 測試錯誤密碼的處理
- 測試記住登入狀態

#### 3. Dashboard
```
http://localhost:3000/dashboard
```
- 成功登入後應自動導向 Dashboard
- 檢查使用者名稱顯示
- 測試登出功能

---

### ✅ 世界觀管理測試

#### 1. 建立世界觀
```
http://localhost:3000/worlds
```
- 點擊「建立新世界觀」
- 填寫基本資訊（名稱、描述、核心設定）
- 在「狀態種類」標籤中新增狀態：
  - 數字類型（number）- 測試最小/最大值
  - 文字類型（text）
  - 布林類型（bool）
  - 列舉類型（enum）- 測試多個選項
  - 文字列表（list_text）- 測試動態新增項目
- 測試重複名稱的驗證

#### 2. 編輯世界觀
- 修改基本資訊
- 新增/刪除/編輯狀態種類
- 測試排序功能

#### 3. 刪除世界觀
- 測試刪除確認
- 確認關聯的狀態種類也被刪除

---

### ✅ 角色管理測試

#### 1. 建立角色
```
http://localhost:3000/characters
```
- 點擊「建立新角色」
- 填寫角色名稱
- 填寫核心設定（測試預設範本）
- 新增標籤（動態新增/刪除）
- 測試重複名稱的驗證

#### 2. 編輯角色
- 修改角色資訊
- 新增/刪除標籤

#### 3. 刪除角色
- 測試刪除確認

---

### ✅ 設定頁面測試

#### 1. AI 供應商設定
```
http://localhost:3000/settings
```
- 測試兩個供應商（OpenRouter、OpenAI）
- 輸入 API Key
- 選擇預設模型或手動輸入
- 調整參數（temperature、max_tokens、top_p）
- 測試連接功能：
  - 成功連接顯示綠色提示
  - 失敗連接顯示錯誤訊息
- 測試儲存設定
- 測試刪除設定

#### 2. 帳號管理
- 更新顯示名稱
- 更改密碼：
  - 測試舊密碼驗證
  - 測試新密碼長度驗證
  - 測試確認密碼匹配

---

## 資料庫測試

### 📊 Supabase Dashboard 檢查

前往你的 Supabase 專案 Dashboard：

1. **Table Editor** - 檢查資料：
   - `users` - 註冊的使用者
   - `worlds` - 建立的世界觀
   - `world_state_schema` - 狀態種類定義
   - `characters` - 建立的角色
   - `provider_settings` - AI 供應商設定

2. **RLS Policies** - 驗證權限：
   - 確認只能看到自己的資料
   - 測試用不同帳號登入

3. **SQL Editor** - 執行查詢：
   ```sql
   -- 檢查使用者數量
   SELECT COUNT(*) FROM users;

   -- 檢查世界觀數量
   SELECT COUNT(*) FROM worlds;

   -- 檢查特定使用者的資料
   SELECT * FROM worlds WHERE user_id = 'your-user-id';
   ```

---

## UI/UX 測試

### 響應式設計
- 調整瀏覽器視窗大小
- 測試手機尺寸（375px）
- 測試平板尺寸（768px）
- 測試桌面尺寸（1024px+）

### 深色模式
- 測試深色模式切換（如有實作）
- 檢查對比度和可讀性

### 互動測試
- 按鈕 hover 效果
- 表單驗證提示
- 載入狀態顯示
- 錯誤訊息顯示

---

## 建置測試

### 測試生產版本建置

```bash
# 建置專案
npm run build

# 啟動生產模式
npm start
```

### 檢查建置輸出

建置成功後會看到：
- ✓ 編譯成功
- ✓ 靜態頁面生成
- ✓ 優化完成

---

## 常見問題排除

### ❌ Supabase 連線錯誤

**問題**：Missing Supabase environment variables
- 確認 `.env.local` 檔案存在
- 確認所有三個變數都已設定：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- 重新啟動開發伺服器

### ❌ RLS 錯誤

**問題**：Row Level Security policy violation
- 確認已執行 `002_rls_policies.sql`
- 檢查 Supabase Dashboard > Authentication > Policies
- 確認使用者已登入

### ❌ 註冊/登入失敗

**問題**：401 或 403 錯誤
- 檢查瀏覽器控制台的錯誤訊息
- 確認 Supabase Auth 設定正常
- 確認資料庫遷移已完成

### ❌ 開發伺服器無法啟動

**問題**：Port 3000 被占用
```bash
# 指定其他 port
PORT=3001 npm run dev
```

### ❌ 環境變數未生效

**問題**：環境變數讀取為空
- 確認 `.env.local` 檔案存在
- 確認變數名稱拼寫正確
- 重新啟動開發伺服器（必須）

---

## 測試檢查清單

### 基礎功能
- [ ] 註冊新帳號成功
- [ ] 登入功能正常
- [ ] Dashboard 正常顯示
- [ ] 登出功能正常

### 世界觀管理
- [ ] 建立世界觀成功
- [ ] 編輯世界觀正常
- [ ] 刪除世界觀正常
- [ ] 狀態種類新增/編輯/刪除正常
- [ ] 所有 5 種狀態類型都能正常使用

### 角色管理
- [ ] 建立角色成功
- [ ] 編輯角色正常
- [ ] 刪除角色正常
- [ ] 標籤管理正常

### 設定頁面
- [ ] AI 供應商設定正常
- [ ] API 連接測試成功
- [ ] 參數調整正常
- [ ] 帳號管理功能正常
- [ ] 密碼更改成功

### 資料庫
- [ ] Supabase 連線正常
- [ ] RLS 政策正常運作
- [ ] 資料正確儲存
- [ ] 資料隔離正常（多使用者）

### UI/UX
- [ ] 響應式設計正常
- [ ] 按鈕互動效果正常
- [ ] 表單驗證正常
- [ ] 錯誤訊息顯示正確
- [ ] 載入狀態正常

### 建置
- [ ] 建置無錯誤
- [ ] 生產模式啟動正常

---

## 下一步

完成基本測試後，可以開始開發剩餘功能：

1. Action Suggestion Agent
2. ChangeLog 回顧/差異 UI
3. 故事回顧頁面與匯出
---

## 需要協助？

- 查看 [README.md](./README.md) 了解專案架構
- 查看 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 了解資料庫設定
- 查看 [plan.md](./plan.md) 了解完整規格
- 檢查程式碼註解


