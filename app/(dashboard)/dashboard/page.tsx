'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Play, Pause, RefreshCw, ImageIcon, CheckCircle, AlertCircle, Clock } from 'lucide-react'

type BatchStats = {
  facesCount: number
  promptsCount: number
  total: number
  queued: number
  processing: number
  done: number
  failed: number
  percentage: number
  eta_minutes: number | null
}

type Session = {
  id: string
  status: string
  total_jobs: number
  completed_jobs: number
  failed_jobs: number
  started_at: string
} | null

export default function DashboardPage() {
  const [stats, setStats] = useState<BatchStats | null>(null)
  const [session, setSession] = useState<Session>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [starting, setStarting] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [completedImages, setCompletedImages] = useState<any[]>([])

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/batch/status')
    const data = await res.json()
    setStats(data.stats)
    setSession(data.session)
  }, [])

  const fetchCompleted = useCallback(async () => {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    const done = (data.jobs || []).filter((j: any) => j.status === 'done' && j.cloudinary_url)
    setCompletedImages(done.slice(0, 20)) // Show latest 20
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchCompleted()
    const interval = setInterval(() => {
      fetchStatus()
      fetchCompleted()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchCompleted])

  const handleSeedPrompts = async () => {
    setSeeding(true)
    const res = await fetch('/api/prompts/seed', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setSeeded(true)
      await fetchStatus()
    }
    setSeeding(false)
  }

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!fileArr.length) return

    setUploading(true)
    setUploadMsg(`Uploading ${fileArr.length} face images...`)

    const CHUNK = 10
    let uploaded = 0
    for (let i = 0; i < fileArr.length; i += CHUNK) {
      const chunk = fileArr.slice(i, i + CHUNK)
      const formData = new FormData()
      chunk.forEach(f => formData.append('files', f))
      const res = await fetch('/api/faces/upload', { method: 'POST', body: formData })
      const json = await res.json()
      uploaded += json.uploaded ?? 0
      setUploadMsg(`Uploaded ${uploaded} / ${fileArr.length} faces...`)
    }

    setUploadMsg(`✅ ${uploaded} faces uploaded!`)
    setUploading(false)
    await fetchStatus()
  }

  const handleStart = async () => {
    setStarting(true)
    const res = await fetch('/api/batch/start', { method: 'POST' })
    const data = await res.json()
    if (data.error) alert(data.error)
    await fetchStatus()
    setStarting(false)
  }

  const handlePause = async () => {
    await fetch('/api/batch/pause', { method: 'POST' })
    await fetchStatus()
  }

  const handleResume = async () => {
    await fetch('/api/batch/resume', { method: 'POST' })
    await fetchStatus()
  }

  const totalExpected = (stats?.facesCount || 0) * (stats?.promptsCount || 0)
  const isRunning = session?.status === 'running'
  const isPaused = session?.status === 'paused'
  const isCompleted = session?.status === 'completed'
  const progressPct = session ? ((session.completed_jobs / session.total_jobs) * 100).toFixed(1) : '0'

  return (
    <div className="min-h-screen bg-[#080808] text-white p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-green-400">AIGFStudio</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Bulk AI image generation pipeline</p>
        </div>
        <div className="flex gap-3 text-xs text-zinc-500">
          <span className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
            {stats?.facesCount || 0} faces
          </span>
          <span className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
            {stats?.promptsCount || 0} prompts
          </span>
          <span className="bg-green-950 border border-green-800 text-green-400 px-3 py-1.5 rounded-full">
            {totalExpected} images expected
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Setup */}
        <div className="space-y-4">
          {/* Step 1: Seed Prompts */}
          <div className={`bg-zinc-900 border rounded-xl p-5 ${seeded || (stats?.promptsCount || 0) > 0 ? 'border-green-800' : 'border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  {(seeded || (stats?.promptsCount || 0) > 0)
                    ? <CheckCircle className="h-4 w-4 text-green-400" />
                    : <span className="text-zinc-600 text-sm font-bold">01</span>
                  }
                  <span className="font-semibold text-sm">Load Outfit Prompts</span>
                </div>
                <p className="text-zinc-500 text-xs mt-1 ml-6">
                  {(stats?.promptsCount || 0) > 0
                    ? `✅ ${stats?.promptsCount} prompts ready — 100 Indian GF outfits + poses`
                    : '100 outfits × 20 poses = all combinations will be loaded automatically'
                  }
                </p>
              </div>
              <button
                onClick={handleSeedPrompts}
                disabled={seeding || (stats?.promptsCount || 0) > 0}
                className="bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {seeding ? 'Loading...' : (stats?.promptsCount || 0) > 0 ? 'Done ✓' : 'Load All Prompts'}
              </button>
            </div>
          </div>

          {/* Step 2: Upload Faces */}
          <div className={`bg-zinc-900 border rounded-xl p-5 ${(stats?.facesCount || 0) > 0 ? 'border-green-800' : 'border-zinc-800'}`}>
            <div className="flex items-center gap-2 mb-3">
              {(stats?.facesCount || 0) > 0
                ? <CheckCircle className="h-4 w-4 text-green-400" />
                : <span className="text-zinc-600 text-sm font-bold">02</span>
              }
              <span className="font-semibold text-sm">Upload Face Photos</span>
            </div>
            <p className="text-zinc-500 text-xs mb-3 ml-6">
              {(stats?.facesCount || 0) > 0
                ? `✅ ${stats?.facesCount} faces uploaded`
                : 'Drop your face photos here. Start with 5 faces for a quick 100-image test.'
              }
            </p>

            <div
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById('faceInput')?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
                ${dragOver ? 'border-green-500 bg-green-950/20' : 'border-zinc-700 hover:border-zinc-500'}`}
            >
              <input
                id="faceInput"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="text-green-400 text-sm animate-pulse">{uploadMsg}</div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                  <div className="text-zinc-400 text-sm">Drop face images or click to browse</div>
                  <div className="text-zinc-600 text-xs mt-1">JPG, PNG, WEBP — start with 5 faces</div>
                  {uploadMsg && <div className="text-green-400 text-xs mt-2">{uploadMsg}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Generate */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-zinc-600 text-sm font-bold">03</span>
              <span className="font-semibold text-sm">Generate Images</span>
            </div>
            <p className="text-zinc-500 text-xs mb-4 ml-6">
              {totalExpected > 0
                ? `Will generate ${totalExpected} images (${stats?.facesCount} faces × ${stats?.promptsCount} outfits)`
                : 'Complete steps 1 & 2 first'
              }
            </p>

            {!session ? (
              <button
                onClick={handleStart}
                disabled={starting || !stats?.facesCount || !stats?.promptsCount}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                <Play className="h-4 w-4" />
                {starting ? 'Starting...' : `Generate ${totalExpected} Images`}
              </button>
            ) : (
              <div className="flex gap-3">
                {isRunning && (
                  <button onClick={handlePause} className="flex-1 flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 rounded-lg transition-colors">
                    <Pause className="h-4 w-4" /> Pause
                  </button>
                )}
                {isPaused && (
                  <button onClick={handleResume} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors">
                    <Play className="h-4 w-4" /> Resume
                  </button>
                )}
                <button onClick={handleStart} className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 rounded-lg transition-colors">
                  <RefreshCw className="h-4 w-4" /> New Batch
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Progress */}
        <div className="space-y-4">
          {/* Progress Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4">Generation Progress</h2>

            {!session ? (
              <div className="text-center py-8 text-zinc-600">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <div className="text-sm">No active batch yet</div>
                <div className="text-xs mt-1">Complete setup and click Generate</div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize
                    ${isRunning ? 'bg-green-950 text-green-400 border border-green-800' : ''}
                    ${isPaused ? 'bg-yellow-950 text-yellow-400 border border-yellow-800' : ''}
                    ${isCompleted ? 'bg-blue-950 text-blue-400 border border-blue-800' : ''}
                  `}>
                    {isRunning ? '🟢 Generating...' : isPaused ? '⏸ Paused' : isCompleted ? '✅ Complete' : session.status}
                  </span>
                  <span className="text-zinc-400 text-sm font-mono">{progressPct}%</span>
                </div>

                {/* Big Progress Bar */}
                <div>
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-zinc-500">
                    <span>{session.completed_jobs} done</span>
                    <span>{session.total_jobs} total</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-green-400 font-bold text-lg">{session.completed_jobs}</div>
                    <div className="text-zinc-500 text-xs">Done</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-yellow-400 font-bold text-lg">{stats?.processing || 0}</div>
                    <div className="text-zinc-500 text-xs">Running</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-red-400 font-bold text-lg">{session.failed_jobs}</div>
                    <div className="text-zinc-500 text-xs">Failed</div>
                  </div>
                </div>

                {stats?.eta_minutes != null && isRunning && (
                  <div className="text-xs text-zinc-500 text-center">
                    ⏱ ~{stats.eta_minutes} min remaining
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Latest Generated Images */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Latest Generated</h2>
              <a href="/gallery" className="text-xs text-green-400 hover:underline">View all →</a>
            </div>

            {completedImages.length === 0 ? (
              <div className="text-center py-6 text-zinc-600">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <div className="text-xs">Images will appear here as they're generated</div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {completedImages.map(img => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-zinc-800">
                    <img src={img.cloudinary_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
