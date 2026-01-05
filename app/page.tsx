export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Aetheria
        </h1>
        <p className="text-center text-lg mb-4">
          AI 互動小說應用程式
        </p>
        <p className="text-center text-sm text-gray-500 mb-8">
          Next.js + TypeScript + Google Sheets + OpenRouter AI
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <a
            href="/test"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            🧪 測試頁面
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            開始使用
          </a>
        </div>
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>📝 專案狀態：開發中</p>
          <p className="mt-2">
            <a
              href="https://github.com/ChArLiiZ/Aetheria"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              查看 GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
