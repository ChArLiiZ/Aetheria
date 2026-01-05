# Google Sheets 設定指南

您的 Spreadsheet ID: `1FaD6CuxbuX7Gm2-jtiJwEtTouHwxdDIE2Sbj1RxFtr0`

## 📝 快速設定步驟

### 1. 開啟您的 Google Spreadsheet

訪問：https://docs.google.com/spreadsheets/d/1FaD6CuxbuX7Gm2-jtiJwEtTouHwxdDIE2Sbj1RxFtr0/edit

### 2. 建立所有必要的 Worksheets（標籤頁）

在 Spreadsheet 底部點擊「+」建立新的 worksheet，需要建立以下 **12 個標籤頁**：

1. `Users`
2. `ProviderSettings`
3. `Worlds`
4. `WorldStateSchema`
5. `Characters`
6. `Stories`
7. `StoryCharacters`
8. `StoryCharacterOverrides`
9. `StoryStateValues`
10. `StoryRelationships`
11. `StoryTurns`
12. `ChangeLog`

⚠️ **重要**：標籤名稱必須完全一致（區分大小寫）！

### 3. 設定每個 Worksheet 的 Header（第一列）

在每個 worksheet 的第一列（A1 開始）輸入對應的欄位名稱：

#### 📋 Users
```
user_id	email	display_name	password_hash	created_at	updated_at	status	last_login_at
```

#### 📋 ProviderSettings
```
user_id	provider	api_key	default_model	default_params_json	updated_at
```

#### 📋 Worlds
```
world_id	user_id	name	description	rules_text	created_at	updated_at
```

#### 📋 WorldStateSchema
```
schema_id	world_id	user_id	schema_key	display_name	type	ai_description	default_value_json	enum_options_json	number_constraints_json	sort_order	updated_at
```

#### 📋 Characters
```
character_id	user_id	canonical_name	core_profile_text	tags_json	created_at	updated_at
```

#### 📋 Stories
```
story_id	user_id	world_id	title	premise_text	story_mode	player_character_id	story_prompt	model_override	params_override_json	status	turn_count	created_at	updated_at
```

#### 📋 StoryCharacters
```
story_character_id	story_id	user_id	character_id	display_name_override	is_player	created_at
```

#### 📋 StoryCharacterOverrides
```
story_character_id	story_id	user_id	override_profile_text	override_voice_style	updated_at
```

#### 📋 StoryStateValues
```
story_id	user_id	story_character_id	schema_key	value_json	updated_at
```

#### 📋 StoryRelationships
```
story_id	user_id	from_story_character_id	to_story_character_id	score	tags_json	updated_at
```

#### 📋 StoryTurns
```
turn_id	story_id	user_id	turn_index	user_input_text	narrative_text	dialogue_json	scene_tags_json	created_at	error_flag	token_usage_json
```

#### 📋 ChangeLog
```
change_id	turn_id	story_id	user_id	entity_type	target_story_character_id	schema_key	from_story_character_id	to_story_character_id	op	before_value_json	after_value_json	reason_text
```

---

## 🔐 4. 設定共享權限

**重要**：必須設定為公開可讀取，API 才能正常運作。

1. 點擊右上角「共用」按鈕
2. 點擊「變更為知道連結的所有人」
3. 選擇「檢視者」權限
4. 點擊「完成」

或者更安全的方式（推薦）：
1. 在 Google Cloud Console 中建立 Service Account
2. 下載 Service Account Key
3. 將 Service Account 的 email 加入 Spreadsheet 的共用清單（編輯者權限）
4. 使用 Service Account 認證（需要修改程式碼）

---

## 🧪 5. 測試連接

設定完成後：

1. **訪問測試頁面**: http://localhost:3000/sheets-test
2. **點擊「1. 初始化 API」**
3. **點擊「2. 檢查所有表格」** - 確認所有 12 個 worksheets 都存在
4. **點擊「3. 測試讀取」** - 測試讀取 Users 表格（應該只有 header）
5. **點擊「4. 測試寫入」** - 測試寫入一筆測試資料

---

## ✅ 驗證清單

完成設定後，請確認：

- [ ] Spreadsheet 已建立並取得 ID
- [ ] 環境變數已設定（`.env.local`）
- [ ] 開發伺服器已重啟
- [ ] 已建立 12 個 worksheets
- [ ] 每個 worksheet 都有正確的 header
- [ ] Spreadsheet 共享權限已設定
- [ ] Google Sheets API 已在 Cloud Console 啟用
- [ ] 測試頁面可以成功初始化 API
- [ ] 測試頁面可以檢查到所有表格
- [ ] 測試頁面可以讀取資料
- [ ] 測試頁面可以寫入資料

---

## 🐛 常見問題排除

### 問題 1: API 初始化失敗

**錯誤訊息**: "Failed to load gapi"

**解決方案**:
- 確認網路連線正常
- 檢查瀏覽器是否封鎖第三方腳本
- 嘗試重新整理頁面

### 問題 2: 檢查表格失敗

**錯誤訊息**: "不存在或無權限"

**解決方案**:
- 確認 worksheet 名稱完全一致（區分大小寫）
- 確認 Spreadsheet 共享權限已設定
- 確認 Spreadsheet ID 正確

### 問題 3: 讀取失敗

**錯誤訊息**: "The caller does not have permission"

**解決方案**:
- 將 Spreadsheet 設定為「任何人都可以查看」
- 或使用 Service Account 認證

### 問題 4: 寫入失敗

**錯誤訊息**: "The caller does not have permission"

**解決方案**:
- API Key 只能讀取，無法寫入
- 需要使用 OAuth 2.0 或 Service Account 來寫入
- 目前的 API Key 設定只支援讀取操作

---

## 📚 進階設定（選擇性）

### 使用 Service Account（推薦用於生產環境）

1. 在 Google Cloud Console 建立 Service Account
2. 下載 JSON 金鑰檔案
3. 將 Service Account email 加入 Spreadsheet 共用清單
4. 修改程式碼使用 Service Account 認證

這種方式更安全，並且支援寫入操作。

---

## 🎯 下一步

設定完成並測試通過後，您就可以：

1. ✅ 測試認證系統（註冊/登入）
2. ✅ 建立世界觀和角色
3. ✅ 開始創作故事
4. ✅ 使用 AI 互動功能

如有任何問題，請查看測試頁面的錯誤訊息，或參考上方的常見問題排除。
