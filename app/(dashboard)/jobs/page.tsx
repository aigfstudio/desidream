'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, RotateCcw } from 'lucide-react'

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const fetchJobs = async () => {
    setLoading(true)
    const res = await fetch('/api/jobs')
    const json = await res.json()
    setJobs(json.jobs || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [])

  const handleRetryFailed = async () => {
    await fetch('/api/jobs/retry-failed', { method: 'POST' })
    fetchJobs()
  }

  const handleExportCSV = () => {
    const headers = ['ID', 'Face Label', 'Style', 'Pose', 'Status', 'Error', 'Retry Count', 'Created At']
    const rows = jobs.map(j => [
      j.id,
      j.face?.label,
      j.prompt?.style_name,
      j.prompt?.pose_name,
      j.status,
      j.error_message || '',
      j.retry_count,
      new Date(j.created_at).toLocaleString()
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `jobs_export_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredJobs = filterStatus === 'all' ? jobs : jobs.filter(j => j.status === filterStatus)

  const STATUS_COLORS: Record<string, string> = {
    queued: 'text-zinc-400 bg-zinc-900/50',
    processing: 'text-yellow-400 bg-yellow-900/20',
    done: 'text-green-400 bg-green-900/20',
    failed: 'text-destructive bg-destructive/10',
  }

  const failedCount = jobs.filter(j => j.status === 'failed').length

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Job Queue</h1>
          <p className="text-muted-foreground mt-2">Monitor generation jobs</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <select 
            className="bg-card border border-border text-foreground px-3 py-2 rounded-md text-sm focus:outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>

          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 border border-border"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>

          {failedCount > 0 && (
            <button
              onClick={handleRetryFailed}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90"
            >
              <RotateCcw className="h-4 w-4" /> Retry {failedCount} Failed
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-muted-foreground">
            <thead className="text-xs text-foreground uppercase bg-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Face</th>
                <th className="px-6 py-4">Style & Pose</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center animate-pulse">Loading jobs...</td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">No jobs found matching criteria.</td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <img src={job.face?.storage_url} className="w-8 h-8 rounded object-cover bg-muted" />
                        {job.face?.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{job.prompt?.style_name}</div>
                      <div className="text-xs">{job.prompt?.pose_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[job.status]}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate">
                      {job.status === 'done' && job.cloudinary_url ? (
                        <a href={job.cloudinary_url} target="_blank" className="text-primary hover:underline truncate block">
                          View Image
                        </a>
                      ) : job.status === 'failed' ? (
                        <div className="flex items-center gap-1 text-destructive text-xs" title={job.error_message}>
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{job.error_message}</span>
                          {job.retry_count > 0 && <span className="text-muted-foreground ml-1">(Retries: {job.retry_count})</span>}
                        </div>
                      ) : (
                        <span className="text-xs">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
