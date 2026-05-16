// app/api/batch/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      faceIds = [],
      promptMode = 'random', // 'library', 'custom', 'random'
      promptIds = [],
      customPrompt = '',
      imagesPerFace = 1,
      model = 'imagen'
    } = body

    if (faceIds.length === 0) {
      return NextResponse.json({ error: 'No faces selected.' }, { status: 400 })
    }

    // 1. Fetch valid faces
    const { data: faces, error: facesErr } = await supabaseAdmin
      .from('faces')
      .select('id, label')
      .in('id', faceIds)

    if (facesErr || !faces?.length) {
      return NextResponse.json({ error: 'Selected faces not found.' }, { status: 400 })
    }

    // 2. Prepare Prompts based on Mode
    let finalPrompts: any[] = []

    if (promptMode === 'library') {
      if (promptIds.length === 0) return NextResponse.json({ error: 'No prompts selected.' }, { status: 400 })
      const { data: dbPrompts } = await supabaseAdmin
        .from('prompts')
        .select('id')
        .in('id', promptIds)
      finalPrompts = dbPrompts || []

    } else if (promptMode === 'custom') {
      if (!customPrompt.trim()) return NextResponse.json({ error: 'Custom prompt is empty.' }, { status: 400 })
      // Insert custom prompt into library as a temporary or saved prompt
      const { data: newPrompt } = await supabaseAdmin
        .from('prompts')
        .insert({
          style_name: 'Custom',
          pose_name: 'Auto',
          prompt_text: customPrompt.trim()
        })
        .select('id')
        .single()
      
      if (!newPrompt) return NextResponse.json({ error: 'Failed to save custom prompt.' }, { status: 500 })
      
      // We generate `imagesPerFace` variations of this one prompt
      for (let i = 0; i < imagesPerFace; i++) {
        finalPrompts.push(newPrompt)
      }

    } else if (promptMode === 'random') {
      const { data: dbPrompts } = await supabaseAdmin
        .from('prompts')
        .select('id')
        
      if (!dbPrompts?.length) return NextResponse.json({ error: 'No prompts in library.' }, { status: 400 })
      
      // Randomly pick `imagesPerFace` prompts
      const shuffled = [...dbPrompts].sort(() => 0.5 - Math.random())
      finalPrompts = shuffled.slice(0, imagesPerFace)
    }

    if (finalPrompts.length === 0) {
      return NextResponse.json({ error: 'No prompts to process.' }, { status: 400 })
    }

    // 3. Build job combinations
    const jobs = []
    for (const face of faces) {
      for (const p of finalPrompts) {
        jobs.push({
          face_id: face.id,
          prompt_id: p.id,
          status: 'queued',
        })
      }
    }

    const totalJobs = jobs.length

    // 4. Create batch session
    // NOTE: 'model' column must exist in batch_sessions table
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('batch_sessions')
      .insert({
        total_jobs: totalJobs,
        completed_jobs: 0,
        failed_jobs: 0,
        status: 'running',
        model: model
      })
      .select()
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: `Failed to create batch session. Did you run the SQL migration to add 'model' column? Error: ${sessionErr?.message}` }, { status: 500 })
    }

    // 5. Insert jobs
    const jobsWithSession = jobs.map(j => ({ ...j, batch_session_id: session.id }))
    const CHUNK_SIZE = 500
    for (let i = 0; i < jobsWithSession.length; i += CHUNK_SIZE) {
      const chunk = jobsWithSession.slice(i, i + CHUNK_SIZE)
      const { error: insertErr } = await supabaseAdmin.from('generation_jobs').insert(chunk)
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
      message: `Started batch: ${totalJobs} images across ${faces.length} faces.`,
    })
  } catch (err: any) {
    console.error('[Batch Start]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
