'use client';

import { useState } from 'react';
import type { World, Character, WorldStateSchema } from '@/types';

export default function TestPage() {
  const [testResult, setTestResult] = useState<string>('');

  // 測試類型系統
  const testTypes = () => {
    const exampleWorld: World = {
      world_id: 'test-world-1',
      user_id: 'test-user-1',
      name: '賽博朋克 2077',
      description: '一個高科技低生活的未來世界',
      rules_text: '1. 人類可以改造身體\n2. 大企業控制一切\n3. 魔法不存在',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const exampleCharacter: Character = {
      character_id: 'test-char-1',
      user_id: 'test-user-1',
      canonical_name: '傑克',
      core_profile_text: '一個街頭傭兵，擅長槍械和駭客技術。性格豪爽但衝動。',
      tags_json: JSON.stringify(['傭兵', '駭客', '街頭']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const exampleSchema: WorldStateSchema = {
      schema_id: 'test-schema-1',
      world_id: 'test-world-1',
      user_id: 'test-user-1',
      schema_key: 'hp',
      display_name: '生命值',
      type: 'number',
      ai_description: '角色的生命值，0 代表死亡',
      default_value_json: JSON.stringify(100),
      number_constraints_json: JSON.stringify({
        min: 0,
        max: 100,
        decimals: 0,
        unit: 'HP',
      }),
      sort_order: 1,
      updated_at: new Date().toISOString(),
    };

    const result = {
      world: exampleWorld,
      character: exampleCharacter,
      schema: exampleSchema,
    };

    setTestResult(JSON.stringify(result, null, 2));
  };

  // 測試環境變數
  const testEnv = () => {
    const env = {
      spreadsheetId: process.env.NEXT_PUBLIC_SPREADSHEET_ID || '未設定',
      hasApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    };

    setTestResult(JSON.stringify(env, null, 2));
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Aetheria 測試頁面
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            專案資訊
          </h2>
          <div className="space-y-2 text-gray-700 dark:text-gray-300">
            <p>
              <strong>框架：</strong>Next.js 15 + React 19 + TypeScript
            </p>
            <p>
              <strong>樣式：</strong>Tailwind CSS
            </p>
            <p>
              <strong>資料庫：</strong>Google Sheets
            </p>
            <p>
              <strong>AI：</strong>OpenRouter API
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            測試功能
          </h2>
          <div className="flex gap-4">
            <button
              onClick={testTypes}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              測試類型系統
            </button>
            <button
              onClick={testEnv}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              檢查環境變數
            </button>
            <button
              onClick={() => setTestResult('')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              清除結果
            </button>
          </div>
        </div>

        {testResult && (
          <div className="bg-gray-900 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-white">測試結果</h2>
            <pre className="text-green-400 text-sm overflow-x-auto">
              {testResult}
            </pre>
          </div>
        )}

        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2 text-yellow-900 dark:text-yellow-200">
            ⚠️ 注意事項
          </h3>
          <ul className="list-disc list-inside space-y-1 text-yellow-800 dark:text-yellow-300">
            <li>目前為測試環境，尚未連接真實的 Google Sheets</li>
            <li>
              如需完整功能，請參考 <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">.env.example</code> 設定環境變數
            </li>
            <li>Google Sheets API 需要在 Google Cloud Console 中啟用</li>
          </ul>
        </div>

        <div className="mt-8 flex gap-4">
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            返回首頁
          </a>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            前往 Dashboard（開發中）
          </a>
        </div>
      </div>
    </main>
  );
}
