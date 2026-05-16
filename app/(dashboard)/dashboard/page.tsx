'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Play, Pause, RefreshCw, ImageIcon, CheckCircle, Clock, Zap } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [starting, setStarting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [latestImages, setLatestImages] = useState<any[]>([])
  const [lastGenerated, setLastGenerated] = useState<string>('')
  const generatingRef = useRef(false)

  // ─── Fetch Status ───────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/batch/status')
    const data = await res.json()
    setStats(data.stats)
    setSession(data.session)
    return data
  }, [])

  const fetchImages = useCallback(async () => {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    const done = (data.jobs || []).filter((j: any) => j.status === 'done' && j.cloudinary_url)
    setLatestImages(done.slice(0, 12))
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchImages()
    const interval = setInterval(() => {
      fetchStatus()
      fetchImages()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchImages])

  // ─── Generation Loop ────────────────────────────────────────────────────────
  // This loop runs IN THE BROWSER — keeps calling /api/batch/process-chunk
  // until all jobs are done or user pauses
  const runGenerationLoop = useCallback(async () => {
    generatingRef.current = true
    setGenerating(true)

    while (generatingRef.current) {
      try {
        const res = await fetch('/api/batch/process-chunk', { method: 'POST' })
        const data = await res.json()

        if (data.done || data.error) {
          if (data.done) setLastGenerated('✅ All images generated!')
          if (data.error) setLastGenerated(`❌ Error: ${data.error}`)
          break
        }

        if (data.cloudinary_url) {
          setLastGenerated(`✅ Generated: ${data.face} — ${data.style}`)
        }

        await fetchStatus()
        await fetchImages()

        // Small delay between jobs to avoid overwhelming API
        await new Promise(r => setTimeout(r, 1000))
      } catch (err: any) {
        setLastGenerated(`❌ ${err.message}`)
        await new Promise(r => setTimeout(r, 5000)) // wait 5s on error then retry
      }
    }

    setGenerating(false)
  }, [fetchStatus, fetchImages])

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleSeedPrompts = async () => {
    setSeeding(true)
    const res = await fetch('/api/prompts/seed', { method: 'POST' })
    const data = await res.json()
    if (data.success) await fetchStatus()
    else alert('Failed to load prompts: ' + data.error)
    setSeeding(false)
  }

  const handleSyncFromBucket = async () => {
    setSyncing(true)
    setUploadMsg('Syncing from Supabase...')
    const res = await fetch('/api/faces/sync', { method: 'POST' })
    const data = await res.json()
    setUploadMsg(data.error ? `❌ ${data.error}` : `✅ ${data.message}`)
    await fetchStatus()
    setSyncing(false)
  }

  const handleStart = async () => {
    setStarting(true)
    const res = await fetch('/api/batch/start', { method: 'POST' })
    const data = await res.json()
    if (data.error) {
      alert(data.error)
      setStarting(false)
      return
    }
    await fetchStatus()
    setStarting(false)
    runGenerationLoop() // Start the browser-driven loop
  }

  const handlePause = () => {
    generatingRef.current = false
    setGenerating(false)
    fetch('/api/batch/pause', { method: 'POST' })
  }

  const handleResume = () => {
    fetch('/api/batch/resume', { method: 'POST' })
    runGenerationLoop()
  }

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!fileArr.length) return
    setUploading(true)
    setUploadMsg(`Uploading ${fileArr.length} faces...`)
    const CHUNK = 10
    let uploaded = 0
    for (let i = 0; i < fileArr.length; i += CHUNK) {
      const chunk = fileArr.slice(i, i + CHUNK)
      const formData = new FormData()
      chunk.forEach(f => formData.append('files', f))
      const res = await fetch('/api/faces/upload', { method: 'POST', body: formData })
      const json = await res.json()
      uploaded += json.uploaded ?? 0
      setUploadMsg(`Uploaded ${uploaded}/${fileArr.length}...`)
    }
    setUploadMsg(`✅ ${uploaded} faces uploaded!`)
    setUploading(false)
    await fetchStatus()
  }

  // ─── Derived State ──────────────────────────────────────────────────────────
  const facesCount = stats?.facesCount || 0
  const promptsCount = stats?.promptsCount || 0
  const totalExpected = facesCount * promptsCount
  const isRunning = session?.status === 'running'
  const isPaused = session?.status === 'paused'
  const isCompleted = session?.status === 'completed'
  const progressPct = session && session.total_jobs > 0
    ? ((session.completed_jobs / session.total_jobs) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-screen bg-[#080808] text-white p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-green-400">AIGFStudio</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Bulk AI image generation pipeline</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <span className={`text-xs px-3 py-1.5 rounded-full border ${facesCount > 0 ? 'bg-green-950 border-green-800 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            {facesCount} faces
          </span>
          <span className={`text-xs px-3 py-1.5 rounded-full border ${promptsCount > 0 ? 'bg-green-950 border-green-800 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            {promptsCount} prompts
          </span>
          <span className={`text-xs px-3 py-1.5 rounded-full border ${totalExpected > 0 ? 'bg-green-950 border-green-800 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            {totalExpected} images
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: 3 Steps */}
        <div className="space-y-4">

          {/* Step 1: Load Prompts */}
          <div className={`bg-zinc-900 border rounded-xl p-5 ${promptsCount > 0 ? 'border-green-800' : 'border-zinc-800'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {promptsCount > 0
                    ? <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    : <span className="text-zinc-600 text-sm font-bold w-4">01</span>
                  }
                  <span className="font-semibold text-sm">Load Outfit Prompts</span>
                </div>
                <p className="text-zinc-500 text-xs ml-6">
                  {promptsCount > 0
                    ? `✅ ${promptsCount} prompts ready in Supabase`
                    : '100 Indian GF outfits × 20 poses → all auto-loaded'
                  }
                </p>
              </div>
              <button
                onClick={handleSeedPrompts}
                disabled={seeding || promptsCount > 0}
                className="ml-3 flex-shrink-0 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                {seeding ? 'Loading...' : promptsCount > 0 ? 'Done ✓' : 'Load Prompts'}
              </button>
            </div>
          </div>

          {/* Step 2: Faces */}
          <div className={`bg-zinc-900 border rounded-xl p-5 ${facesCount > 0 ? 'border-green-800' : 'border-zinc-800'}`}>
            <div className="flex items-center gap-2 mb-1">
              {facesCount > 0
                ? <CheckCircle className="h-4 w-4 text-green-400" />
                : <span className="text-zinc-600 text-sm font-bold">02</span>
              }
              <span className="font-semibold text-sm">Face Photos</span>
            </div>
            <p className="text-zinc-500 text-xs mb-3 ml-6">
              {facesCount > 0 ? `✅ ${facesCount} faces registered` : 'Upload or sync from Supabase bucket'}
            </p>

            {/* Upload Zone */}
            <div
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById('faceInput')?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
                ${dragOver ? 'border-green-500 bg-green-950/20' : 'border-zinc-700 hover:border-zinc-500'}`}
            >
              <input id="faceInput" type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)} />
              {uploading
                ? <div className="text-green-400 text-sm animate-pulse">{uploadMsg}</div>
                : <div>
                  <Upload className="h-6 w-6 text-zinc-600 mx-auto mb-1" />
                  <div className="text-zinc-400 text-xs">Drop face photos here or click to browse</div>
                </div>
              }
            </div>

            {/* Sync Button */}
            <button
              onClick={handleSyncFromBucket}
              disabled={syncing}
              className="mt-2 w-full flex items-center justify-center gap-2 border border-zinc-700 hover:border-green-700 text-zinc-400 hover:text-green-400 text-xs font-medium py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Supabase aigf bucket'}
            </button>
            {uploadMsg && !uploading && <p className="text-xs mt-2 text-center text-green-400">{uploadMsg}</p>}
          </div>

          {/* Step 3: Generate */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              {isCompleted
                ? <CheckCircle className="h-4 w-4 text-green-400" />
                : <span className="text-zinc-600 text-sm font-bold">03</span>
              }
              <span className="font-semibold text-sm">Generate Images</span>
            </div>
            <p className="text-zinc-500 text-xs mb-4 ml-6">
              {totalExpected > 0
                ? `${facesCount} faces × ${promptsCount} outfits = ${totalExpected} images`
                : 'Complete steps 1 & 2 first'
              }
            </p>

            {generating && lastGenerated && (
              <div className="mb-3 text-xs text-green-400 bg-green-950/30 border border-green-900 rounded-lg px-3 py-2 flex items-center gap-2">
                <Zap className="h-3 w-3 animate-pulse flex-shrink-0" />
                {lastGenerated}
              </div>
            )}

            {!session ? (
              <button
                onClick={handleStart}
                disabled={starting || !facesCount || !promptsCount}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                <Play className="h-4 w-4" />
                {starting ? 'Starting...' : facesCount && promptsCount ? `▶ Start — Generate ${totalExpected} Images` : 'Complete steps above first'}
              </button>
            ) : (
              <div className="space-y-2">
                {(isRunning || generating) ? (
                  <button onClick={handlePause}
                    className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 rounded-lg transition-colors">
                    <Pause className="h-4 w-4" /> Pause Generation
                  </button>
                ) : isPaused ? (
                  <button onClick={handleResume}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors">
                    <Play className="h-4 w-4" /> Resume Generation
                  </button>
                ) : isCompleted ? (
                  <div className="text-center text-green-400 font-semibold py-3">✅ All images generated!</div>
                ) : null}

                <button onClick={handleStart} disabled={starting}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2.5 rounded-lg transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" /> Start New Batch
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Live Progress */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4">Live Progress</h2>

            {!session ? (
              <div className="text-center py-10 text-zinc-600">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <div className="text-sm">Waiting to start...</div>
                <div className="text-xs mt-1 text-zinc-700">Complete the 3 steps on the left</div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full
                    ${generating ? 'bg-green-950 text-green-400 border border-green-800 animate-pulse' : ''}
                    ${isPaused ? 'bg-yellow-950 text-yellow-400 border border-yellow-800' : ''}
                    ${isCompleted ? 'bg-blue-950 text-blue-400 border border-blue-800' : ''}
                    ${!generating && isRunning ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : ''}
                  `}>
                    {generating ? '⚡ Generating...' : isPaused ? '⏸ Paused' : isCompleted ? '✅ Complete' : '⏳ Ready'}
                  </span>
                  <span className="text-zinc-300 text-lg font-bold font-mono">{progressPct}%</span>
                </div>

                <div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-zinc-500">
                    <span>{session.completed_jobs} done</span>
                    <span>{session.total_jobs - session.completed_jobs - session.failed_jobs} remaining</span>
                    <span>{session.total_jobs} total</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-green-400 font-bold text-xl">{session.completed_jobs}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">Done</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-yellow-400 font-bold text-xl">{stats?.processing || 0}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">Processing</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-red-400 font-bold text-xl">{session.failed_jobs}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">Failed</div>
                  </div>
                </div>

                {stats?.eta_minutes && generating && (
                  <p className="text-center text-xs text-zinc-500">⏱ ~{stats.eta_minutes} minutes remaining</p>
                )}
              </div>
            )}
          </div>

          {/* Latest Generated Images */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Generated Images</h2>
              <a href="/gallery" className="text-xs text-green-400 hover:underline">View all →</a>
            </div>
            {latestImages.length === 0 ? (
              <div className="text-center py-6 text-zinc-600">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <div className="text-xs">Images appear here as they generate</div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {latestImages.map(img => (
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
