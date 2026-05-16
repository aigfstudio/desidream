'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Play, Pause, RefreshCw, ImageIcon, CheckCircle, Clock, Zap, Settings2, Image as ImageIcon2, FileText, CheckSquare, Square, Wand2 } from 'lucide-react'

export default function DashboardPage() {
  // Session & Polling State
  const [stats, setStats] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [latestImages, setLatestImages] = useState<any[]>([])
  const [lastGenerated, setLastGenerated] = useState<string>('')
  
  // Data State
  const [allFaces, setAllFaces] = useState<any[]>([])
  const [allPrompts, setAllPrompts] = useState<any[]>([])
  
  // Form State
  const [selectedFaceIds, setSelectedFaceIds] = useState<Set<string>>(new Set())
  const [promptMode, setPromptMode] = useState<'library' | 'custom' | 'random'>('random')
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set())
  const [customPrompt, setCustomPrompt] = useState('')
  const [imagesPerFace, setImagesPerFace] = useState<number>(3)
  const [model, setModel] = useState<'imagen' | 'gemini'>('imagen')

  // UI State
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [starting, setStarting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const generatingRef = useRef(false)

  // ─── Fetch Data & Status ───────────────────────────────────────────────────
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

  const fetchData = useCallback(async () => {
    try {
      const [facesRes, promptsRes] = await Promise.all([
        fetch('/api/faces'),
        fetch('/api/prompts')
      ])
      const facesData = await facesRes.json()
      const promptsData = await promptsRes.json()
      if (facesData.faces) setAllFaces(facesData.faces)
      if (promptsData.prompts) setAllPrompts(promptsData.prompts)
    } catch (err) {
      console.error('Failed to load data', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchStatus()
    fetchImages()
    const interval = setInterval(() => {
      fetchStatus()
      fetchImages()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchImages, fetchData])

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
  const handleStart = async () => {
    if (selectedFaceIds.size === 0) return alert('Please select at least one face.')
    if (promptMode === 'library' && selectedPromptIds.size === 0) return alert('Please select at least one prompt from the library.')
    if (promptMode === 'custom' && !customPrompt.trim()) return alert('Please write a custom prompt.')
    if (promptMode === 'random' && allPrompts.length === 0) return alert('Prompt library is empty. Please add prompts first.')

    setStarting(true)
    try {
      const payload = {
        faceIds: Array.from(selectedFaceIds),
        promptMode,
        promptIds: Array.from(selectedPromptIds),
        customPrompt,
        imagesPerFace,
        model
      }

      const res = await fetch('/api/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

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
    await fetchData()
    await fetchStatus()
  }

  const handleSyncFromBucket = async () => {
    setSyncing(true)
    setUploadMsg('Syncing from Supabase...')
    const res = await fetch('/api/faces/sync', { method: 'POST' })
    const data = await res.json()
    setUploadMsg(data.error ? `❌ ${data.error}` : `✅ ${data.message}`)
    await fetchData()
    await fetchStatus()
    setSyncing(false)
  }

  // Toggle Selection Helpers
  const toggleFace = (id: string) => {
    const next = new Set(selectedFaceIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedFaceIds(next)
  }

  const toggleAllFaces = () => {
    if (selectedFaceIds.size === allFaces.length) setSelectedFaceIds(new Set())
    else setSelectedFaceIds(new Set(allFaces.map(f => f.id)))
  }

  const togglePrompt = (id: string) => {
    const next = new Set(selectedPromptIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedPromptIds(next)
  }

  // ─── Derived State ───────────────────────────────────────────────────────────
  let calculatedTotalImages = 0
  if (promptMode === 'library') {
    calculatedTotalImages = selectedFaceIds.size * selectedPromptIds.size
  } else {
    calculatedTotalImages = selectedFaceIds.size * imagesPerFace
  }

  const isRunning = session?.status === 'running'
  const isPaused = session?.status === 'paused'
  const isCompleted = session?.status === 'completed'
  const progressPct = session && session.total_jobs > 0
    ? ((session.completed_jobs / session.total_jobs) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-screen bg-[#080808] text-white p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-green-400">AIGFStudio</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Bulk AI image generation pipeline</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <span className="text-xs px-3 py-1.5 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-400">
            {allFaces.length} Faces Total
          </span>
          <span className="text-xs px-3 py-1.5 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-400">
            {allPrompts.length} Prompts Total
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT COLUMN (Configuration) ────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Face Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 text-sm font-bold">01</span>
                <span className="font-semibold text-sm">Select Faces</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => document.getElementById('faceInput')?.click()} className="text-xs text-green-400 hover:text-green-300">
                  + Upload
                </button>
                <button onClick={handleSyncFromBucket} disabled={syncing} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} /> Sync
                </button>
              </div>
            </div>
            
            <input id="faceInput" type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />

            {allFaces.length === 0 ? (
              <div className="text-center py-6 text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
                <ImageIcon2 className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <div className="text-xs">No faces found. Upload or Sync.</div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={toggleAllFaces} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                    {selectedFaceIds.size === allFaces.length ? <CheckSquare className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4" />}
                    Select All ({selectedFaceIds.size}/{allFaces.length})
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
                  {allFaces.map(face => {
                    const isSelected = selectedFaceIds.has(face.id)
                    return (
                      <div 
                        key={face.id} 
                        onClick={() => toggleFace(face.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-green-500' : 'border-transparent hover:border-zinc-700'}`}
                      >
                        <img src={face.storage_url} alt={face.label} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-green-500 rounded-full">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {uploadMsg && <p className="text-xs mt-3 text-green-400">{uploadMsg}</p>}
          </div>

          {/* 2. Prompt Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-zinc-600 text-sm font-bold">02</span>
              <span className="font-semibold text-sm">Select Prompts</span>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-950 p-1 rounded-lg mb-4">
              <button 
                onClick={() => setPromptMode('library')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${promptMode === 'library' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Library ({allPrompts.length})
              </button>
              <button 
                onClick={() => setPromptMode('custom')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${promptMode === 'custom' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Custom
              </button>
              <button 
                onClick={() => setPromptMode('random')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${promptMode === 'random' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Random
              </button>
            </div>

            {/* Tab Content */}
            {promptMode === 'library' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">Select specific prompts to generate for each selected face.</p>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
                  {allPrompts.map(prompt => {
                    const isSelected = selectedPromptIds.has(prompt.id)
                    return (
                      <div 
                        key={prompt.id} 
                        onClick={() => togglePrompt(prompt.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-green-950/20 border-green-800' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'}`}
                      >
                        <div className="mt-0.5">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4 text-zinc-600" />}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">{prompt.style_name}</div>
                          <div className="text-xs text-zinc-500 line-clamp-1">{prompt.prompt_text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-xs text-green-400 font-medium">{selectedPromptIds.size} prompts selected</div>
              </div>
            )}

            {promptMode === 'custom' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">Write your own prompt. We will generate variations based on the slider below.</p>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. A highly detailed portrait of a woman wearing a red sari in Paris during sunset..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-green-500 min-h-[100px] resize-y"
                />
              </div>
            )}

            {promptMode === 'random' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">We will randomly pick prompts from the library based on the slider below.</p>
              </div>
            )}

            {/* Slider for Custom and Random modes */}
            {promptMode !== 'library' && (
              <div className="mt-5 pt-5 border-t border-zinc-800">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-zinc-200">Variations per face</label>
                  <span className="text-green-400 font-bold">{imagesPerFace}</span>
                </div>
                <input
                  type="range" min={1} max={100} value={imagesPerFace}
                  onChange={(e) => setImagesPerFace(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>
            )}
          </div>

          {/* 3. Model Selection & Generate */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-zinc-600 text-sm font-bold">03</span>
              <span className="font-semibold text-sm">Review & Generate</span>
            </div>

            <div className="flex gap-4 mb-5">
              <div 
                onClick={() => setModel('imagen')}
                className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${model === 'imagen' ? 'bg-green-950/20 border-green-500' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
              >
                <div className="text-sm font-semibold text-white mb-1 flex items-center justify-between">
                  Imagen 4.0 {model === 'imagen' && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <div className="text-xs text-zinc-500">Premium quality (2-Stage)</div>
              </div>
              <div 
                onClick={() => setModel('gemini')}
                className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${model === 'gemini' ? 'bg-green-950/20 border-green-500' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
              >
                <div className="text-sm font-semibold text-white mb-1 flex items-center justify-between">
                  Gemini 2.5 Flash {model === 'gemini' && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <div className="text-xs text-zinc-500">Fast & Free</div>
              </div>
            </div>

            <div className="bg-zinc-950 rounded-lg p-3 mb-5 border border-zinc-800 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-zinc-500">Faces selected:</span>
                <span className="text-white font-medium">{selectedFaceIds.size}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-zinc-500">Prompts/Variations:</span>
                <span className="text-white font-medium">{promptMode === 'library' ? selectedPromptIds.size : imagesPerFace}</span>
              </div>
              <div className="flex justify-between pt-2 mt-2 border-t border-zinc-800">
                <span className="text-zinc-400 font-semibold">Total to Generate:</span>
                <span className="text-green-400 font-bold">{calculatedTotalImages} Images</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {(!session || isCompleted) && (
                <button
                  id="btn-generate" onClick={handleStart}
                  disabled={starting || calculatedTotalImages === 0}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-green-900/20 text-sm"
                >
                  {starting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {starting ? 'Starting...' : `Generate ${calculatedTotalImages} Images`}
                </button>
              )}

              {(isRunning || generating) && !isCompleted && (
                <button
                  id="btn-stop" onClick={handlePause}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  <Pause className="h-4 w-4" /> Stop Generation
                </button>
              )}

              {isPaused && !generating && (
                <button
                  id="btn-resume" onClick={handleResume}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  <Play className="h-4 w-4" /> Resume Generation
                </button>
              )}

              {session && (
                <button
                  id="btn-new-batch" onClick={handleStart}
                  disabled={starting || generating || calculatedTotalImages === 0}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors border border-zinc-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  New Batch — {calculatedTotalImages} images
                </button>
              )}
            </div>

          </div>
        </div>

        {/* ── RIGHT COLUMN (Progress & Results) ──────────────────────────────── */}
        <div className="lg:col-span-5 space-y-6">

          {/* Live Progress */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4">Live Progress</h2>

            {!session ? (
              <div className="text-center py-10 text-zinc-600">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <div className="text-sm">Waiting to start...</div>
                <div className="text-xs mt-1 text-zinc-700">Configure your batch on the left</div>
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

                {lastGenerated && (
                  <div className={`mt-4 text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${generating ? 'text-green-400 bg-green-950/30 border border-green-900' : 'text-zinc-400 bg-zinc-800 border border-zinc-700'}`}>
                    {generating && <Zap className="h-3 w-3 animate-pulse flex-shrink-0" />}
                    <span className="truncate">{lastGenerated}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generated Images */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Latest Output</h2>
              <a href="/gallery" className="text-xs text-green-400 hover:underline">Gallery →</a>
            </div>
            {latestImages.length === 0 ? (
              <div className="text-center py-6 text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <div className="text-xs">Images appear here as they generate</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {latestImages.map(img => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-zinc-800 relative group">
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
