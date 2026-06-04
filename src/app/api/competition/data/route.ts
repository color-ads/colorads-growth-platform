import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'h98';
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await db
      .from('properties')
      .select('ai_competition_data')
      .eq('slug', slug)
      .single();
    if (error) return NextResponse.json({ ok: false, data: null });
    return NextResponse.json({ ok: true, data: (data && (data as any).ai_competition_data) || null });
  } catch {
    return NextResponse.json({ ok: false, data: null });
  }
}
