# Google Apps Script API 設定指南

此指南教您如何設定 Google Apps Script 作為 Aetheria 的後端 API。

## 為什麼需要 Apps Script？

- ✅ **API Key 只能讀取，無法寫入** Google Sheets
- ✅ Apps Script 可以完整讀寫您的 Spreadsheet
- ✅ 完全免費
- ✅ 不需要額外的伺服器
- ✅ 自動支援 CORS

---

## 📝 設定步驟

### 步驟 1: 開啟 Apps Script 編輯器

1. 開啟您的 Spreadsheet：
   ```
   https://docs.google.com/spreadsheets/d/1FaD6CuxbuX7Gm2-jtiJwEtTouHwxdDIE2Sbj1RxFtr0/edit
   ```

2. 點選上方選單：**擴充功能** → **Apps Script**

3. 會開啟一個新分頁，顯示 Apps Script 編輯器

### 步驟 2: 貼上程式碼

1. 刪除編輯器中的預設程式碼 (`function myFunction() {...}`)

2. 複製 `google-apps-script/Code.gs` 檔案的全部內容

3. 貼到 Apps Script 編輯器中

4. 點選左上角的**磁碟圖示**儲存，或按 `Ctrl+S`

### 步驟 3: 部署為 Web App

1. 點選右上角的**「部署」**按鈕 → **「新增部署作業」**

2. 在「選取類型」點選**齒輪圖示** → 選擇**「網頁應用程式」**

3. 設定如下：
   - **說明**：Aetheria API（可自訂）
   - **執行身分**：**我**
   - **具有存取權的使用者**：**所有人**（重要！）

4. 點選**「部署」**

5. **授權流程**：
   - 會彈出「需要授權」視窗
   - 點選**「審查權限」**
   - 選擇您的 Google 帳號
   - 可能會顯示「Google 尚未驗證這個應用程式」警告
   - 點選**「進階」** → **「前往 xxx（不安全）」**
   - 點選**「允許」**

6. 部署完成後，會顯示**網頁應用程式 URL**：
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

7. **複製這個 URL**！（非常重要）

### 步驟 4: 更新環境變數

1. 開啟專案根目錄的 `.env.local` 檔案

2. 新增以下行（用您複製的 URL 替換）：
   ```env
   NEXT_PUBLIC_SPREADSHEET_ID=1FaD6CuxbuX7Gm2-jtiJwEtTouHwxdDIE2Sbj1RxFtr0
   NEXT_PUBLIC_GOOGLE_API_KEY=your_api_key_here
   NEXT_PUBLIC_SHEETS_API_URL=https://script.google.com/macros/s/AKfycby.../exec
   ```

3. 儲存檔案

### 步驟 5: 重啟開發伺服器

```powershell
# 停止開發伺服器 (Ctrl+C)
# 重新啟動
npm run dev
```

---

## 🧪 測試 Apps Script API

1. 訪問：http://localhost:3000/sheets-test

2. 點選「**測試 Apps Script 連接**」

3. 應該會看到：
   ```json
   {
     "success": true,
     "message": "Apps Script API 運作正常"
   }
   ```

---

## 🔧 進階設定

### 更新已部署的 Apps Script

如果您修改了 Apps Script 程式碼：

1. 儲存程式碼 (Ctrl+S)
2. 點選**「部署」** → **「管理部署作業」**
3. 點選最新部署旁的**「編輯」**（鉛筆圖示）
4. 在「版本」下拉選單選擇**「新版本」**
5. 點選**「部署」**

**注意**：URL 不會改變，不需要更新 `.env.local`

### 測試 Apps Script（在瀏覽器中）

您可以直接在瀏覽器測試 Apps Script API：

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=checkSheets
```

應該會返回 JSON 格式的結果。

### 查看 Apps Script 執行記錄

1. 在 Apps Script 編輯器中
2. 點選左側選單的**「執行作業」**
3. 可以看到所有 API 呼叫的記錄和錯誤

---

## ❓ 常見問題

### Q: 為什麼需要選擇「所有人」都可存取？

A: 因為您的前端應用程式（在瀏覽器中執行）需要能夠呼叫這個 API。選擇「所有人」表示任何知道 URL 的人都可以呼叫，但這個 URL 很難猜測，且只能存取您的 Spreadsheet。

### Q: 這樣安全嗎？

A: 對於開發和個人使用來說是安全的。但生產環境建議：
- 在 Apps Script 中加入身份驗證（檢查 token）
- 限制 CORS 來源
- 或使用 Service Account + 後端伺服器

### Q: Apps Script 有使用限制嗎？

A: 免費版限制：
- 每天 20,000 次 URL 請求
- 每次執行最多 6 分鐘
- 對於一般使用綽綽有餘

### Q: 部署後 URL 會改變嗎？

A: 不會。除非您建立新的部署，否則 URL 永久不變。

### Q: 如何撤銷授權？

A:
1. 前往 https://myaccount.google.com/permissions
2. 找到 Apps Script 專案
3. 點選「移除存取權」

---

## ✅ 驗證清單

完成設定後，請確認：

- [ ] Apps Script 程式碼已貼上並儲存
- [ ] 已部署為 Web App
- [ ] 已完成授權流程
- [ ] 已複製 Web App URL
- [ ] 已在 `.env.local` 中設定 `NEXT_PUBLIC_SHEETS_API_URL`
- [ ] 已重啟開發伺服器
- [ ] 測試頁面可以成功連接 Apps Script

---

## 🚀 下一步

設定完成後，您就可以：

1. ✅ **註冊帳號** - 資料會真正寫入 Google Sheets
2. ✅ **登入** - 從 Google Sheets 讀取帳號資料
3. ✅ **建立世界觀和角色** - 所有資料都會儲存
4. ✅ **開始創作故事**

恭喜！您已經完成 Aetheria 的後端設定！🎉
