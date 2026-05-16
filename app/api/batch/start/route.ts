// app/api/batch/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Support optional imagesPerFace
    const body = await req.json().catch(() => ({}))
    const imagesPerFace: number = body.imagesPerFace || 20

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

    // 3. Build job combinations based on imagesPerFace
    const jobs = []
    for (const face of faces) {
      // Pick first N prompts for this face
      const facePrompts = prompts.slice(0, imagesPerFace)
      for (const prompt of facePrompts) {
        jobs.push({
          face_id: face.id,
          prompt_id: prompt.id,
          status: 'queued',
        })
      }
    }

    const totalJobs = jobs.length

    // 4. Create batch session with actual job count
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

    // 5. Insert jobs with session ID in chunks
    const jobsWithSession = jobs.map(j => ({ ...j, batch_session_id: session.id }))
    const CHUNK_SIZE = 500
    for (let i = 0; i < jobsWithSession.length; i += CHUNK_SIZE) {
      const chunk = jobsWithSession.slice(i, i + CHUNK_SIZE)
      const { error: insertErr } = await supabaseAdmin
        .from('generation_jobs')
        .insert(chunk)

      if (insertErr) {
        return NextResponse.json({ error: `Job creation failed: ${insertErr.message}` }, { status: 500 })
      }
    }

    // 6. Update face statuses
    await supabaseAdmin
      .from('faces')
      .update({ status: 'processing' })
      .in('id', faces.map(f => f.id))

    return NextResponse.json({
      success: true,
      session_id: session.id,
      total_jobs: totalJobs,
      message: `Started generating ${totalJobs} images (${faces.length} faces × ${imagesPerFace} outfits)`,
    })
  } catch (err: any) {
    console.error('[Batch Start]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
