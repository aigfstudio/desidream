'use client'

import { useState, useEffect } from 'react'
import { Download, RefreshCw, Filter } from 'lucide-react'
import JSZip from 'jszip'

export default function GalleryPage() {
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [filterStyle, setFilterStyle] = useState('')

  const fetchImages = async () => {
    setLoading(true)
    const res = await fetch('/api/jobs')
    const json = await res.json()
    const doneJobs = (json.jobs || []).filter((j: any) => j.status === 'done' && j.cloudinary_url)
    setImages(doneJobs)
    setLoading(false)
  }

  useEffect(() => {
    fetchImages()
  }, [])

  const handleBulkDownload = async () => {
    setDownloading(true)
    try {
      const zip = new JSZip()
      const folder = zip.folder('aigf_gallery')

      // Fetch all images and add to zip
      const toDownload = filterStyle ? images.filter(img => img.prompt?.style_name === filterStyle) : images
      
      const promises = toDownload.map(async (img) => {
        const response = await fetch(img.cloudinary_url)
        const blob = await response.blob()
        const filename = `${img.face?.label}_${img.prompt?.style_name}_${img.prompt?.pose_name}.jpg`.replace(/\s+/g, '_')
        folder?.file(filename, blob)
      })

      await Promise.all(promises)
      const content = await zip.generateAsync({ type: 'blob' })
      
      // Trigger download
      const url = window.URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `aigf_gallery_${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed', err)
      alert('Failed to download images.')
    } finally {
      setDownloading(false)
    }
  }

  const styles = Array.from(new Set(images.map((i) => i.prompt?.style_name))).filter(Boolean) as string[]

  const filteredImages = filterStyle 
    ? images.filter(img => img.prompt?.style_name === filterStyle)
    : images

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Generated Gallery</h1>
          <p className="text-muted-foreground mt-2">{filteredImages.length} images available</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              className="bg-transparent text-sm focus:outline-none text-foreground w-32"
              value={filterStyle}
              onChange={(e) => setFilterStyle(e.target.value)}
            >
              <option value="">All Styles</option>
              {styles.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={fetchImages}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 border border-border"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>

          <button
            onClick={handleBulkDownload}
            disabled={downloading || filteredImages.length === 0}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> 
            {downloading ? 'Zipping...' : 'Download ZIP'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading gallery...</div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center p-12 border border-dashed border-border rounded-xl text-muted-foreground">
          No generated images found.
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
          {filteredImages.map((img) => (
            <div key={img.id} className="break-inside-avoid relative group rounded-xl overflow-hidden bg-card border border-border">
              <img 
                src={img.cloudinary_url} 
                alt={`${img.face?.label} - ${img.prompt?.style_name}`} 
                className="w-full h-auto"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <div className="text-white text-sm font-semibold truncate">{img.face?.label}</div>
                <div className="text-gray-300 text-xs truncate">{img.prompt?.style_name} • {img.prompt?.pose_name}</div>
                <a 
                  href={img.cloudinary_url}
                  download
                  target="_blank"
                  className="mt-2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded inline-flex items-center justify-center gap-1 hover:bg-primary/90 w-fit"
                >
                  <Download className="h-3 w-3" /> Save
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
