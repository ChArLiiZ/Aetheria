# 🔄 Google Apps Script 重新部署指南

## ⚠️ 重要提示

如果您已經修改了 Apps Script 代碼，**必須重新部署**才能讓更改生效！

---

## 📋 完整重新部署步驟

### 步驟 1：開啟 Apps Script 編輯器

1. 開啟您的 Google Spreadsheet：
   https://docs.google.com/spreadsheets/d/1FaD6CuxbuX7Gm2-jtiJwEtTouHwxdDIE2Sbj1RxFtr0/edit

2. 點擊頂部選單：**擴充功能** → **Apps Script**

### 步驟 2：更新程式碼

1. 刪除編輯器中的所有現有代碼

2. 複製 `/home/user/Aetheria/google-apps-script/Code.gs` 的**完整內容**

3. 貼上到 Apps Script 編輯器

4. 點擊 **儲存**（或按 Ctrl+S）

### 步驟 3：測試執行（重要！）

在重新部署前，先測試一下代碼是否正常：

1. 在編輯器頂部的函數下拉選單中選擇 `checkAllSheets`

2. 點擊 **執行**（▶️ 按鈕）

3. **第一次執行會要求授權**：
   - 點擊「審查權限」
   - 選擇您的 Google 帳號
   - 點擊「進階」
   - 點擊「前往 [您的專案名稱]（不安全）」
   - 點擊「允許」

4. 檢查執行記錄（底部的「執行記錄」標籤），確認沒有錯誤

### 步驟 4：部署為 Web App

**🔴 關鍵步驟：必須建立新的部署！**

#### 選項 A：建立新部署（推薦）

1. 點擊右上角 **部署** → **新增部署作業**

2. 點擊齒輪圖示 ⚙️ → 選擇 **網頁應用程式**

3. 設定如下：
   - **說明**：`Aetheria API v2`（或任何描述）
   - **執行身分**：**我**
   - **具有存取權的使用者**：**所有人**

4. 點擊 **部署**

5. **複製新的 Web App URL**（格式：`https://script.google.com/macros/s/...../exec`）

6. **重要**：將新的 URL 更新到 `.env.local` 的 `NEXT_PUBLIC_SHEETS_API_URL`

#### 選項 B：管理現有部署（如果您已有部署）

1. 點擊右上角 **部署** → **管理部署作業**

2. 找到現有的部署，點擊 **編輯**（鉛筆圖示）

3. 在 **版本** 下拉選單中選擇 **新版本**

4. 點擊 **部署**

5. URL 會保持不變，但代碼已更新

### 步驟 5：驗證部署

1. 複製 Web App URL

2. 在瀏覽器中訪問：`您的URL?action=checkSheets`

3. 應該會看到類似這樣的 JSON 響應：
   ```json
   {
     "success": true,
     "data": {
       "Users": true,
       "ProviderSettings": true,
       ...
     }
   }
   ```

### 步驟 6：更新 .env.local（如果 URL 改變）

如果您建立了新的部署，URL 會改變：

1. 編輯 `/home/user/Aetheria/.env.local`

2. 更新 `NEXT_PUBLIC_SHEETS_API_URL`：
   ```
   NEXT_PUBLIC_SHEETS_API_URL=https://script.google.com/macros/s/您的新URL/exec
   ```

3. **重啟開發伺服器**：
   - 停止當前的伺服器（Ctrl+C）
   - 重新執行：`npm run dev`

---

## 🧪 測試寫入功能

部署完成後：

1. 訪問：http://localhost:3000/sheets-test

2. 點擊 **「3. 測試寫入 (Users)」**

3. **立即**切換到 Google Sheets

4. **重新整理** Google Sheets 頁面

5. 檢查 **Users** tab 是否有新的測試資料

---

## 🐛 常見問題

### Q1: 點擊「測試寫入」後顯示成功，但 Sheets 沒有資料

**原因**：Apps Script 沒有重新部署，或部署時沒有選擇「新版本」

**解決**：
- 按照上方步驟重新部署
- 確保選擇了「新版本」或建立了「新的部署作業」

### Q2: 403 或 401 錯誤

**原因**：權限設定不正確

**解決**：
- 確認「執行身分」選擇「我」
- 確認「具有存取權的使用者」選擇「所有人」
- 重新授權（步驟 3）

### Q3: 找不到工作表錯誤

**原因**：Sheet 名稱不正確或不存在

**解決**：
- 確認 Spreadsheet 中有 `Users`、`ProviderSettings` 等 12 個 tabs
- 確認名稱完全一致（區分大小寫）

---

## 📝 檢查清單

重新部署前：
- [ ] 已更新 Code.gs 代碼
- [ ] 已儲存代碼
- [ ] 已測試執行 `checkAllSheets`
- [ ] 已授權 Apps Script

部署時：
- [ ] 已建立新部署或選擇新版本
- [ ] 「執行身分」= 我
- [ ] 「具有存取權的使用者」= 所有人
- [ ] 已複製 Web App URL

部署後：
- [ ] 已在瀏覽器測試 URL
- [ ] 已更新 .env.local（如果 URL 改變）
- [ ] 已重啟開發伺服器
- [ ] sheets-test 頁面可以成功寫入資料
- [ ] Google Sheets 中可以看到新資料

---

## ✅ 完成！

如果以上步驟都正確執行，您應該能夠：
- ✅ 成功寫入測試資料到 Google Sheets
- ✅ 成功註冊新用戶
- ✅ 在 Google Sheets Users tab 看到新用戶資料

有任何問題，請檢查瀏覽器 Console 的錯誤訊息。
