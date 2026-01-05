export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Aetheria
        </h1>
        <p className="text-center text-lg">
          AI 互動小說應用程式
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            開始使用
          </a>
        </div>
      </div>
    </main>
  );
}
