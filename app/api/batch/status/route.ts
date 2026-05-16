// app/api/batch/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { estimateCost } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  try {
    // Get latest batch session
    const { data: session } = await supabaseAdmin
      .from('batch_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (!session) {
      const { count: facesCount } = await supabaseAdmin.from('faces').select('*', { count: 'exact', head: true })
      const { count: promptsCount } = await supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true })
      
      return NextResponse.json({
        session: null,
        stats: { facesCount: facesCount || 0, promptsCount: promptsCount || 0, total: 0, queued: 0, processing: 0, done: 0, failed: 0, percentage: 0, eta_minutes: null, cost_estimate_usd: 0 },
      })
    }

    // Get detailed counts per status
    const { data: counts } = await supabaseAdmin
      .from('generation_jobs')
      .select('status')
      .eq('batch_session_id', session.id)

    const grouped = { queued: 0, processing: 0, done: 0, failed: 0 }
    counts?.forEach((c) => { grouped[c.status as keyof typeof grouped]++ })

    const total = session.total_jobs
    const done = grouped.done
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0

    // ETA calculation: based on avg completed per minute
    const elapsedMs = Date.now() - new Date(session.started_at).getTime()
    const elapsedMin = elapsedMs / 60_000
    const ratePerMin = elapsedMin > 0 ? done / elapsedMin : 0
    const remaining = total - done
    const eta_minutes = ratePerMin > 0 ? Math.ceil(remaining / ratePerMin) : null

    const cost_estimate_usd = estimateCost(total - done)

    const { count: facesCount } = await supabaseAdmin.from('faces').select('*', { count: 'exact', head: true })
    const { count: promptsCount } = await supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true })

    return NextResponse.json({
      session,
      stats: {
        facesCount: facesCount || 0,
        promptsCount: promptsCount || 0,
        total,
        ...grouped,
        percentage,
        eta_minutes,
        cost_estimate_usd: parseFloat(cost_estimate_usd.toFixed(2)),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
