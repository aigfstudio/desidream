import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { resumeWorker } = await import('@/lib/queue')
    const { data: session } = await supabaseAdmin
      .from('batch_sessions')
      .select('id')
      .eq('status', 'paused')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (session) {
      await supabaseAdmin
        .from('batch_sessions')
        .update({ status: 'running' })
        .eq('id', session.id)

      resumeWorker()
    }

    return NextResponse.json({ success: true, message: 'Batch resumed' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
