'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Alert, Card, CardContent } from '@/components/ui';
import { Container, Stack } from '@/components/layout';
import { ArrowLeft, LogIn } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Container size="sm">
        <Stack spacing="lg" className="w-full">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Aetheria
            </h1>
            <h2 className="text-xl text-gray-600 dark:text-gray-400">登入帳號</h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <Card>
              <CardContent>
                <Stack spacing="md">
                  {error && <Alert variant="error" title="登入失敗">{error}</Alert>}

                  <Input
                    id="email"
                    type="email"
                    label="電子郵件"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={loading}
                  />

                  <Input
                    id="password"
                    type="password"
                    label="密碼"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                  />

                  <Button
                    type="submit"
                    disabled={loading}
                    isLoading={loading}
                    fullWidth
                    className="mt-2"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    登入
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </form>

          {/* Links */}
          <Stack spacing="sm" className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              還沒有帳號？{' '}
              <Link
                href="/register"
                className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                立即註冊
              </Link>
            </p>
            <Link
              href="/"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回首頁
            </Link>
          </Stack>

          {/* Info */}
          <Alert variant="info" className="text-xs">
            資料儲存在 Supabase 中。
          </Alert>
        </Stack>
      </Container>
    </main>
  );
}

