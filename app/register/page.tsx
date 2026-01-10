'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword, validateEmail } from '@/lib/auth/password';
import { Button, Input, Alert, Card, CardContent } from '@/components/ui';
import { Container, Stack } from '@/components/layout';
import { FormField, FormGroup } from '@/components/forms';
import { ArrowLeft, UserPlus } from '@/components/icons';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setLoading(true);

    const validationErrors: string[] = [];

    // Validate email
    if (!validateEmail(email)) {
      validationErrors.push('請輸入有效的電子郵件地址');
    }

    // Validate display name
    if (displayName.trim().length < 2) {
      validationErrors.push('顯示名稱至少需要 2 個字元');
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      validationErrors.push(...passwordValidation.errors);
    }

    // Confirm password match
    if (password !== confirmPassword) {
      validationErrors.push('密碼確認不符');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      await register(email, displayName, password);
      router.push('/dashboard');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : '註冊失敗']);
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
            <h2 className="text-xl text-gray-600 dark:text-gray-400">建立新帳號</h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <Card>
              <CardContent>
                <FormGroup spacing="md">
                  {errors.length > 0 && (
                    <Alert variant="error" title="驗證失敗">
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  <FormField label="電子郵件" required>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      disabled={loading}
                    />
                  </FormField>

                  <FormField label="顯示名稱" required>
                    <Input
                      id="displayName"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="你的名字"
                      disabled={loading}
                    />
                  </FormField>

                  <FormField
                    label="密碼"
                    required
                    helperText="至少 8 個字元，包含大小寫字母和數字"
                  >
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  </FormField>

                  <FormField label="確認密碼" required>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  </FormField>

                  <Button
                    type="submit"
                    disabled={loading}
                    isLoading={loading}
                    fullWidth
                    className="mt-2"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    註冊
                  </Button>
                </FormGroup>
              </CardContent>
            </Card>
          </form>

          {/* Links */}
          <Stack spacing="sm" className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              已經有帳號了？{' '}
              <Link
                href="/login"
                className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                立即登入
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

