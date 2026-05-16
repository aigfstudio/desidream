// app/api/batch/pause/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { pauseWorker } from '@/lib/queue'

export async function POST(req: NextRequest) {
  try {
    pauseWorker()

    const { data: session } = await supabaseAdmin
      .from('batch_sessions')
      .select('id')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (session) {
      await supabaseAdmin
        .from('batch_sessions')
        .update({ status: 'paused' })
        .eq('id', session.id)
    }

    return NextResponse.json({ success: true, message: 'Batch paused' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── app/api/batch/resume/route.ts ────────────────────────────────────────────
// (Create this as a separate file in production)
// For brevity, exported as named function here

export async function resumeBatch() {
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
}
