'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

export default function DebugPage() {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [testLoading, setTestLoading] = useState(false);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    useEffect(() => {
        addLog(`頁面載入 - authLoading: ${authLoading}, isAuthenticated: ${isAuthenticated}`);
    }, []);

    useEffect(() => {
        addLog(`Auth 狀態變更 - loading: ${authLoading}, user: ${user?.display_name || 'null'}`);
    }, [authLoading, user]);

    const testSupabaseConnection = async () => {
        addLog('測試 Supabase 連線...');
        setTestLoading(true);

        try {
            const startTime = Date.now();
            const { data: { session }, error } = await supabase.auth.getSession();
            const elapsed = Date.now() - startTime;

            if (error) {
                addLog(`❌ getSession 錯誤 (${elapsed}ms): ${error.message}`);
            } else {
                addLog(`✅ getSession 成功 (${elapsed}ms): ${session ? '有 session' : '無 session'}`);
            }
        } catch (err: any) {
            addLog(`❌ getSession 例外: ${err.message}`);
        }

        setTestLoading(false);
    };

    const testDatabaseQuery = async () => {
        if (!user) {
            addLog('❌ 無法測試: user 為 null');
            return;
        }

        addLog('測試資料庫查詢...');
        setTestLoading(true);

        try {
            const startTime = Date.now();
            const { data, error } = await supabase
                .from('users')
                .select('user_id, display_name')
                .eq('user_id', user.user_id)
                .single();
            const elapsed = Date.now() - startTime;

            if (error) {
                addLog(`❌ 查詢錯誤 (${elapsed}ms): ${error.message}`);
            } else {
                addLog(`✅ 查詢成功 (${elapsed}ms): ${data?.display_name}`);
            }
        } catch (err: any) {
            addLog(`❌ 查詢例外: ${err.message}`);
        }

        setTestLoading(false);
    };

    const testButtonClick = () => {
        addLog(`🔘 按鈕點擊測試 - user: ${user ? user.display_name : 'NULL'}`);

        if (!user) {
            addLog('⚠️ user 為 null，這就是為什麼有些操作沒反應！');
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    return (
        <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    🔧 診斷頁面
                </h1>

                {/* 狀態摘要 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white mb-2">當前狀態</h2>
                    <div className="space-y-1 text-sm">
                        <p className={authLoading ? 'text-yellow-600' : 'text-green-600'}>
                            authLoading: {authLoading ? '載入中...' : '完成'}
                        </p>
                        <p className={isAuthenticated ? 'text-green-600' : 'text-red-600'}>
                            isAuthenticated: {isAuthenticated ? '是' : '否'}
                        </p>
                        <p className={user ? 'text-green-600' : 'text-red-600'}>
                            user: {user ? `${user.display_name} (${user.user_id})` : 'NULL ⚠️'}
                        </p>
                    </div>
                </div>

                {/* 測試按鈕 */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={testButtonClick}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        測試按鈕點擊
                    </button>
                    <button
                        onClick={testSupabaseConnection}
                        disabled={testLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                    >
                        測試 Supabase 連線
                    </button>
                    <button
                        onClick={testDatabaseQuery}
                        disabled={testLoading || !user}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                    >
                        測試資料庫查詢
                    </button>
                    <button
                        onClick={clearLogs}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        清除日誌
                    </button>
                </div>

                {/* 日誌 */}
                <div className="bg-black text-green-400 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    {logs.length === 0 ? (
                        <p className="text-gray-500">（等待日誌...）</p>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="py-0.5">{log}</div>
                        ))
                    )}
                </div>

                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>💡 如果 user 顯示為 NULL，但你已經登入，這就是問題所在。</p>
                    <p>請在 Console (F12) 查看是否有錯誤訊息。</p>
                </div>
            </div>
        </div>
    );
}
