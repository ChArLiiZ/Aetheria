/**
 * Register API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    // Validate input
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: '請填寫所有欄位' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('user_id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: '此 Email 已被註冊' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        display_name: displayName,
        password_hash: passwordHash,
        status: 'active',
      })
      .select()
      .single();

    if (insertError || !newUser) {
      return NextResponse.json(
        { error: '註冊失敗：' + insertError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: newUser });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '註冊失敗' },
      { status: 500 }
    );
  }
}
