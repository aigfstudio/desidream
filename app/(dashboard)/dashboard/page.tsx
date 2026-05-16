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
  const [imagesPerFace, setImagesPerFace] = useState<number>(3)
  const generatingRef = useRef(false)

  // ─── Fetch Status ────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/batch/status')
      const data = await res.json()
      setStats(data.stats)
      setSession(data.session)
      return data
    } catch { return null }
  }, [])

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      const done = (data.jobs || []).filter((j: any) => j.status === 'done' && j.cloudinary_url)
      setLatestImages(done.slice(0, 12))
    } catch { }
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

  // ─── Generation Loop ─────────────────────────────────────────────────────────
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
          setLastGenerated(`✅ Uploaded to Cloudinary: ${data.face} — ${data.style}`)
        }

        await fetchStatus()
        await fetchImages()
        await new Promise(r => setTimeout(r, 800))
      } catch (err: any) {
        setLastGenerated(`❌ ${err.message}`)
        await new Promise(r => setTimeout(r, 5000))
      }
    }

    setGenerating(false)
  }, [fetchStatus, fetchImages])

  // ─── Actions ─────────────────────────────────────────────────────────────────
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
    try {
      const res = await fetch('/api/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagesPerFace }),
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch {
        alert('Server error: ' + text.substring(0, 150))
        setStarting(false)
        return
      }
      if (data.error) {
        alert('Error: ' + data.error)
        setStarting(false)
        return
      }
      await fetchStatus()
      setStarting(false)
      runGenerationLoop()
    } catch (err: any) {
      alert('Network error: ' + err.message)
      setStarting(false)
    }
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

  // ─── Derived State ───────────────────────────────────────────────────────────
  const facesCount = stats?.facesCount || 0
  const promptsCount = stats?.promptsCount || 0
  const totalImages = facesCount * imagesPerFace
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
          <span className={`text-xs px-3 py-1.5 rounded-full border ${totalImages > 0 ? 'bg-green-950 border-green-800 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            {totalImages} images queued
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────────── */}
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
                    : '100 Indian GF outfits × poses → auto-loaded'
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

          {/* Step 2: Face Photos */}
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

            {/* Drag & Drop Upload Zone */}
            <div
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById('faceInput')?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${dragOver ? 'border-green-500 bg-green-950/20' : 'border-zinc-700 hover:border-zinc-500'}`}
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

            {/* Sync from Supabase */}
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

          {/* Step 3: Generate Images */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              {isCompleted
                ? <CheckCircle className="h-4 w-4 text-green-400" />
                : <span className="text-zinc-600 text-sm font-bold">03</span>
              }
              <span className="font-semibold text-sm">Generate Images</span>
            </div>
            <p className="text-zinc-500 text-xs mb-4 ml-6">
              Use the slider to pick images per face, then hit Generate
            </p>

            {/* Live status ticker */}
            {lastGenerated && (
              <div className={`mb-3 text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${generating ? 'text-green-400 bg-green-950/30 border border-green-900' : 'text-zinc-400 bg-zinc-800 border border-zinc-700'}`}>
                {generating && <Zap className="h-3 w-3 animate-pulse flex-shrink-0" />}
                {lastGenerated}
              </div>
            )}

            {/* ── Slider — ALWAYS visible ────────────────────────────── */}
            <div className="bg-zinc-800 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-zinc-200">Images per face</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={promptsCount || 100}
                    value={imagesPerFace}
                    onChange={(e) => setImagesPerFace(Math.min(promptsCount || 100, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-16 bg-zinc-900 border border-zinc-600 rounded-md px-2 py-1 text-sm text-center text-white focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={promptsCount || 100}
                value={imagesPerFace}
                onChange={(e) => setImagesPerFace(Number(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-xs mt-2">
                <span className="text-zinc-500">1</span>
                <span className="font-bold">
                  <span className="text-green-400">{facesCount} faces</span>
                  <span className="text-zinc-500"> × </span>
                  <span className="text-green-400">{imagesPerFace}</span>
                  <span className="text-zinc-500"> = </span>
                  <span className="text-white">{totalImages} images</span>
                </span>
                <span className="text-zinc-500">Max {promptsCount || 100}</span>
              </div>
            </div>

            {/* ── Action buttons — based on current state ────────────── */}
            <div className="space-y-2">

              {/* No session OR completed → show green START */}
              {(!session || isCompleted) && (
                <button
                  id="btn-generate"
                  onClick={handleStart}
                  disabled={starting || !facesCount || !promptsCount}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-green-900/20 text-sm"
                >
                  <Play className="h-4 w-4" />
                  {starting ? 'Starting...' : `▶ Generate ${totalImages} Images`}
                </button>
              )}

              {/* Running or generating → show STOP */}
              {(isRunning || generating) && !isCompleted && (
                <button
                  id="btn-stop"
                  onClick={handlePause}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  <Pause className="h-4 w-4" /> ⏸ Stop Generation
                </button>
              )}

              {/* Paused → show RESUME */}
              {isPaused && !generating && (
                <button
                  id="btn-resume"
                  onClick={handleResume}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  <Play className="h-4 w-4" /> ▶ Resume Generation
                </button>
              )}

              {/* New Batch — visible whenever a session exists */}
              {session && (
                <button
                  id="btn-new-batch"
                  onClick={handleStart}
                  disabled={starting || generating}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors border border-zinc-600"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {starting ? 'Starting...' : `🔄 New Batch — ${totalImages} images`}
                </button>
              )}

            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Live Progress */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4">Live Progress</h2>

            {!session ? (
              <div className="text-center py-10 text-zinc-600">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <div className="text-sm">Waiting to start...</div>
                <div className="text-xs mt-1 text-zinc-700">Set your slider and click Generate</div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${generating ? 'bg-green-950 text-green-400 border-green-800 animate-pulse' : isPaused ? 'bg-yellow-950 text-yellow-400 border-yellow-800' : isCompleted ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                    {generating ? '⚡ Generating...' : isPaused ? '⏸ Paused' : isCompleted ? '✅ Complete' : '⏳ Ready'}
                  </span>
                  <span className="text-zinc-300 text-lg font-bold font-mono">{progressPct}%</span>
                </div>

                {/* Progress bar */}
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

                {/* Stats grid */}
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

          {/* Generated Images */}
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
