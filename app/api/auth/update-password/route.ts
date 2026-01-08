/**
 * Update Password API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { userId, oldPassword, newPassword } = await request.json();

    // Validate input
    if (!userId || !oldPassword || !newPassword) {
      return NextResponse.json(
        { error: '請填寫所有欄位' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('user_id', userId)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: '用戶不存在' },
        { status: 404 }
      );
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: '舊密碼錯誤' },
        { status: 401 }
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '更新密碼失敗' },
      { status: 500 }
    );
  }
}
