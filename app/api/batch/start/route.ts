// app/api/batch/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { startWorker } from '@/lib/queue'

export async function POST(req: NextRequest) {
  try {
    // 1. Fetch all faces
    const { data: faces, error: facesErr } = await supabaseAdmin
      .from('faces')
      .select('id, label')
      .order('created_at')

    if (facesErr || !faces?.length) {
      return NextResponse.json({ error: 'No faces found. Upload faces first.' }, { status: 400 })
    }

    // 2. Fetch all prompts
    const { data: prompts, error: promptsErr } = await supabaseAdmin
      .from('prompts')
      .select('id')
      .order('created_at')

    if (promptsErr || !prompts?.length) {
      return NextResponse.json({ error: 'No prompts found. Add prompts first.' }, { status: 400 })
    }

    // 3. Create batch session
    const totalJobs = faces.length * prompts.length
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('batch_sessions')
      .insert({
        total_jobs: totalJobs,
        completed_jobs: 0,
        failed_jobs: 0,
        status: 'running',
      })
      .select()
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Failed to create batch session' }, { status: 500 })
    }

    // 4. Create all generation_jobs in bulk
    // Batch insert in chunks of 500 to avoid payload limits
    const jobs = []
    for (const face of faces) {
      for (const prompt of prompts) {
        jobs.push({
          face_id: face.id,
          prompt_id: prompt.id,
          batch_session_id: session.id,
          status: 'queued',
        })
      }
    }

    const CHUNK_SIZE = 500
    for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + CHUNK_SIZE)
      const { error: insertErr } = await supabaseAdmin
        .from('generation_jobs')
        .insert(chunk)

      if (insertErr) {
        console.error(`[Batch] Failed to insert chunk ${i}:`, insertErr)
        return NextResponse.json(
          { error: `Job creation failed at chunk ${i}: ${insertErr.message}` },
          { status: 500 }
        )
      }
    }

    // 5. Update face statuses to 'processing'
    await supabaseAdmin
      .from('faces')
      .update({ status: 'processing' })
      .in('id', faces.map((f) => f.id))

    // 6. Start the worker
    startWorker(session.id)

    return NextResponse.json({
      success: true,
      session_id: session.id,
      total_jobs: totalJobs,
      faces: faces.length,
      prompts: prompts.length,
      message: `Started generating ${totalJobs} images (${faces.length} faces × ${prompts.length} prompts)`,
    })
  } catch (err: any) {
    console.error('[Batch Start]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
