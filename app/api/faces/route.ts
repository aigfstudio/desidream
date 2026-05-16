import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: faces, error } = await supabaseAdmin
      .from('faces')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ faces })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
