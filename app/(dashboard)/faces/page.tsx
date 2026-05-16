// app/(dashboard)/faces/page.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Face } from '@/types'

export default function FacesPage() {
  const [faces, setFaces] = useState<Face[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

  const fetchFaces = useCallback(async () => {
    const res = await fetch('/api/faces')
    const json = await res.json()
    setFaces(json.faces ?? [])
  }, [])

  useEffect(() => { fetchFaces() }, [fetchFaces])

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!fileArr.length) return

    setUploading(true)
    setUploadProgress(`Uploading ${fileArr.length} files...`)

    // Upload in chunks of 20 to avoid payload size issues
    const CHUNK = 20
    let uploaded = 0

    for (let i = 0; i < fileArr.length; i += CHUNK) {
      const chunk = fileArr.slice(i, i + CHUNK)
      const formData = new FormData()
      chunk.forEach((f) => formData.append('files', f))

      const res = await fetch('/api/faces/upload', { method: 'POST', body: formData })
      const json = await res.json()
      uploaded += json.uploaded ?? 0
      setUploadProgress(`Uploaded ${uploaded} / ${fileArr.length}...`)
    }

    setUploadProgress(`✅ Done! ${uploaded} faces uploaded.`)
    await fetchFaces()
    setUploading(false)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  const paginatedFaces = faces.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(faces.length / PER_PAGE)

  const STATUS_COLORS: Record<string, string> = {
    pending: 'text-zinc-400',
    processing: 'text-yellow-400',
    done: 'text-green-400',
    failed: 'text-red-400',
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-mono p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <a href="/dashboard" className="text-xs text-zinc-500 hover:text-white mb-2 block">← Dashboard</a>
          <h1 className="text-3xl font-bold">Faces</h1>
          <p className="text-zinc-500 text-sm mt-1">{faces.length} / 200 uploaded</p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>{faces.filter((f) => f.status === 'done').length} processed</div>
          <div>{faces.filter((f) => f.status === 'pending').length} pending</div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-12 text-center mb-8 transition-all cursor-pointer
          ${dragOver ? 'border-green-500 bg-green-950/20' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'}`}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div>
            <div className="text-green-400 text-lg mb-2 animate-pulse">⏳ Uploading...</div>
            <div className="text-zinc-400 text-sm">{uploadProgress}</div>
          </div>
        ) : (
          <div>
            <div className="text-5xl mb-4">📁</div>
            <div className="text-white font-semibold text-lg mb-2">
              Drop up to 200 face images here
            </div>
            <div className="text-zinc-500 text-sm">
              JPG, PNG, WEBP · Max 10MB each · Click to browse
            </div>
            {uploadProgress && (
              <div className="mt-4 text-green-400 text-sm">{uploadProgress}</div>
            )}
          </div>
        )}
      </div>

      {/* Faces Grid */}
      {faces.length > 0 && (
        <>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-6">
            {paginatedFaces.map((face) => (
              <div key={face.id} className="group relative">
                <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                  <img
                    src={face.storage_url}
                    alt={face.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="mt-1 text-center">
                  <div className="text-xs text-zinc-400 truncate">{face.label}</div>
                  <div className={`text-xs ${STATUS_COLORS[face.status]}`}>
                    {face.status}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, faces.length)} of {faces.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-zinc-700 rounded hover:border-zinc-500 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-xs text-zinc-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-zinc-700 rounded hover:border-zinc-500 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
