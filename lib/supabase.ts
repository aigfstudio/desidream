// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

// Client-side (uses anon key + RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side (bypasses RLS — use ONLY in API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

// ─── Face Helpers ─────────────────────────────────────────────────────────────

export async function uploadFaceToStorage(
  file: File,
  label: string
): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `faces/${label}-${Date.now()}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from('aigf')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabaseAdmin.storage.from('aigf').getPublicUrl(path)
  return data.publicUrl
}

export async function getFaceImageAsBase64(storageUrl: string): Promise<string> {
  // Extract path from the public URL
  const url = new URL(storageUrl)
  const pathParts = url.pathname.split('/storage/v1/object/public/aigf/')
  const filePath = pathParts[1]

  const { data, error } = await supabaseAdmin.storage
    .from('aigf')
    .download(filePath)

  if (error || !data) throw new Error(`Failed to download face: ${error?.message}`)

  const buffer = await data.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// ─── Job Helpers ──────────────────────────────────────────────────────────────

export async function getNextQueuedJob(batchSessionId: string) {
  const { data, error } = await supabaseAdmin
    .from('generation_jobs')
    .select(`
      *,
      face:faces(id, label, storage_url),
      prompt:prompts(id, style_name, pose_name, prompt_text)
    `)
    .eq('batch_session_id', batchSessionId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error) return null
  return data
}

export async function markJobProcessing(jobId: string) {
  await supabaseAdmin
    .from('generation_jobs')
    .update({ status: 'processing' })
    .eq('id', jobId)
}

export async function markJobDone(
  jobId: string,
  cloudinaryUrl: string,
  cloudinaryPublicId: string
) {
  await supabaseAdmin
    .from('generation_jobs')
    .update({
      status: 'done',
      cloudinary_url: cloudinaryUrl,
      cloudinary_public_id: cloudinaryPublicId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function markJobFailed(jobId: string, errorMessage: string) {
  const { data: job } = await supabaseAdmin
    .from('generation_jobs')
    .select('retry_count')
    .eq('id', jobId)
    .single()

  await supabaseAdmin
    .from('generation_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      retry_count: (job?.retry_count ?? 0) + 1,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function incrementBatchCompleted(sessionId: string) {
  await supabaseAdmin.rpc('increment_batch_completed', { session_id: sessionId })
}

export async function incrementBatchFailed(sessionId: string) {
  await supabaseAdmin.rpc('increment_batch_failed', { session_id: sessionId })
}
