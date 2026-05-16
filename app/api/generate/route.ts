import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getFaceImageAsBase64, markJobProcessing, markJobDone, markJobFailed } from '@/lib/supabase'
import { detectMimeType } from '@/lib/gemini'
import { uploadGeneratedImage } from '@/lib/cloudinary'

const JOB_TIMEOUT = 90_000 // 90 seconds per job

export async function POST(req: NextRequest) {
  const { job_id } = await req.json()

  if (!job_id) {
    return NextResponse.json({ error: 'job_id required' }, { status: 400 })
  }

  try {
    // Fetch job with face + prompt details
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('generation_jobs')
      .select(`
        *,
        face:faces(id, label, storage_url),
        prompt:prompts(id, style_name, pose_name, prompt_text)
      `)
      .eq('id', job_id)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    await markJobProcessing(job_id)

    // 1. Download face image from Supabase as base64
    const faceBase64 = await getFaceImageAsBase64(job.face.storage_url)
    const mimeType = detectMimeType(faceBase64)

    // Stage 1: Identity
    let identityDesc = job.face.identity_description
    if (!identityDesc) {
      const { extractFaceIdentity } = await import('@/lib/gemini')
      identityDesc = await extractFaceIdentity(faceBase64, mimeType)
      await supabaseAdmin.from('faces').update({ identity_description: identityDesc }).eq('id', job.face.id)
    }

    // Stage 2: Imagen
    const { generateImagenWithRetry } = await import('@/lib/imagen')
    const generatedBase64 = await generateImagenWithRetry(
      identityDesc,
      job.prompt.prompt_text,
      job.prompt.style_name
    )

    // 3. Upload to Cloudinary → folder: aigf/{face_label}/{style_name}
    const { secure_url, public_id } = await uploadGeneratedImage(
      generatedBase64,
      job.face.label,
      job.prompt.style_name,
      job.prompt.pose_name,
      job_id
    )

    // 4. Mark job done in DB with Cloudinary URL
    await markJobDone(job_id, secure_url, public_id)

    // 5. Increment batch session completed count
    const { data: session } = await supabaseAdmin
      .from('batch_sessions')
      .select('id, completed_jobs')
      .eq('id', job.batch_session_id)
      .single()

    if (session) {
      await supabaseAdmin
        .from('batch_sessions')
        .update({ completed_jobs: session.completed_jobs + 1 })
        .eq('id', session.id)
    }

    return NextResponse.json({
      success: true,
      job_id,
      cloudinary_url: secure_url,
      public_id,
    })
  } catch (err: any) {
    console.error('[Generate]', err.message)
    await markJobFailed(job_id, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
