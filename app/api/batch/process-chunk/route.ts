import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getFaceImageAsBase64, markJobDone, markJobFailed, markJobProcessing } from '@/lib/supabase'
import { detectMimeType } from '@/lib/gemini'
import { uploadGeneratedImage } from '@/lib/cloudinary'

// Process one job at a time — called repeatedly from the dashboard
export async function POST() {
  try {
    // Find the active running session
    const { data: session } = await supabaseAdmin
      .from('batch_sessions')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (!session) {
      return NextResponse.json({ done: true, message: 'No active session' })
    }

    // Grab next queued job
    const { data: job } = await supabaseAdmin
      .from('generation_jobs')
      .select(`
        *,
        face:faces(id, label, storage_url, identity_description),
        prompt:prompts(id, style_name, pose_name, prompt_text)
      `)
      .eq('batch_session_id', session.id)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) {
      // No more queued — check if all done
      const { count: remaining } = await supabaseAdmin
        .from('generation_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('batch_session_id', session.id)
        .in('status', ['queued', 'processing'])

      if ((remaining ?? 0) === 0) {
        await supabaseAdmin
          .from('batch_sessions')
          .update({ status: 'completed' })
          .eq('id', session.id)

        return NextResponse.json({ done: true, message: 'All jobs completed!' })
      }

      return NextResponse.json({ done: false, message: 'Jobs still processing...' })
    }

    // Mark as processing
    await markJobProcessing(job.id)

    // 1. Get face image from Supabase Storage
    const faceBase64 = await getFaceImageAsBase64(job.face.storage_url)
    const mimeType = detectMimeType(faceBase64)

    // Stage 1: Face Identity Extraction (Cache in DB)
    let identityDesc = job.face.identity_description
    if (!identityDesc) {
      console.log(`[Stage 1] Extracting identity for face: ${job.face.label}`)
      // Import extractFaceIdentity dynamically or at top
      const { extractFaceIdentity } = await import('@/lib/gemini')
      identityDesc = await extractFaceIdentity(faceBase64, mimeType)

      // Save to Supabase so we never analyze this face again
      await supabaseAdmin
        .from('faces')
        .update({ identity_description: identityDesc })
        .eq('id', job.face.id)
    }

    // Stage 2: Image Generation via Imagen
    console.log(`[Stage 2] Generating Imagen for: ${job.prompt.prompt_text}`)
    const { generateImagenWithRetry } = await import('@/lib/imagen')
    const generatedBase64 = await generateImagenWithRetry(
      identityDesc,
      job.prompt.prompt_text,
      job.prompt.style_name
    )

    // 3. Upload to Cloudinary
    const { secure_url, public_id } = await uploadGeneratedImage(
      generatedBase64,
      job.face.label,
      job.prompt.style_name,
      job.prompt.pose_name,
      job.id
    )

    // 4. Mark done + update session count
    await markJobDone(job.id, secure_url, public_id)
    await supabaseAdmin
      .from('batch_sessions')
      .update({ completed_jobs: session.completed_jobs + 1 })
      .eq('id', session.id)

    return NextResponse.json({
      done: false,
      processed: 1,
      job_id: job.id,
      cloudinary_url: secure_url,
      face: job.face.label,
      style: job.prompt.style_name,
    })
  } catch (err: any) {
    console.error('[ProcessChunk]', err.message)
    return NextResponse.json({ done: false, error: err.message }, { status: 500 })
  }
}
