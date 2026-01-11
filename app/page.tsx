'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LogIn, UserPlus, LayoutDashboard, Github, Loader2 } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';

export default function Home() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  // 載入中時顯示載入畫面
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">載入中...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background relative overflow-hidden">
      {/* Background decorations could go here */}

      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="w-full max-w-4xl space-y-8 z-10">
        {/* Auth Status Bar */}
        {isAuthenticated && (
          <Alert className="flex items-center justify-between border-primary/20 bg-primary/5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                {user?.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {user?.display_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={logout}>
              登出
            </Button>
          </Alert>
        )}

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Aetheria
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            AI 互動式小說創作平台
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/80">
            <span>Next.js 15</span>
            <span>•</span>
            <span>Supabase</span>
            <span>•</span>
            <span>OpenRouter</span>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
          {isAuthenticated ? (
            <Link href="/dashboard" className="md:col-span-2 group">
              <Card className="h-full transition-all group-hover:border-primary group-hover:shadow-lg">
                <CardContent className="flex flex-col items-center text-center p-8 space-y-4">
                  <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <LayoutDashboard className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-xl">進入 Dashboard</h3>
                    <p className="text-muted-foreground">
                      管理您的世界觀、角色與故事
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <>
              <Link href="/login" className="group">
                <Card className="h-full transition-all group-hover:border-primary group-hover:shadow-lg">
                  <CardContent className="flex flex-col items-center text-center p-8 space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <LogIn className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-xl">登入</h3>
                      <p className="text-muted-foreground">
                        使用現有帳號繼續旅程
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/register" className="group">
                <Card className="h-full transition-all group-hover:border-primary group-hover:shadow-lg">
                  <CardContent className="flex flex-col items-center text-center p-8 space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <UserPlus className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-xl">註冊</h3>
                      <p className="text-muted-foreground">
                        建立新帳號開始創作
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>專案狀態：開發中</p>
          <a
            href="https://github.com/ChArLiiZ/Aetheria"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            查看 GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
