'use client';

import { useState } from 'react';
import {
  readSheet,
  appendToSheet,
  checkAllSheets,
  SHEETS,
} from '@/lib/db/sheets-client-appsscript';

export default function SheetsTestPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const sheetsApiUrl = process.env.NEXT_PUBLIC_SHEETS_API_URL;
  const isConfigured = !!sheetsApiUrl;

  // Test check all sheets
  const handleCheckSheets = async () => {
    setLoading(true);
    setStatus('正在檢查所有必要的表格...');

    try {
      const result = await checkAllSheets();
      const results: string[] = [];

      Object.entries(result).forEach(([sheetName, exists]) => {
        results.push(exists ? `✅ ${sheetName}` : `❌ ${sheetName} - 不存在`);
      });

      setStatus(`檢查完成：\n\n${results.join('\n')}`);
    } catch (error: any) {
      setStatus(`❌ 檢查失敗: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Test read from Users sheet
  const handleTestRead = async () => {
    setLoading(true);
    setStatus('正在讀取 Users 表格...');

    try {
      const data = await readSheet(SHEETS.USERS);
      setStatus(`✅ 讀取成功！找到 ${data.length} 列資料\n\n${JSON.stringify(data, null, 2)}`);
    } catch (error: any) {
      setStatus(`❌ 讀取失敗: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Test write to Users sheet
  const handleTestWrite = async () => {
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
      setStatus('✅ 寫入成功！請檢查 Google Sheets Users 表格');
    } catch (error: any) {
      setStatus(`❌ 寫入失敗: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Google Sheets (Apps Script) 連接測試
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            測試與 Google Sheets 的連接和讀寫功能
          </p>
        </div>

        {/* Environment Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            設定狀態
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Apps Script URL:</strong>{' '}
              {isConfigured ? (
                <span className="text-green-600 dark:text-green-400">✅ 已設定</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  ❌ 未設定 - 請參考 APPS_SCRIPT_SETUP.md
                </span>
              )}
            </p>
            {isConfigured && (
              <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                {sheetsApiUrl}
              </p>
            )}
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            測試操作
          </h2>

          {!isConfigured ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                ⚠️ 請先設定 Apps Script URL。參考 APPS_SCRIPT_SETUP.md
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleCheckSheets}
                disabled={loading}
                className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
              >
                1. 檢查所有表格
              </button>

              <button
                onClick={handleTestRead}
                disabled={loading}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                2. 測試讀取 (Users)
              </button>

              <button
                onClick={handleTestWrite}
                disabled={loading}
                className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition"
              >
                3. 測試寫入 (Users)
              </button>
            </div>
          )}
        </div>

        {/* Status Display */}
        {status && (
          <div className="bg-gray-900 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">測試結果</h2>
            <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap">
              {status}
            </pre>
          </div>
        )}

        {/* Success Message */}
        {isConfigured && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-3">
              ✅ Apps Script 已設定
            </h3>
            <p className="text-green-800 dark:text-green-300 mb-4">
              您現在可以測試註冊功能！資料會真正寫入 Google Sheets。
            </p>
            <a
              href="/register"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              前往註冊頁面測試
            </a>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
            📋 使用步驟
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300 text-sm">
            <li>確保已在 Spreadsheet 中建立所有必要的 worksheets</li>
            <li>點擊「檢查所有表格」確認 worksheets 存在</li>
            <li>點擊「測試讀取」測試讀取 Users 表格</li>
            <li>點擊「測試寫入」測試寫入功能</li>
            <li>或直接前往註冊頁面測試完整流程</li>
          </ol>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center space-x-4">
          <a
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← 返回首頁
          </a>
          <a
            href="/register"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            前往註冊頁面 →
          </a>
        </div>
      </div>
    </main>
  );
}
