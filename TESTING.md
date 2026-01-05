# 🧪 Aetheria 測試指南

## 快速開始測試

### 1️⃣ 啟動開發伺服器

```bash
npm run dev
```

伺服器將在以下位置啟動：
- **本地**: http://localhost:3000
- **網路**: http://21.0.0.30:3000

### 2️⃣ 測試頁面

開啟瀏覽器，訪問以下頁面：

#### 🏠 首頁
```
http://localhost:3000
```
- 專案介紹
- 導航連結

#### 🧪 測試頁面
```
http://localhost:3000/test
```
- 測試類型系統
- 檢查環境變數
- 查看範例資料結構

#### 📊 Dashboard（開發中）
```
http://localhost:3000/dashboard
```
- 尚未實作，會顯示 404

---

## 測試功能

### ✅ 目前可測試的功能

1. **類型系統測試**
   - 點擊「測試類型系統」按鈕
   - 查看 World、Character、WorldStateSchema 的範例資料
   - 驗證 TypeScript 類型定義是否正確

2. **環境變數檢查**
   - 點擊「檢查環境變數」按鈕
   - 查看 Spreadsheet ID 和 API Key 是否設定

3. **UI/UX 測試**
   - 測試響應式設計（調整瀏覽器視窗大小）
   - 測試深色模式切換
   - 測試按鈕互動效果

---

## 進階測試（需要設定）

### 📝 設定 Google Sheets

如需測試完整的資料庫功能：

1. **建立 Google Spreadsheet**
   ```
   名稱：Aetheria_DB
   ```

2. **建立以下 Worksheets（標籤頁）**
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

3. **設定每個 Worksheet 的 Header（第一列）**

   參考 `plan.md` 中的欄位定義，例如：

   **Users 表**：
   ```
   user_id | email | display_name | password_hash | created_at | updated_at | status | last_login_at
   ```

   **Worlds 表**：
   ```
   world_id | user_id | name | description | rules_text | created_at | updated_at
   ```

4. **取得 Spreadsheet ID**
   - 從 URL 複製：
     ```
     https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
     ```

5. **設定 Google Cloud Console**
   - 前往 https://console.cloud.google.com/
   - 建立新專案或選擇現有專案
   - 啟用「Google Sheets API」
   - 建立 API Key（設定 HTTP referrer 限制）

6. **更新環境變數**

   編輯 `.env.local`：
   ```env
   NEXT_PUBLIC_SPREADSHEET_ID=your_actual_spreadsheet_id
   NEXT_PUBLIC_GOOGLE_API_KEY=your_actual_api_key
   ```

7. **重新啟動開發伺服器**
   ```bash
   # 按 Ctrl+C 停止
   npm run dev
   ```

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
- ✓ 匯出完成

---

## 常見問題排除

### ❌ 建置錯誤

**問題**：TypeScript 類型錯誤
```bash
npm run build
```
如有錯誤，檢查類型定義是否正確。

### ❌ 開發伺服器無法啟動

**問題**：Port 3000 被占用
```bash
# 指定其他 port
PORT=3001 npm run dev
```

### ❌ Google Sheets API 錯誤

**問題**：401 Unauthorized
- 檢查 API Key 是否正確
- 檢查 Google Sheets API 是否已啟用
- 檢查 Spreadsheet 是否設定為「任何人都可以查看」

### ❌ 環境變數未生效

**問題**：環境變數讀取為空
- 確認 `.env.local` 檔案存在
- 確認變數名稱以 `NEXT_PUBLIC_` 開頭
- 重新啟動開發伺服器

---

## 測試檢查清單

- [ ] 首頁正常顯示
- [ ] 測試頁面可訪問
- [ ] 類型系統測試通過
- [ ] 環境變數正確讀取
- [ ] 響應式設計正常
- [ ] 深色模式切換正常
- [ ] 建置無錯誤
- [ ] 生產模式啟動正常

---

## 下一步

完成基本測試後，可以開始開發：

1. ✅ 認證系統（登入/註冊）
2. ✅ Dashboard 頁面
3. ✅ 世界觀管理 UI
4. ✅ 角色管理 UI
5. ✅ 故事建立 Wizard
6. ✅ AI Agent 整合
7. ✅ 遊玩頁面
8. ✅ 故事回顧

---

## 需要協助？

- 查看 `README.md` 了解專案架構
- 查看 `plan.md` 了解完整規格
- 檢查程式碼註解
