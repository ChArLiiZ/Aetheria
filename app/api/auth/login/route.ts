/**
 * Login API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: '請填寫所有欄位' },
        { status: 400 }
      );
    }

    // Get user by email
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'Email 或密碼錯誤' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { error: '帳號已被停用' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email 或密碼錯誤' },
        { status: 401 }
      );
    }

    // Update last login timestamp
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', user.user_id);

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '登入失敗' },
      { status: 500 }
    );
  }
}
