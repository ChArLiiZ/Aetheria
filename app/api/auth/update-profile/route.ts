/**
 * Update Profile API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, displayName } = await request.json();

    // Validate input
    if (!userId || !displayName) {
      return NextResponse.json(
        { error: '請填寫所有欄位' },
        { status: 400 }
      );
    }

    // Update display name
    const { error } = await supabaseAdmin
      .from('users')
      .update({ display_name: displayName })
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
      { error: error.message || '更新失敗' },
      { status: 500 }
    );
  }
}
