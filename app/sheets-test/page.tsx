'use client';

import { useState } from 'react';
import { initSheetsClient, readSheet, appendToSheet, SHEETS } from '@/lib/db/sheets-client';

export default function SheetsTestPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize Google Sheets API
  const handleInit = async () => {
    setLoading(true);
    setStatus('正在初始化 Google Sheets API...');

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
      await initSheetsClient(apiKey);
      setInitialized(true);
      setStatus('✅ Google Sheets API 初始化成功！');
    } catch (error) {
      setStatus(`❌ 初始化失敗: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Test read from Users sheet
  const handleTestRead = async () => {
    if (!initialized) {
      setStatus('⚠️ 請先初始化 API');
      return;
    }

    setLoading(true);
    setStatus('正在讀取 Users 表格...');

    try {
      const data = await readSheet(SHEETS.USERS);
      setStatus(`✅ 讀取成功！找到 ${data.length} 列資料\n\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setStatus(`❌ 讀取失敗: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Test write to Users sheet
  const handleTestWrite = async () => {
    if (!initialized) {
      setStatus('⚠️ 請先初始化 API');
      return;
    }

    setLoading(true);
    setStatus('正在寫入測試資料到 Users 表格...');

    try {
      const testData = [
        [
          'test-user-id-' + Date.now(),
          'test@example.com',
          'Test User',
          'hashed_password',
          new Date().toISOString(),
          new Date().toISOString(),
          'active',
          '',
        ],
      ];

      await appendToSheet(SHEETS.USERS, testData);
      setStatus('✅ 寫入成功！請檢查 Google Sheets');
    } catch (error: any) {
      console.error('Write test error:', error);
      let errorMessage = '未知錯誤';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error?.result?.error?.message) {
        errorMessage = error.result.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error, null, 2);
      }

      setStatus(`❌ 寫入失敗: ${errorMessage}\n\n💡 提示：使用 API Key 只能讀取資料，無法寫入。\n如需寫入功能，請使用 OAuth 2.0 或 Service Account。`);
    } finally {
      setLoading(false);
    }
  };

  // Check all required sheets
  const handleCheckSheets = async () => {
    if (!initialized) {
      setStatus('⚠️ 請先初始化 API');
      return;
    }

    setLoading(true);
    setStatus('正在檢查所有必要的表格...');

    const requiredSheets = [
      SHEETS.USERS,
      SHEETS.PROVIDER_SETTINGS,
      SHEETS.WORLDS,
      SHEETS.WORLD_STATE_SCHEMA,
      SHEETS.CHARACTERS,
      SHEETS.STORIES,
      SHEETS.STORY_CHARACTERS,
      SHEETS.STORY_CHARACTER_OVERRIDES,
      SHEETS.STORY_STATE_VALUES,
      SHEETS.STORY_RELATIONSHIPS,
      SHEETS.STORY_TURNS,
      SHEETS.CHANGE_LOG,
    ];

    const results: string[] = [];

    for (const sheet of requiredSheets) {
      try {
        await readSheet(sheet, 'A1:A1');
        results.push(`✅ ${sheet}`);
      } catch (error) {
        results.push(`❌ ${sheet} - 不存在或無權限`);
      }
    }

    setStatus(`檢查完成：\n\n${results.join('\n')}`);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Google Sheets 連接測試
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            測試與 Google Sheets 的連接和讀寫功能
          </p>
        </div>

        {/* Environment Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            環境資訊
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Spreadsheet ID:</strong>{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {process.env.NEXT_PUBLIC_SPREADSHEET_ID}
              </code>
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>API Key 狀態:</strong>{' '}
              {process.env.NEXT_PUBLIC_GOOGLE_API_KEY ? '✅ 已設定' : '❌ 未設定'}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>API 初始化:</strong> {initialized ? '✅ 已初始化' : '⏳ 未初始化'}
            </p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            測試操作
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleInit}
              disabled={loading || initialized}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {initialized ? '✅ 已初始化' : '1. 初始化 API'}
            </button>

            <button
              onClick={handleCheckSheets}
              disabled={loading || !initialized}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
            >
              2. 檢查所有表格
            </button>

            <button
              onClick={handleTestRead}
              disabled={loading || !initialized}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
            >
              3. 測試讀取 (Users)
            </button>

            <button
              onClick={handleTestWrite}
              disabled={loading || !initialized}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition"
            >
              4. 測試寫入 (Users)
            </button>
          </div>
        </div>

        {/* Status Display */}
        {status && (
          <div className="bg-gray-900 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-white mb-4">測試結果</h2>
            <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap">
              {status}
            </pre>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
            📋 使用步驟
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300 text-sm">
            <li>確保 Google Spreadsheet 已建立並設定為「任何人都可以查看」</li>
            <li>點擊「初始化 API」載入 Google Sheets API</li>
            <li>點擊「檢查所有表格」確認所有必要的 worksheets 存在</li>
            <li>點擊「測試讀取」嘗試讀取 Users 表格</li>
            <li>點擊「測試寫入」嘗試寫入測試資料</li>
          </ol>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← 返回首頁
          </a>
        </div>
      </div>
    </main>
  );
}
