/**
 * Aetheria Google Apps Script API
 *
 * 提供 RESTful API 讓前端應用程式存取 Google Sheets
 *
 * 部署方式：
 * 1. 在 Google Sheets 中開啟 Apps Script 編輯器
 * 2. 貼上此程式碼
 * 3. 部署為 Web App
 * 4. 複製 Web App URL 到前端 .env.local
 */

// 主要處理函數
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter;
    const action = params.action;

    let result;

    switch (action) {
      case 'read':
        result = readSheet(params.sheet, params.range);
        break;

      case 'append':
        result = appendToSheet(params.sheet, JSON.parse(params.values));
        break;

      case 'update':
        result = updateSheet(params.sheet, params.range, JSON.parse(params.values));
        break;

      case 'delete':
        result = deleteRows(params.sheet, parseInt(params.startIndex), parseInt(params.endIndex));
        break;

      case 'checkSheets':
        result = checkAllSheets();
        break;

      default:
        throw new Error('未知的操作: ' + action);
    }

    return createResponse({ success: true, data: result });

  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  }
}

// 讀取 Sheet 資料
function readSheet(sheetName, range) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }

  let values;
  if (range) {
    values = sheet.getRange(range).getValues();
  } else {
    values = sheet.getDataRange().getValues();
  }

  return values;
}

// 附加資料到 Sheet
function appendToSheet(sheetName, values) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length)
    .setValues(values);

  return { rowsAdded: values.length };
}

// 更新 Sheet 資料
function updateSheet(sheetName, range, values) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }

  sheet.getRange(range).setValues(values);

  return { updated: true };
}

// 刪除列
function deleteRows(sheetName, startIndex, endIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('找不到工作表: ' + sheetName);
  }

  sheet.deleteRows(startIndex, endIndex - startIndex);

  return { deleted: true };
}

// 檢查所有必要的 Sheets 是否存在
function checkAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    'Users',
    'ProviderSettings',
    'Worlds',
    'WorldStateSchema',
    'Characters',
    'Stories',
    'StoryCharacters',
    'StoryCharacterOverrides',
    'StoryStateValues',
    'StoryRelationships',
    'StoryTurns',
    'ChangeLog'
  ];

  const result = {};

  requiredSheets.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    result[sheetName] = sheet !== null;
  });

  return result;
}

// 建立回應（Apps Script Web App 預設支援 CORS）
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
