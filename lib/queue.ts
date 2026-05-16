// lib/queue.ts
// Concurrency-limited async queue (no Redis required)
// Processes jobs 5 at a time to respect Gemini rate limits

import { supabaseAdmin, getFaceImageAsBase64, markJobProcessing, markJobDone, markJobFailed } from './supabase'
import { detectMimeType } from './gemini'
import { uploadGeneratedImage } from './cloudinary'
import type { GenerationJob } from '@/types'

const CONCURRENCY = 5         // parallel Gemini requests
const POLL_INTERVAL = 2000    // ms between queue polls
const JOB_TIMEOUT = 60_000    // 60s per job max

let isRunning = false
let isPaused = false
let activeSessionId: string | null = null
let activeWorkers = 0

// ─── Public Controls ──────────────────────────────────────────────────────────

export function startWorker(sessionId: string) {
  activeSessionId = sessionId
  isRunning = true
  isPaused = false
  console.log(`[Queue] Worker started. Session: ${sessionId}`)
  runLoop()
}

export function pauseWorker() {
  isPaused = true
  console.log('[Queue] Worker paused.')
}

export function resumeWorker() {
  isPaused = false
  console.log('[Queue] Worker resumed.')
  runLoop()
}

export function stopWorker() {
  isRunning = false
  isPaused = false
  activeSessionId = null
  console.log('[Queue] Worker stopped.')
}

export function getWorkerState() {
  return { isRunning, isPaused, activeSessionId, activeWorkers }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function runLoop() {
  if (!isRunning || !activeSessionId) return

  while (isRunning && !isPaused) {
    // Fill up to CONCURRENCY parallel slots
    while (activeWorkers < CONCURRENCY && isRunning && !isPaused) {
      const job = await dequeueJob(activeSessionId)
      if (!job) break // No more queued jobs

      activeWorkers++
      processJob(job, activeSessionId).finally(() => {
        activeWorkers--
      })
    }

    // Check if all done
    const remaining = await countQueuedJobs(activeSessionId)
    if (remaining === 0 && activeWorkers === 0) {
      await markBatchComplete(activeSessionId)
      stopWorker()
      break
    }

    await sleep(POLL_INTERVAL)
  }
}

// ─── Job Processing ───────────────────────────────────────────────────────────

async function processJob(job: GenerationJob & { face: any; prompt: any }, sessionId: string) {
  const jobId = job.id
  console.log(`[Queue] Processing job ${jobId} | Face: ${job.face.label} | Style: ${job.prompt.style_name}`)

  try {
    await markJobProcessing(jobId)

    // 1. Get face image as base64
    const faceBase64 = await withTimeout(
      getFaceImageAsBase64(job.face.storage_url),
      JOB_TIMEOUT,
      'Face download timed out'
    )

    const mimeType = detectMimeType(faceBase64)

    // Stage 1: Identity
    let identityDesc = job.face.identity_description
    if (!identityDesc) {
      const { extractFaceIdentity } = await import('./gemini')
      identityDesc = await withTimeout(
        extractFaceIdentity(faceBase64, mimeType),
        JOB_TIMEOUT,
        'Identity extraction timed out'
      )
      await supabaseAdmin.from('faces').update({ identity_description: identityDesc }).eq('id', job.face.id)
    }

    // Stage 2: Imagen
    const { generateImagenWithRetry } = await import('./imagen')
    const generatedBase64 = await withTimeout(
      generateImagenWithRetry(identityDesc, job.prompt.prompt_text, job.prompt.style_name),
      JOB_TIMEOUT,
      'Imagen generation timed out'
    )

    // 3. Upload to Cloudinary
    const { secure_url, public_id } = await withTimeout(
      uploadGeneratedImage(
        generatedBase64,
        job.face.label,
        job.prompt.style_name,
        job.prompt.pose_name,
        jobId
      ),
      30_000,
      'Cloudinary upload timed out'
    )

    // 4. Mark done
    await markJobDone(jobId, secure_url, public_id)
    await incrementBatchStat(sessionId, 'completed_jobs')

    console.log(`[Queue] ✅ Job ${jobId} done. URL: ${secure_url}`)
  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error'
    console.error(`[Queue] ❌ Job ${jobId} failed: ${msg}`)
    await markJobFailed(jobId, msg)
    await incrementBatchStat(sessionId, 'failed_jobs')
  }
}

// ─── Supabase Queue Operations ────────────────────────────────────────────────

async function dequeueJob(sessionId: string) {
  // Atomically grab one queued job and mark it as processing
  const { data, error } = await supabaseAdmin
    .from('generation_jobs')
    .select(`
      *,
      face:faces(id, label, storage_url),
      prompt:prompts(id, style_name, pose_name, prompt_text)
    `)
    .eq('batch_session_id', sessionId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) return null
  return data
}

async function countQueuedJobs(sessionId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('batch_session_id', sessionId)
    .eq('status', 'queued')
  return count ?? 0
}

async function incrementBatchStat(
  sessionId: string,
  field: 'completed_jobs' | 'failed_jobs'
) {
  // Use raw SQL increment to avoid race conditions
  await supabaseAdmin.rpc('increment_batch_stat', {
    session_id: sessionId,
    field_name: field,
  })
}

async function markBatchComplete(sessionId: string) {
  await supabaseAdmin
    .from('batch_sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId)
  console.log(`[Queue] 🎉 Batch ${sessionId} completed!`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)
    ),
  ])
}
